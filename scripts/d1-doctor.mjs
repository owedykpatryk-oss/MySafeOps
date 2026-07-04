#!/usr/bin/env node
/**
 * D1 Worker readiness: health, remote schema, wrangler secrets, backup cron worker.
 * Usage: npm run d1:doctor
 */
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");
const workerDir = resolve(root, "cloudflare", "workers", "d1-api");

if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}

const base = String(process.env.VITE_D1_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function wrangler(args, { cwd = root } = {}) {
  return spawnSync("npx", ["wrangler@3", ...args], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

function parseWranglerJson(stdout) {
  const text = String(stdout || "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function checkHealth() {
  if (!base) {
    return { ok: false, detail: "VITE_D1_API_URL not set in .env.local" };
  }
  try {
    const res = await fetch(`${base}/v1/health`, { headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    const refPol = res.headers.get("referrer-policy") || "";
    const nosniff = res.headers.get("x-content-type-options") || "";
    const headersOk =
      /strict-origin-when-cross-origin/i.test(refPol) && /nosniff/i.test(nosniff);
    return {
      ok: res.ok && body?.ok === true,
      detail: res.ok ? `${res.status} ${JSON.stringify(body)}` : `${res.status}`,
      headersOk,
    };
  } catch (e) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

function checkRemoteTables() {
  const sqlFile = resolve(root, "scripts", "d1-doctor-tables.sql");
  const r = wrangler(["d1", "execute", "mysafeops-d1", "--remote", `--file=${sqlFile}`, "--json"]);
  if (r.status !== 0) {
    return { ok: false, detail: (r.stderr || r.stdout || "d1 execute failed").trim().slice(0, 200) };
  }
  const data = parseWranglerJson(r.stdout);
  if (!data) return { ok: false, detail: "invalid JSON from wrangler d1 execute" };

  const names = (data?.[0]?.results || [])
    .map((row) => row.name)
    .filter(Boolean);
  if (names.length) {
    const missing = ["org_sync_kv", "org_audit_log"].filter((t) => !names.includes(t));
    return {
      ok: missing.length === 0,
      detail: missing.length ? `missing tables: ${missing.join(", ")}` : names.join(", "),
    };
  }

  const tableCount = Number(data?.[0]?.meta?.num_tables);
  if (Number.isFinite(tableCount) && tableCount >= 2) {
    return { ok: true, detail: "org_sync_kv, org_audit_log" };
  }
  return {
    ok: false,
    detail: Number.isFinite(tableCount)
      ? `expected 2 core tables, got ${tableCount}`
      : "could not verify remote schema",
  };
}

function checkSecrets() {
  const r = wrangler(["secret", "list"], { cwd: workerDir });
  if (r.status !== 0) {
    return { ok: false, detail: (r.stderr || r.stdout || "secret list failed").trim().slice(0, 200) };
  }
  const data = parseWranglerJson(r.stdout);
  if (!data) return { ok: false, detail: "invalid JSON from wrangler secret list" };
  const names = (Array.isArray(data) ? data : []).map((s) => s.name);
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "AUDIT_CHAIN_SECRET"];
  const missing = required.filter((n) => !names.includes(n));
  return {
    ok: missing.length === 0,
    detail: missing.length ? `missing secrets: ${missing.join(", ")}` : required.join(", "),
  };
}

function checkBackupWorker() {
  const r = wrangler(["deployments", "list", "--name", "mysafeops-d1-backup"], { cwd: root });
  if (r.status !== 0) {
    return { ok: false, detail: (r.stderr || r.stdout || "deployments list failed").trim().slice(0, 160) };
  }
  const hasDeployment = /Created:/.test(r.stdout || "");
  return {
    ok: hasDeployment,
    detail: hasDeployment ? "mysafeops-d1-backup deployed (cron 03:00 UTC)" : "no deployments found",
  };
}

async function main() {
  console.log("D1 doctor\n");
  let issues = 0;

  const health = await checkHealth();
  console.log(`${health.ok ? "✓" : "✗"} /v1/health — ${health.detail}`);
  if (health.ok && health.headersOk === false) {
    console.log("  ⚠ security headers incomplete (Referrer-Policy / X-Content-Type-Options)");
    issues += 1;
  }
  if (!health.ok) issues += 1;

  const tables = checkRemoteTables();
  console.log(`${tables.ok ? "✓" : "✗"} remote schema — ${tables.detail}`);
  if (!tables.ok) issues += 1;

  const secrets = checkSecrets();
  console.log(`${secrets.ok ? "✓" : "✗"} wrangler secrets — ${secrets.detail}`);
  if (!secrets.ok) {
    issues += 1;
    console.log("  → npm run d1:secrets   (add AUDIT_CHAIN_SECRET to .env.local first)");
  }

  const backup = checkBackupWorker();
  console.log(`${backup.ok ? "✓" : "✗"} backup worker — ${backup.detail}`);
  if (!backup.ok) {
    issues += 1;
    console.log("  → npm run d1:deploy:backup");
  }

  console.log("");
  if (issues) {
    console.log(`D1 doctor: ${issues} issue(s) — see DOCS/D1_SETUP.md`);
    process.exit(1);
  }
  console.log("D1 doctor passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
