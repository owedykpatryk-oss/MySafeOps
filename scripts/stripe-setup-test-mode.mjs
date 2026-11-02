#!/usr/bin/env node
/**
 * One-shot Stripe TEST mode setup for QA (live keys unchanged).
 *
 * Requires in .env.local or an authenticated Stripe CLI session:
 *   STRIPE_SECRET_KEY_TEST=sk_test_... (or `stripe login`)
 * Optional:
 *   STRIPE_WEBHOOK_SECRET_TEST=whsec_...  (from Stripe Dashboard → Test mode → Webhooks)
 *
 * Run: npm run stripe:setup-test
 *
 * Creates test prices in GBP, PLN, AUD, EUR and CHF so every country workspace
 * can be rehearsed in test mode, pushes STRIPE_*_TEST secrets to Supabase Edge,
 * and registers a test webhook when the matching signing secret is unavailable.
 */
import { config } from "dotenv";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { billingProjectRef, preflightBillingSecrets, syncBillingSecrets } from "./lib/stripe-supabase-secrets.mjs";
import Stripe from "stripe";
import { AU_PLAN_AMOUNT_CENTS } from "../src/config/auPricing.js";
import { PL_PLAN_AMOUNT_GROSZE } from "../src/config/plPricing.js";
import { DE_PLAN_AMOUNT_CENTS } from "../src/config/dePricing.js";
import { CH_PLAN_AMOUNT_CENTS } from "../src/config/chPricing.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

function readStripeCliTestKey() {
  const cfgPath = join(homedir(), ".config", "stripe", "config.toml");
  if (!existsSync(cfgPath)) return null;
  const raw = readFileSync(cfgPath, "utf8");
  const key = raw.match(/test_mode_api_key = '([^']+)'/)?.[1]?.trim();
  const expires = raw.match(/test_mode_key_expires_at = '([^']+)'/)?.[1]?.trim();
  if (!key?.startsWith("sk_test_")) return null;
  if (expires) {
    const expiry = new Date(`${expires}T23:59:59Z`);
    if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) {
      console.warn(`Stripe CLI test key expired on ${expires}. Run: stripe login`);
      return null;
    }
  }
  return key;
}

const PLANS = [
  { planId: "starter", productName: "MySafeOps — Solo", amountPence: 3900 },
  { planId: "team", productName: "MySafeOps — Team", amountPence: 15900 },
  { planId: "business", productName: "MySafeOps — Business", amountPence: 34900 },
  { planId: "enterprise", productName: "MySafeOps — Enterprise", amountPence: 69900 },
];

/**
 * Country workspaces are billed independently in local currency, and checkout fails closed
 * when a market's price catalogue is incomplete. Test mode therefore needs the same five
 * currencies as live — otherwise the multi-country flow can only be rehearsed with real money.
 */
const TEST_MARKETS = [
  { suffix: "", currency: "gbp", amountFor: (plan) => plan.amountPence },
  { suffix: "_PLN", currency: "pln", amountFor: (plan) => PL_PLAN_AMOUNT_GROSZE[plan.planId] },
  { suffix: "_AUD", currency: "aud", amountFor: (plan) => AU_PLAN_AMOUNT_CENTS[plan.planId] },
  { suffix: "_EUR", currency: "eur", amountFor: (plan) => DE_PLAN_AMOUNT_CENTS[plan.planId] },
  { suffix: "_CHF", currency: "chf", amountFor: (plan) => CH_PLAN_AMOUNT_CENTS[plan.planId] },
];
const TEST_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
];

const TEST_SECRET = (process.env.STRIPE_SECRET_KEY_TEST || readStripeCliTestKey() || "").trim();
const TEST_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET_TEST?.trim();
let createdWebhookId = null;
let testWebhookId = null;
let replacedWebhookIds = [];
let billingSecretsSynced = false;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, "");

if (!TEST_SECRET?.startsWith("sk_test_")) {
  console.error(
    "Missing STRIPE_SECRET_KEY_TEST (sk_test_...) in .env.local.\n" +
      "Copy it from Stripe Dashboard → Developers → API keys → Test mode → Secret key.\n" +
      "Live checkout is unchanged; this only enables QA test buttons in Settings → Billing.",
  );
  process.exit(1);
}

const stripe = new Stripe(TEST_SECRET);

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

async function getOrCreateProduct(plan) {
  const product = await findProductByPlanId(plan.planId);
  if (product) {
    console.log(`Found test product ${plan.planId}: ${product.id}`);
    return product;
  }
  const created = await stripe.products.create({
    name: plan.productName,
    metadata: { mysafeops_plan_id: plan.planId },
  });
  console.log(`Created test product ${plan.planId}: ${created.id}`);
  return created;
}

async function getOrCreatePrice(product, plan, market) {
  const amount = market.amountFor(plan);
  if (!Number.isFinite(amount)) {
    throw new Error(`No ${market.currency.toUpperCase()} amount configured for plan ${plan.planId}`);
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const existing = prices.data.find(
    (p) => p.currency === market.currency && p.unit_amount === amount && p.recurring?.interval === "month",
  );
  if (existing) {
    console.log(`  Using existing ${market.currency.toUpperCase()} test price: ${existing.id}`);
    return existing.id;
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency: market.currency,
    unit_amount: amount,
    recurring: { interval: "month" },
    metadata: { mysafeops_plan_id: plan.planId, mysafeops_currency: market.currency },
  });
  console.log(`  Created ${market.currency.toUpperCase()} test price: ${created.id}`);
  return created.id;
}

