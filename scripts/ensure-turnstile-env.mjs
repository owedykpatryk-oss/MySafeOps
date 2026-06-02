#!/usr/bin/env node
/**
 * Ensures VITE_TURNSTILE_SITE_KEY exists in .env.local (Cloudflare test key for local dev).
 * Run: node scripts/ensure-turnstile-env.mjs
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");
const envExample = resolve(root, ".env.local.example");
const TEST_SITE_KEY = "1x00000000000000000000AA";
const KEY = "VITE_TURNSTILE_SITE_KEY";
const block = [
  "",
  "# --- Cloudflare Turnstile (Supabase Auth → Bot protection; secret only in Supabase) ---",
  `# Cloudflare test key (always passes). Production: replace with your site key.`,
  `${KEY}=${TEST_SITE_KEY}`,
  "",
].join("\n");

if (!existsSync(envLocal)) {
  if (existsSync(envExample)) {
    copyFileSync(envExample, envLocal);
    console.log("Created .env.local from .env.local.example");
  } else {
    writeFileSync(envLocal, `# MySafeOps local env\n${block}`, "utf8");
    console.log("Created minimal .env.local");
    process.exit(0);
  }
}

const raw = readFileSync(envLocal, "utf8");
if (new RegExp(`^${KEY}=`, "m").test(raw)) {
  console.log(`${KEY} already present in .env.local`);
  process.exit(0);
}

writeFileSync(envLocal, raw.replace(/\s*$/, "") + block, "utf8");
console.log(`Added ${KEY} (Cloudflare test site key) to .env.local`);
console.log("Enable Turnstile in Supabase Dashboard → Authentication → Bot and Abuse Protection.");
console.log("For supabase start: see supabase/config.toml [auth.captcha] (test secret).");
