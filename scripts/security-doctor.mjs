#!/usr/bin/env node
/**
 * Security readiness checks (repo + local tooling). Does not mutate production.
 * Usage: npm run security:doctor
 *        npm run security:doctor -- --prod   # also probe live CSP headers
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const prodProbe = process.argv.includes("--prod");
const PROD_ORIGIN = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/+$/, "");

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function warn(msg) {
  console.log(`⚠ ${msg}`);
}
function fail(msg) {
  console.log(`✗ ${msg}`);
}

function fileIncludes(rel, needle) {
  const p = resolve(root, rel);
  if (!existsSync(p)) return false;
  return readFileSync(p, "utf8").includes(needle);
}

async function probeProductionCsp() {
  try {
    const res = await fetch(`${PROD_ORIGIN}/login`, { redirect: "follow" });
    const csp = res.headers.get("content-security-policy") || "";
    if (!csp) {
      fail(`production CSP missing on ${PROD_ORIGIN}/login`);
      return 1;
    }
    if (!/default-src 'self'/.test(csp)) {
      fail("production CSP does not include default-src 'self'");
      return 1;
    }
    ok(`production CSP present on ${PROD_ORIGIN}`);
    return 0;
  } catch (e) {
    fail(`production probe failed: ${e?.message || e}`);
    return 1;
  }
}

async function main() {
  console.log("Security doctor\n");
  let issues = 0;

  const migrations = [
    "supabase/migrations/20260706140000_insider_hardening_rpcs.sql",
    "supabase/migrations/20260706150000_d1_kv_namespace_write.sql",
  ];
  for (const m of migrations) {
    if (existsSync(resolve(root, m))) ok(`migration present — ${m}`);
    else {
      fail(`missing migration — ${m}`);
      issues += 1;
    }
  }

  if (fileIncludes("vercel.json", "Content-Security-Policy")) ok("vercel.json enforces CSP");
  else {
    fail("vercel.json missing Content-Security-Policy");
    issues += 1;
  }

  if (fileIncludes("public/_headers", "Content-Security-Policy")) ok("public/_headers enforces CSP");
  else {
    fail("public/_headers missing Content-Security-Policy");
    issues += 1;
  }

  if (fileIncludes("cloudflare/workers/d1-api/index.mjs", "user_can_delete_org_kv")) {
    ok("D1 Worker checks delete permission RPC");
  } else {
    fail("D1 Worker missing delete permission gate");
    issues += 1;
  }

  if (fileIncludes("cloudflare/workers/d1-api/index.mjs", "user_can_write_org_kv")) {
    ok("D1 Worker checks namespace write RPC");
  } else {
    fail("D1 Worker missing namespace write gate");
    issues += 1;
  }

  if (fileIncludes("cloudflare/workers/d1-api/index.mjs", "org_api_rate")) {
    ok("D1 Worker has org_api_rate limits");
  } else {
    warn("D1 Worker missing org_api_rate — deploy latest d1-api");
    issues += 1;
  }

  if (fileIncludes("src/context/AppContext.jsx", "refreshMembershipRoleFromSupabase")) {
    ok("App refreshes role from Supabase");
  } else {
    warn("AppContext may not refresh cloud roles");
    issues += 1;
  }

  if (fileIncludes("src/lib/backupCrypto.js", "AES-GCM")) {
    ok("Cloud backup client-side encryption (app_sync)");
  } else {
    warn("backupCrypto not found");
    issues += 1;
  }

  if (existsSync(resolve(root, "scripts/d1-backup-restore-test.mjs"))) {
    ok("D1 backup restore test script present");
  } else {
    fail("missing scripts/d1-backup-restore-test.mjs");
    issues += 1;
  }

  if (fileIncludes("supabase/config.toml", 'secret = "1x0000000000000000000000000000000AA"')) {
    warn("config.toml still has Turnstile TEST secret — run npm run setup:turnstile:all for production");
  } else {
    ok("config.toml Turnstile secret is not the Cloudflare test placeholder");
  }

  const audit = spawnSync("npm", ["audit", "--audit-level=high", "--json"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (audit.status === 0) ok("npm audit — no high/critical advisories");
  else {
    fail("npm audit reported high/critical issues — run npm audit");
    issues += 1;
  }

  if (prodProbe) {
    issues += await probeProductionCsp();
  }

  console.log("\nManual (CE evidence):");
  console.log("  · MFA screenshots → CE-2026-evidence/access/");
  console.log("  · npm run d1:backup:test-restore → CE-2026-evidence/backup/");
  console.log("  · npm run setup:turnstile:all (prod captcha)");
  console.log("  · DOCS/CE_EVIDENCE_CHECKLIST.md\n");

  if (issues) {
    console.log(`Security doctor: ${issues} issue(s).`);
    process.exit(1);
  }
  console.log("Security doctor passed (local checks).");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