async function ensureTestPortalConfiguration(products) {
  const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const current = existing.data.find((configuration) => configuration.metadata?.application === "mysafeops");
  const params = {
    business_profile: {
      headline: "Manage your MySafeOps subscription",
      privacy_policy_url: "https://www.mysafeops.com/privacy",
      terms_of_service_url: "https://www.mysafeops.com/terms",
    },
    default_return_url: "https://www.mysafeops.com/app?settingsTab=billing",
    features: {
      customer_update: { enabled: true, allowed_updates: ["name", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: {
          enabled: false,
          options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
        },
      },
      subscription_pause: { enabled: false },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "unchanged",
        trial_update_behavior: "end_trial",
        schedule_at_period_end: { conditions: [] },
        products,
      },
    },
    metadata: { application: "mysafeops" },
  };
  const configuration = current
    ? await stripe.billingPortal.configurations.update(current.id, params)
    : await stripe.billingPortal.configurations.create(params);
  console.log(`${current ? "Updated" : "Created"} MySafeOps test billing portal configuration: ${configuration.id}`);
  return configuration.id;
}

async function ensureTestWebhook() {
  if (!SUPABASE_URL) return null;

  const url = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const matches = existing.data.filter((w) => w.url === url && w.status !== "disabled");
  if (TEST_WEBHOOK?.startsWith("whsec_") && matches.length) {
    testWebhookId = matches[0].id;
    replacedWebhookIds = matches.slice(1).map((endpoint) => endpoint.id);
    return TEST_WEBHOOK;
  }

  const created = await stripe.webhookEndpoints.create({ url, enabled_events: TEST_WEBHOOK_EVENTS, api_version: "2023-10-16" });
  createdWebhookId = created.id;
  testWebhookId = created.id;
  console.log(`\nCreated test webhook endpoint: ${created.id}`);
  // Stripe does not reveal an endpoint's signing secret again after creation. When an
  // older endpoint exists but its secret is unavailable locally, replace it only after
  // the new secret has been stored in Supabase successfully. A failed setup leaves the
  // old endpoint intact and disables only this newly-created endpoint.
  replacedWebhookIds = matches.map((endpoint) => endpoint.id);
  const envPath = resolve(__dirname, "../.env.local");
  const raw = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = `STRIPE_WEBHOOK_SECRET_TEST=${created.secret}`;
  writeFileSync(envPath, /^STRIPE_WEBHOOK_SECRET_TEST=.*$/m.test(raw)
    ? raw.replace(/^STRIPE_WEBHOOK_SECRET_TEST=.*$/m, line) : `${raw.trimEnd()}\n${line}\n`);
  console.log("Saved signing secret in .env.local (value hidden).");
  return created.secret;
}

async function main() {
  console.log("Stripe TEST mode setup (live keys unchanged)\n");
  const projectRef = billingProjectRef(SUPABASE_URL);
  preflightBillingSecrets(projectRef);

  const secrets = { STRIPE_SECRET_KEY_TEST: TEST_SECRET };
  const portalProducts = [];
  for (const plan of PLANS) {
    const product = await getOrCreateProduct(plan);
    const prices = [];
    for (const market of TEST_MARKETS) {
      const priceId = await getOrCreatePrice(product, plan, market);
      secrets[`STRIPE_PRICE_${plan.planId.toUpperCase()}_TEST${market.suffix}`] = priceId;
      prices.push(priceId);
    }
    portalProducts.push({ product: product.id, prices });
  }
  secrets.STRIPE_PORTAL_CONFIGURATION_TEST = await ensureTestPortalConfiguration(portalProducts);

  const webhookSecret = await ensureTestWebhook();
  if (webhookSecret) secrets.STRIPE_WEBHOOK_SECRET_TEST = webhookSecret;

  console.log("\nPushing Supabase Edge secrets…");
  console.log(`  ${Object.keys(secrets).join(", ")} (values hidden)`);
  syncBillingSecrets(projectRef, secrets);
  billingSecretsSynced = true;
  await stripe.webhookEndpoints.update(testWebhookId, { disabled: false, enabled_events: TEST_WEBHOOK_EVENTS });
  for (const endpointId of replacedWebhookIds) {
    try {
      await stripe.webhookEndpoints.update(endpointId, { disabled: true });
    } catch (error) {
      console.warn(`Could not disable superseded test webhook ${endpointId}: ${error.message}`);
    }
  }

  console.log("\nTest checkout, webhook, prices and billing portal are configured.");
  console.log("Run node scripts/billing-doctor.mjs, then test the QA billing flow with a Stripe test card.");
  console.log("Live Subscribe buttons and live Stripe settings are unchanged.\n");
}

main().catch(async (e) => {
  if (createdWebhookId && !billingSecretsSynced) {
    try {
      await stripe.webhookEndpoints.update(createdWebhookId, { disabled: true });
      console.error(`Incomplete setup: disabled test webhook ${createdWebhookId}. Signing secret is saved locally for recovery.`);
    } catch {
      console.error(`Could not disable incomplete test webhook ${createdWebhookId}; review it in Stripe.`);
    }
  }
  console.error(e.message || e);
  process.exit(1);
});
