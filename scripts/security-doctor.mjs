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
import { CONTENT_SECURITY_POLICY } from "../src/config/contentSecurityPolicy.js";

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
    "supabase/migrations/20260711200000_supabase_linter_hardening.sql",
    "supabase/migrations/20260712230000_permit_notification_rate_limit.sql",
    "supabase/migrations/20260713020000_org_permits_rls_membership.sql",
    "supabase/migrations/20260716150000_org_invites_select_admin_only.sql",
    "supabase/migrations/20260716160000_user_module_guides_org_gate.sql",
    "supabase/migrations/20260716170000_org_invites_token_hash.sql",
    "supabase/migrations/20260716180000_edge_rate_buckets_invite_token_col.sql",
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

  if (fileIncludes("vercel.json", CONTENT_SECURITY_POLICY)) {
    ok("vercel.json CSP matches src/config/contentSecurityPolicy.js");
  } else {
    fail("vercel.json CSP drift — run npm run csp:sync");
    issues += 1;
  }

  if (fileIncludes("public/_headers", CONTENT_SECURITY_POLICY)) {
    ok("public/_headers CSP matches src/config/contentSecurityPolicy.js");
  } else {
    fail("public/_headers CSP drift — run npm run csp:sync");
    issues += 1;
  }

  if (fileIncludes("src/config/contentSecurityPolicy.js", "overpass-api.de")) {
    fail("canonical CSP still allows overpass-api.de — remove from config");
    issues += 1;
  } else {
    ok("canonical CSP omits direct overpass-api.de (use /api/overpass)");
  }

  if (
    fileIncludes("cloudflare/workers/d1-api/index.mjs", "user_can_delete_org_country_kv") ||
    fileIncludes("cloudflare/workers/d1-api/index.mjs", "user_can_delete_org_kv")
  ) {
    ok("D1 Worker checks delete permission RPC");
  } else {
    fail("D1 Worker missing delete permission gate");
    issues += 1;
  }

  if (
    fileIncludes("cloudflare/workers/d1-api/index.mjs", "user_can_write_org_country_kv") ||
    fileIncludes("cloudflare/workers/d1-api/index.mjs", "user_can_write_org_kv")
  ) {
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

  if (fileIncludes("cloudflare/workers/r2-upload/index.mjs", "org uploads require sign-in")) {
    ok("R2 Worker requires JWT for org-scoped uploads");
  } else {
    fail("R2 Worker missing org-scoped JWT gate");
    issues += 1;
  }

  if (fileIncludes("supabase/functions/send-permit-notification/index.ts", "buildRosterLinkedEmailSet")) {
    ok("Permit notification relay validates roster emails against permit people");
  } else {
    fail("Permit notification missing roster-linked recipient validation");
    issues += 1;
  }

  if (fileIncludes("api/anthropic-messages.js", "if (!sessionUser)")) {
    ok("Anthropic proxy requires Supabase session in production");
  } else {
    warn("Anthropic proxy may still allow bundled shared secret in production");
    issues += 1;
  }

  if (fileIncludes("api/postcode.js", "rejectIfRateLimited")) {
    ok("Postcode API routes are rate limited");
  } else {
    warn("Postcode API missing rate limits");
    issues += 1;
  }

  if (fileIncludes("cloudflare/workers/d1-api/index.mjs", "D1_RATE_LIMIT_FAIL_OPEN")) {
    ok("D1 Worker rate limits fail closed by default");
  } else {
    warn("D1 Worker may fail open when org_api_rate is missing");
    issues += 1;
  }

  if (fileIncludes("src/lib/supabase.js", "FALLBACK_SUPABASE") || fileIncludes("src/lib/supabase.js", "allowDevFallback")) {
    fail("Supabase client still embeds a hardcoded URL/anon fallback — remove it");
    issues += 1;
  } else {
    ok("Supabase client has no hardcoded URL/anon fallback");
  }

  if (
    fileIncludes("supabase/functions/send-permit-notification/index.ts", "enforceUserAndOrgEdgeRateLimits") ||
    fileIncludes("supabase/functions/send-permit-notification/index.ts", "enforceEdgeRateLimits") ||
    fileIncludes("supabase/functions/send-permit-notification/index.ts", "checkEdgeRateLimit")
  ) {
    ok("Permit notification Edge Function has isolate rate limit");
  } else {
    fail("Permit notification missing rate limit");
    issues += 1;
  }

  if (fileIncludes("supabase/functions/send-org-invite/index.ts", "&email=")) {
    fail("send-org-invite accept URL still embeds email= in the query string");
    issues += 1;
  } else {
    ok("send-org-invite accept URL omits email from query string");
  }

  if (fileIncludes("vite.config.js", "block-bundled-proxy-secrets-in-production")) {
    ok("Vite blocks VITE_AI_PROXY_SECRET / VITE_STORAGE_UPLOAD_TOKEN in production builds");
  } else {
    fail("Vite missing production ban for bundled proxy/upload secrets");
    issues += 1;
  }

  const cspPolicyBody = CONTENT_SECURITY_POLICY;

  if (/\bimg-src\b[^;]*\bhttps:(?!\/\/)/.test(cspPolicyBody)) {
    fail("CSP still allows any HTTPS image (bare img-src https:)");
    issues += 1;
  } else {
    ok("CSP img-src is host-pinned (no bare https:)");
  }

  if (cspPolicyBody.includes("https://*.workers.dev")) {
    fail("CSP still allows any workers.dev host — pin mysafeops Worker URLs");
    issues += 1;
  } else {
    ok("CSP connect-src pins Worker hosts (no *.workers.dev)");
  }

  if (fileIncludes("cloudflare/workers/d1-api/index.mjs", "kv_get:")) {
    ok("D1 Worker rate-limits KV GET");
  } else {
    warn("D1 Worker may not rate-limit KV GET");
    issues += 1;
  }

  if (
    fileIncludes("cloudflare/workers/r2-upload/index.mjs", "contentDisposition") &&
    fileIncludes("cloudflare/workers/r2-upload/index.mjs", "/signed") &&
    fileIncludes("cloudflare/workers/r2-upload/index.mjs", "/object")
  ) {
    ok("R2 Worker sets Content-Disposition and exposes auth/signed GET");
  } else {
    fail("R2 Worker missing Content-Disposition or authenticated/signed GET paths");
    issues += 1;
  }

  if (fileIncludes("supabase/functions/_shared/edgeRateLimit.ts", "enforceEdgeRateLimits")) {
    ok("Edge rate limit helper supports durable Postgres buckets");
  } else {
    fail("missing durable enforceEdgeRateLimits helper");
    issues += 1;
  }

  if (
    fileIncludes("supabase/functions/send-org-invite/index.ts", "invite_token: null") ||
    fileIncludes("supabase/functions/send-org-invite/index.ts", "invite_token:null")
  ) {
    ok("Invite email clears plaintext token after send");
  } else {
    fail("send-org-invite should clear invite_token after successful email");
    issues += 1;
  }

  if (fileIncludes("supabase/functions/dispatch-permit-webhook/index.ts", "validateOutboundWebhookUrl")) {
    ok("PTW webhook Edge Function validates outbound URLs");
  } else {
    fail("missing dispatch-permit-webhook Edge Function with SSRF validation");
    issues += 1;
  }

  if (fileIncludes("src/utils/permitWebhook.js", "dispatch-permit-webhook")) {
    ok("Client PTW webhooks prefer Edge dispatch");
  } else {
    warn("Client may still fan-out PTW webhooks only from the browser");
    issues += 1;
  }

  if (existsSync(resolve(root, "scripts/check-vite-circular-chunks.mjs"))) {
    ok("Circular-chunk CI guard script present");
  } else {
    fail("missing scripts/check-vite-circular-chunks.mjs");
    issues += 1;
  }

  if (fileIncludes("src/utils/webhookUrlValidation.js", "validateOutboundWebhookUrl")) {
    ok("PTW webhook URLs validated before save/dispatch");
  } else {
    fail("missing webhook URL validation helper");
    issues += 1;
  }

  if (fileIncludes("supabase/functions/_shared/corsHeaders.ts", "corsHeadersForRequest")) {
    ok("Edge Functions use site-restricted CORS helper");
  } else {
    fail("missing Edge Function CORS helper");
    issues += 1;
  }

  let wildcardCors = 0;
  for (const name of [
    "stripe-checkout",
    "stripe-portal",
    "stripe-webhook",
    "revoke-org-member-sessions",
    "permit-audit-export",
    "send-org-invite",
    "send-permit-notification",
    "send-permit-web-push",
    "push-subscription",
  ]) {
    if (fileIncludes(`supabase/functions/${name}/index.ts`, 'Access-Control-Allow-Origin": "*"')) {
      wildcardCors += 1;
    }
  }
  if (wildcardCors === 0) ok("Edge Functions no longer use wildcard ACAO");
  else {
    fail(`${wildcardCors} Edge Function(s) still use Access-Control-Allow-Origin: *`);
    issues += 1;
  }

  // Keep this readiness check aligned with the production-only, documented
  // allowlist enforced by audit:ci instead of applying a second audit policy.
  const audit = spawnSync(process.execPath, [resolve(root, "scripts/audit-ci.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  if (audit.status === 0) ok("npm audit policy passed (production dependencies)");
  else {
    if (audit.stderr) console.error(audit.stderr.trim());
    fail("npm audit policy reported unallowlisted high/critical issues — run npm run audit:ci");
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
