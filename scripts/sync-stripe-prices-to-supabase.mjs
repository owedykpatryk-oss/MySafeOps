#!/usr/bin/env node
/**
 * Push STRIPE_PRICE_* ids to Supabase Edge secrets.
 * Reads from env (dotenv .env.local) or pass ids as CLI args.
 *
 * Production ids (2026-06-27, GBP monthly live):
 *   Solo £19  → price_1TK4hc6vtl4fJGcOl1WJZjqr
 *   Team £99  → price_1TmvuN6vtl4fJGcOHRojXyLd
 *   Business £249 → price_1TmvuN6vtl4fJGcOxhyOK8Z8
 *   Enterprise £499 → price_1TmvuN6vtl4fJGcOh6mSwEuA
 *
 * Run after: npm run stripe:seed-prices
 *   npm run stripe:sync-secrets
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const DEFAULTS = {
  STRIPE_PRICE_STARTER: "price_1TK4hc6vtl4fJGcOl1WJZjqr",
  STRIPE_PRICE_TEAM: "price_1TmvuN6vtl4fJGcOHRojXyLd",
  STRIPE_PRICE_BUSINESS: "price_1TmvuN6vtl4fJGcOxhyOK8Z8",
  STRIPE_PRICE_ENTERPRISE: "price_1TmvuN6vtl4fJGcOh6mSwEuA",
};

function pick(key) {
  return (process.env[key] || DEFAULTS[key] || "").trim();
}

const starter = pick("STRIPE_PRICE_STARTER");
const team = pick("STRIPE_PRICE_TEAM");
const business = pick("STRIPE_PRICE_BUSINESS");
const enterprise = pick("STRIPE_PRICE_ENTERPRISE");

if (![starter, team, business, enterprise].every((v) => v.startsWith("price_"))) {
  console.error("Missing valid STRIPE_PRICE_* ids. Run npm run stripe:seed-prices first, or set env vars.");
  process.exit(1);
}

console.log("Syncing Stripe price ids to Supabase Edge secrets…\n");
for (const [k, v] of Object.entries({ STRIPE_PRICE_STARTER: starter, STRIPE_PRICE_TEAM: team, STRIPE_PRICE_BUSINESS: business, STRIPE_PRICE_ENTERPRISE: enterprise })) {
  console.log(`  ${k}=${v}`);
}

const args = [
  "supabase",
  "secrets",
  "set",
  `STRIPE_PRICE_STARTER=${starter}`,
  `STRIPE_PRICE_TEAM=${team}`,
  `STRIPE_PRICE_BUSINESS=${business}`,
  `STRIPE_PRICE_ENTERPRISE=${enterprise}`,
];

const r = spawnSync("npx", args, { stdio: "inherit", shell: true, cwd: resolve(__dirname, "..") });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log("\nDone. Run: npm run billing:doctor");
