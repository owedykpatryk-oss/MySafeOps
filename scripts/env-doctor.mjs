#!/usr/bin/env node
/**
 * Read-only checklist for `.env.local` — never prints secret values.
 * Run: npm run env:check
 */
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envLocal = resolve(root, ".env.local");

if (!existsSync(envLocal)) {
  console.log("env:check — no .env.local found.");
  console.log("  Copy .env.local.example → .env.local and fill values (file is gitignored).\n");
  process.exit(0);
}

dotenv.config({ path: envLocal });
const raw = readFileSync(envLocal, "utf8");

function set(key) {
  const v = process.env[key];
  return Boolean(v && String(v).trim());
}

const keyCounts = new Map();
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (!m) continue;
  const k = m[1];
  keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
}

const viteRows = [
  ["VITE_SUPABASE_URL", "Supabase project URL"],
  ["VITE_SUPABASE_ANON_KEY", "Supabase anon (public) key"],
  ["VITE_VAPID_PUBLIC_KEY", "Web Push public key — pair with Supabase secrets VAPID_*"],
  ["VITE_STORAGE_API_URL", "R2 upload Worker URL (optional)"],
  ["VITE_STORAGE_UPLOAD_TOKEN", "Worker upload token (optional)"],
  ["VITE_R2_PUBLIC_BASE_URL", "Public object base URL (optional)"],
  ["VITE_ANTHROPIC_API_KEY", "AI modules — exposed in browser bundle; dev/local only"],
  ["VITE_ANTHROPIC_MODEL", "Anthropic model id (optional)"],
  ["VITE_OPENWEATHER_API_KEY", "RAMS weather — optional; else Open-Meteo"],
  ["VITE_APP_VERSION", "Optional display version in Help / about"],
  ["VITE_PUBLIC_SITE_URL", "Canonical site origin for OG, RSS, sitemap (set per Vercel Preview host when testing)"],
  ["VITE_BLOG_POSTS_BASE_URL", "Optional base URL for blog markdown assets / canonical links"],
  ["VITE_STRIPE_PUBLISHABLE_KEY", "Optional Stripe publishable key for Stripe.js in the browser (never secret keys)"],
];

const cliRows = [
  ["STRIPE_SECRET_KEY", "Local `npm run stripe:seed-prices` — production: Supabase Edge secrets only"],
  ["STRIPE_WEBHOOK_SECRET", "Stripe webhook signing secret (Supabase in prod)"],
  ["GOOGLE_OAUTH_CLIENT_ID", "Google provider — configure in Supabase Dashboard"],
  ["GOOGLE_OAUTH_CLIENT_SECRET", "Google provider — Supabase Dashboard only"],
];

console.log("MySafeOps — env:check (.env.local)\n");
console.log("Vite / frontend (VITE_* is embedded in the client bundle if set):\n");
for (const [k, desc] of viteRows) {
  const ok = set(k);
  console.log(`  ${ok ? "✓" : "·"} ${k.padEnd(30)} ${desc}`);
}

console.log("\nCLI / server-side vars (not prefixed with VITE_ — not bundled by Vite):\n");
for (const [k, desc] of cliRows) {
  const ok = set(k);
  console.log(`  ${ok ? "✓" : "·"} ${k.padEnd(30)} ${desc}`);
}

const hygiene = [];
if (/^VAPID_PRIVATE_KEY=/m.test(raw)) {
  hygiene.push("Remove VAPID_PRIVATE_KEY from .env.local — store only in Supabase → Edge Functions → Secrets.");
}
if (/STRIPE_SECRET_KEY=sk_live_/m.test(raw)) {
  hygiene.push("STRIPE_SECRET_KEY uses a live (sk_live_) key in .env.local — prefer sk_test_* locally; production → Supabase Edge secrets only.");
}
if (/NEXT_PUBLIC_/m.test(raw)) {
  hygiene.push('NEXT_PUBLIC_* is a Next.js convention. This app is Vite — use VITE_* only where the code reads it.');
}
for (const [k, n] of keyCounts) {
  if (n > 1) hygiene.push(`Duplicate key "${k}" (${n} assignments) — keep a single line.`);
}
if (set("VITE_ANTHROPIC_API_KEY")) {
  hygiene.push("VITE_ANTHROPIC_API_KEY is shipped to browsers — do not use for production traffic without a proxy.");
}

console.log("\nHygiene / security:\n");
if (hygiene.length === 0) {
  console.log("  (no issues flagged)\n");
} else {
  for (const msg of hygiene) {
    console.log(`  ⚠ ${msg}\n`);
  }
}

console.log("Done. Address any items above, then restart `npm run dev`.\n");
