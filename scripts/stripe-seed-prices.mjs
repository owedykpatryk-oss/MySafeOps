#!/usr/bin/env node
/**
 * Creates Stripe Products + monthly Prices for MySafeOps plans (GBP + AUD + PLN).
 * Idempotent: reuses products/prices found by metadata `mysafeops_plan_id`.
 *
 * Requires in .env.local (or env):
 *   STRIPE_SECRET_KEY=sk_test_... or sk_live_...
 *
 * Run: npm run stripe:seed-prices
 *
 * Copy printed STRIPE_PRICE_* values into Supabase Edge Function secrets (not VITE_*).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { AU_PLAN_AMOUNT_CENTS, stripeEnvKeyForAuPlan } from "../src/config/auPricing.js";
import { PL_PLAN_AMOUNT_GROSZE, stripeEnvKeyForPlPlan } from "../src/config/plPricing.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const PLANS = [
  { planId: "starter", productName: "MySafeOps — Solo", gbpPence: 1900, audCents: AU_PLAN_AMOUNT_CENTS.starter, plnGrosze: PL_PLAN_AMOUNT_GROSZE.starter },
  { planId: "team", productName: "MySafeOps — Team", gbpPence: 9900, audCents: AU_PLAN_AMOUNT_CENTS.team, plnGrosze: PL_PLAN_AMOUNT_GROSZE.team },
  { planId: "business", productName: "MySafeOps — Business", gbpPence: 24900, audCents: AU_PLAN_AMOUNT_CENTS.business, plnGrosze: PL_PLAN_AMOUNT_GROSZE.business },
  { planId: "enterprise", productName: "MySafeOps — Enterprise", gbpPence: 49900, audCents: AU_PLAN_AMOUNT_CENTS.enterprise, plnGrosze: PL_PLAN_AMOUNT_GROSZE.enterprise },
];

const GBP_ENV = {
  starter: "STRIPE_PRICE_STARTER",
  team: "STRIPE_PRICE_TEAM",
  business: "STRIPE_PRICE_BUSINESS",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

const SECRET = process.env.STRIPE_SECRET_KEY?.trim();
if (!SECRET) {
  console.error("Missing STRIPE_SECRET_KEY. Add it to .env.local (not committed) and retry.");
  process.exit(1);
}

const stripe = new Stripe(SECRET);

async function findProductByPlanId(planId) {
  let startingAfter;
  for (;;) {
    const page = await stripe.products.list({ limit: 100, active: true, starting_after: startingAfter });
    const found = page.data.find((p) => p.metadata?.mysafeops_plan_id === planId);
    if (found) return found;
    if (!page.has_more) return null;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

async function getOrCreatePrice(product, planId, currency, unitAmount) {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 30 });
  const existing = prices.data.find(
    (p) =>
      p.currency === currency &&
      p.unit_amount === unitAmount &&
      p.recurring?.interval === "month"
  );
  if (existing) {
    console.log(`  Using existing ${currency.toUpperCase()} price: ${existing.id}`);
    return existing.id;
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency,
    unit_amount: unitAmount,
    recurring: { interval: "month" },
    metadata: { mysafeops_plan_id: planId, mysafeops_currency: currency },
  });
  console.log(`  Created ${currency.toUpperCase()} price: ${created.id}`);
  return created.id;
}

async function seedPlan(plan) {
  let product = await findProductByPlanId(plan.planId);

  if (!product) {
    product = await stripe.products.create({
      name: plan.productName,
      metadata: { mysafeops_plan_id: plan.planId },
    });
    console.log(`Created product ${plan.planId}: ${product.id}`);
  } else {
    console.log(`Found product ${plan.planId}: ${product.id}`);
  }

  const gbpPriceId = await getOrCreatePrice(product, plan.planId, "gbp", plan.gbpPence);
  const audPriceId = await getOrCreatePrice(product, plan.planId, "aud", plan.audCents);
  const plnPriceId = await getOrCreatePrice(product, plan.planId, "pln", plan.plnGrosze);
  return { planId: plan.planId, gbpPriceId, audPriceId, plnPriceId, productId: product.id };
}

async function main() {
  const mode = SECRET.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`Stripe mode: ${mode}\n`);

  const rows = [];
  for (const plan of PLANS) {
    rows.push(await seedPlan(plan));
  }

  console.log("\n--- GBP — Supabase Edge Function secrets ---\n");
  for (const r of rows) {
    console.log(`${GBP_ENV[r.planId]}=${r.gbpPriceId}`);
  }

  console.log("\n--- AUD — Supabase Edge Function secrets ---\n");
  for (const r of rows) {
    console.log(`${stripeEnvKeyForAuPlan(r.planId)}=${r.audPriceId}`);
  }

  console.log("\n--- PLN — Supabase Edge Function secrets ---\n");
  for (const r of rows) {
    console.log(`${stripeEnvKeyForPlPlan(r.planId)}=${r.plnPriceId}`);
  }

  console.log("\nAlso append AUD/PLN ids to .env.local, then: npm run stripe:sync-secrets");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
