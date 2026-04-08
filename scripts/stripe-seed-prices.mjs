#!/usr/bin/env node
/**
 * Creates Stripe Products + monthly GBP Prices for MySafeOps plans (Starter / Team / Business).
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

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const PLANS = [
  { planId: "starter", productName: "MySafeOps — Starter", amountPence: 1900 },
  { planId: "team", productName: "MySafeOps — Team", amountPence: 4900 },
  { planId: "business", productName: "MySafeOps — Business", amountPence: 9900 },
];

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

async function getOrCreatePrice(plan) {
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

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 30 });
  const existing = prices.data.find(
    (p) =>
      p.currency === "gbp" &&
      p.unit_amount === plan.amountPence &&
      p.recurring?.interval === "month"
  );
  if (existing) {
    console.log(`  Using existing price: ${existing.id}`);
    return { planId: plan.planId, priceId: existing.id, productId: product.id };
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: plan.amountPence,
    recurring: { interval: "month" },
    metadata: { mysafeops_plan_id: plan.planId },
  });
  console.log(`  Created price: ${created.id}`);
  return { planId: plan.planId, priceId: created.id, productId: product.id };
}

async function main() {
  const mode = SECRET.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`Stripe mode: ${mode}\n`);

  const rows = [];
  for (const plan of PLANS) {
    rows.push(await getOrCreatePrice(plan));
  }

  console.log("\n--- Add these to Supabase Edge Function secrets (and match Edge env names) ---\n");
  const map = {
    starter: "STRIPE_PRICE_STARTER",
    team: "STRIPE_PRICE_TEAM",
    business: "STRIPE_PRICE_BUSINESS",
  };
  for (const r of rows) {
    console.log(`${map[r.planId]}=${r.priceId}`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
