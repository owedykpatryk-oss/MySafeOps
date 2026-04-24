#!/usr/bin/env node
/**
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.local
 * and runs `wrangler secret put` for the D1 API worker (no values printed).
 *
 * Usage (from repo root):
 *   node scripts/set-d1-wrangler-secrets.mjs
 * Requires: wrangler logged in, cloudflare/workers/d1-api/wrangler.toml
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");
const workerDir = resolve(root, "cloudflare", "workers", "d1-api");

function parseEnvFile(raw) {
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function putSecret(name, value) {
  if (!value) {
    console.error(`Missing ${name} in .env.local — aborting.`);
    process.exit(1);
  }
  const r = spawnSync("npx", ["wrangler@3", "secret", "put", name], {
    cwd: workerDir,
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`wrangler secret put ${name} failed with code`, r.status);
    process.exit(1);
  }
  console.log(`Set secret: ${name} (value hidden)`);
}

if (!existsSync(envPath)) {
  console.error("No .env.local found at", envPath);
  process.exit(1);
}

const env = parseEnvFile(readFileSync(envPath, "utf8"));
const url = (env.VITE_SUPABASE_URL || "").trim();
const anon = (env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anon) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local");
  process.exit(1);
}

putSecret("SUPABASE_URL", url);
putSecret("SUPABASE_ANON_KEY", anon);
console.log("Done. Run: npx wrangler@3 deploy (in cloudflare/workers/d1-api) if you need to re-bind after secrets.");
