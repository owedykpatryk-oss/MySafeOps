#!/usr/bin/env node
/** Push prod Turnstile secret from .env.local to Supabase, then revert config.toml test secret. */
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const configPath = resolve(root, "supabase/config.toml");

dotenv.config({ path: resolve(root, ".env.local") });

const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
const testSecret = "1x0000000000000000000000000000000AA";

if (!secret || secret === testSecret) {
  console.error("Missing prod TURNSTILE_SECRET_KEY in .env.local");
  process.exit(1);
}

const raw = readFileSync(configPath, "utf8");
const marker = `secret = "${testSecret}"`;
if (!raw.includes(marker)) {
  console.error("config.toml test secret marker not found — aborting");
  process.exit(1);
}

writeFileSync(configPath, raw.replace(marker, `secret = "${secret}"`), "utf8");
const r = spawnSync(
  "npx",
  ["supabase", "config", "push", "--project-ref", "burgpzankkqvpcmdkhro", "--yes"],
  { cwd: root, stdio: "inherit", shell: true }
);
writeFileSync(configPath, raw, "utf8");

if (r.status !== 0) process.exit(r.status ?? 1);
console.log("Prod Turnstile secret restored on Supabase (config.toml reverted).");
