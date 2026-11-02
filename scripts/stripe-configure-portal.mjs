#!/usr/bin/env node
import { config } from "dotenv";
import Stripe from "stripe";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });
const testMode = process.argv.includes("--test");
const key = process.env[testMode ? "STRIPE_SECRET_KEY_TEST" : "STRIPE_SECRET_KEY"];
const mode = testMode ? "test" : "live";
if (!new RegExp(`^(sk|rk)_${mode}_`).test(key || "")) throw new Error(`A ${mode} Stripe key is required`);
const stripe = new Stripe(key);
const existing = [];
for await (const row of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
  if (row.metadata?.application === "mysafeops") existing.push(row);
}
if (existing.length) {
  console.log(`MySafeOps ${mode} portal already configured: ${existing[0].id}`);
} else if (!process.argv.includes("--apply")) {
  console.log(`Missing MySafeOps ${mode} portal. Use --apply to create its dedicated configuration.`);
} else {
  const products = new Map();
  for (const suffix of ["", "_AUD", "_PLN", "_EUR", "_CHF"]) {
    for (const plan of ["STARTER", "TEAM", "BUSINESS", "ENTERPRISE"]) {
      const id = process.env[`STRIPE_PRICE_${plan}${testMode ? "_TEST" : ""}${suffix}`];
      if (!id) continue;
      const price = await stripe.prices.retrieve(id);
      if (!price.active || price.livemode === testMode) throw new Error(`Invalid price for ${plan}${suffix}`);
      const product = typeof price.product === "string" ? price.product : price.product.id;
      if (!products.has(product)) products.set(product, []);
      products.get(product).push(price.id);
    }
  }
  if (!products.size) throw new Error("No configured product prices");
  const portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your MySafeOps subscription", privacy_policy_url: "https://www.mysafeops.com/privacy", terms_of_service_url: "https://www.mysafeops.com/terms" },
    default_return_url: "https://www.mysafeops.com/app?settingsTab=billing",
    metadata: { application: "mysafeops" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["name", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: { enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations", products: [...products].map(([product, prices]) => ({ product, prices })) },
    },
  }, { idempotencyKey: `mysafeops-portal-${mode}-v1` });
  console.log(`Created dedicated MySafeOps ${mode} portal: ${portal.id}`);
}
