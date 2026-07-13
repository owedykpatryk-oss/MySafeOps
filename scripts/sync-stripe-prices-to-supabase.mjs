#!/usr/bin/env node
/**
 * Push STRIPE_PRICE_* ids to Supabase Edge secrets.
 * Reads from env (dotenv .env.local) or pass ids as CLI args.
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

const audStarter = pick("STRIPE_PRICE_STARTER_AUD");
const audTeam = pick("STRIPE_PRICE_TEAM_AUD");
const audBusiness = pick("STRIPE_PRICE_BUSINESS_AUD");
const audEnterprise = pick("STRIPE_PRICE_ENTERPRISE_AUD");

const plnStarter = pick("STRIPE_PRICE_STARTER_PLN");
const plnTeam = pick("STRIPE_PRICE_TEAM_PLN");
const plnBusiness = pick("STRIPE_PRICE_BUSINESS_PLN");
const plnEnterprise = pick("STRIPE_PRICE_ENTERPRISE_PLN");

if (![starter, team, business, enterprise].every((v) => v.startsWith("price_"))) {
  console.error("Missing valid STRIPE_PRICE_* GBP ids. Run npm run stripe:seed-prices first, or set env vars.");
  process.exit(1);
}

const secretPairs = {
  STRIPE_PRICE_STARTER: starter,
  STRIPE_PRICE_TEAM: team,
  STRIPE_PRICE_BUSINESS: business,
  STRIPE_PRICE_ENTERPRISE: enterprise,
};

if ([audStarter, audTeam, audBusiness, audEnterprise].every((v) => v.startsWith("price_"))) {
  secretPairs.STRIPE_PRICE_STARTER_AUD = audStarter;
  secretPairs.STRIPE_PRICE_TEAM_AUD = audTeam;
  secretPairs.STRIPE_PRICE_BUSINESS_AUD = audBusiness;
  secretPairs.STRIPE_PRICE_ENTERPRISE_AUD = audEnterprise;
} else if ([audStarter, audTeam, audBusiness, audEnterprise].some((v) => v)) {
  console.warn("Some STRIPE_PRICE_*_AUD ids missing — syncing GBP only. Run stripe:seed-prices and set all four AUD ids.");
} else {
  console.warn("No STRIPE_PRICE_*_AUD ids in env — syncing GBP only for AUD.");
}

if ([plnStarter, plnTeam, plnBusiness, plnEnterprise].every((v) => v.startsWith("price_"))) {
  secretPairs.STRIPE_PRICE_STARTER_PLN = plnStarter;
  secretPairs.STRIPE_PRICE_TEAM_PLN = plnTeam;
  secretPairs.STRIPE_PRICE_BUSINESS_PLN = plnBusiness;
  secretPairs.STRIPE_PRICE_ENTERPRISE_PLN = plnEnterprise;
} else if ([plnStarter, plnTeam, plnBusiness, plnEnterprise].some((v) => v)) {
  console.warn("Some STRIPE_PRICE_*_PLN ids missing — run stripe:seed-prices and set all four PLN ids.");
} else {
  console.warn("No STRIPE_PRICE_*_PLN ids in env — skipping PLN.");
}

console.log("Syncing Stripe price ids to Supabase Edge secrets…\n");
for (const [k, v] of Object.entries(secretPairs)) {
  console.log(`  ${k}=${v}`);
}

const args = ["supabase", "secrets", "set", ...Object.entries(secretPairs).map(([k, v]) => `${k}=${v}`)];

const r = spawnSync("npx", args, { stdio: "inherit", shell: true, cwd: resolve(__dirname, "..") });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log("\nDone. Run: npm run billing:doctor");
