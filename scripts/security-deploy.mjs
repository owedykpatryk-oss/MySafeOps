#!/usr/bin/env node
/**
 * Apply security migrations to Supabase + D1 + redeploy Worker.
 * Usage: npm run security:deploy
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const workerDir = resolve(root, "cloudflare", "workers", "d1-api");

function run(cmd, args, { cwd = root, label } = {}) {
  console.log(`\n→ ${label || [cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`\n✗ Failed: ${label || cmd}`);
    process.exit(r.status ?? 1);
  }
}

console.log("Security deploy — Supabase + D1\n");

run("npx", ["supabase", "db", "push", "--yes"], { label: "Supabase db push" });
run("npx", ["supabase", "config", "push", "--yes"], { label: "Supabase config push (auth)" });
run(
  "npx",
  ["wrangler@3", "d1", "execute", "mysafeops-d1", "--remote", "--file=schema/0003_audit_rate_limit_idx.sql", "--config", "wrangler.toml"],
  { cwd: workerDir, label: "D1 index migration" },
);
run(
  "npx",
  ["wrangler@3", "d1", "execute", "mysafeops-d1", "--remote", "--file=schema/0004_org_api_rate.sql", "--config", "wrangler.toml"],
  { cwd: workerDir, label: "D1 org_api_rate table" },
);
run("npm", ["run", "d1:deploy"], { label: "D1 Worker deploy" });
run("npx", ["supabase", "functions", "deploy", "revoke-org-member-sessions", "--yes"], {
  label: "Supabase Edge — revoke-org-member-sessions",
});
run("npm", ["run", "security:doctor"], { label: "Security doctor" });

console.log("\n✓ Security deploy complete.");
