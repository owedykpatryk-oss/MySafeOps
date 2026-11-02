#!/usr/bin/env node
// Dry run by default. Preflight Supabase permissions before creating any Stripe endpoint.
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import { billingProjectRef, preflightBillingSecrets, syncBillingSecrets } from "./lib/stripe-supabase-secrets.mjs";
import { AU_PLAN_AMOUNT_CENTS } from "../src/config/auPricing.js";
import { PL_PLAN_AMOUNT_GROSZE } from "../src/config/plPricing.js";
import { DE_PLAN_AMOUNT_CENTS } from "../src/config/dePricing.js";
import { CH_PLAN_AMOUNT_CENTS } from "../src/config/chPricing.js";

const envPath = new URL("../.env.local", import.meta.url);
config({ path: envPath });
const testMode = process.argv.includes("--test");
const mode = testMode ? "test" : "live";
const suffix = testMode ? "_TEST" : "";
const key = process.env[`STRIPE_SECRET_KEY${suffix}`]?.trim();
const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
const projectRef = billingProjectRef(url);
if (!new RegExp(`^(sk|rk)_${mode}_`).test(key || "")) throw new Error(`A ${mode} Stripe API key is required`);
const stripe = new Stripe(key, { timeout: 15000, maxNetworkRetries: 1 });
const events = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed", "invoice.paid", "invoice.payment_failed", "invoice.payment_action_required"];

async function main() {
  const secrets = { [`STRIPE_SECRET_KEY${suffix}`]: key };
  for (const [currency, priceSuffix, amounts] of [
    ["gbp", "", { starter: 3900, team: 15900, business: 34900, enterprise: 69900 }],
    ["aud", "_AUD", AU_PLAN_AMOUNT_CENTS], ["pln", "_PLN", PL_PLAN_AMOUNT_GROSZE],
    ["eur", "_EUR", DE_PLAN_AMOUNT_CENTS], ["chf", "_CHF", CH_PLAN_AMOUNT_CENTS],
  ]) {
    for (const [plan, amount] of Object.entries(amounts)) {
      const name = `STRIPE_PRICE_${plan.toUpperCase()}${suffix}${priceSuffix}`;
      const id = process.env[name]?.trim();
      if (!id?.startsWith("price_")) throw new Error(`Missing ${name}`);
      const price = await stripe.prices.retrieve(id);
      if (!price.active || price.livemode !== !testMode || price.currency !== currency || price.unit_amount !== amount || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) {
        throw new Error(`Price differs from the app catalogue: ${name}`);
      }
      secrets[name] = id;
    }
  }
  const hooks = [];
  for await (const hook of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (hook.url === `${url}/functions/v1/stripe-webhook`) hooks.push(hook);
  }
  if (hooks.length > 1) throw new Error("Multiple matching webhooks exist; reconcile them before setup");
  console.log(`${mode}: 20 prices verified; MySafeOps webhook ${hooks.length ? "exists" : "missing"}.`);
  if (!process.argv.includes("--apply")) {
    console.log("Dry run only. Use --apply to register the webhook and sync this mode's keys and prices.");
    return;
  }
  preflightBillingSecrets(projectRef);
  const signingKey = `STRIPE_WEBHOOK_SECRET${suffix}`;
  let hook = hooks[0];
  let created = false;
  try {
    if (hook) {
      if (!process.env[signingKey]?.startsWith("whsec_")) throw new Error(`Set the existing endpoint's ${signingKey} in .env.local before syncing`);
    } else {
      hook = await stripe.webhookEndpoints.create({ url: `${url}/functions/v1/stripe-webhook`, enabled_events: events, api_version: "2023-10-16", metadata: { application: "mysafeops" } }, { idempotencyKey: `mysafeops-webhook:${projectRef}:${mode}` });
      created = true;
      // Persist immediately for recovery, without printing the signing secret.
      const raw = readFileSync(envPath, "utf8");
      const pattern = new RegExp(`^${signingKey}=.*$`, "m");
      const line = `${signingKey}=${hook.secret}`;
      writeFileSync(envPath, pattern.test(raw) ? raw.replace(pattern, line) : `${raw.trimEnd()}\n${line}\n`);
      process.env[signingKey] = hook.secret;
    }
    secrets[signingKey] = process.env[signingKey];
    syncBillingSecrets(projectRef, secrets);
    await stripe.webhookEndpoints.update(hook.id, { disabled: false, enabled_events: events });
    console.log(`Configured ${mode} webhook ${hook.id} and synced 20 prices to ${projectRef}. Verify a test purchase and delivery before declaring payments ready.`);
  } catch (error) {
    if (created) {
      await stripe.webhookEndpoints.update(hook.id, { disabled: true });
      console.error(`Setup incomplete; new webhook ${hook.id} was disabled. Its signing secret is saved locally for retry.`);
    }
    throw error;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
