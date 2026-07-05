#!/usr/bin/env node
/**
 * One-shot Stripe TEST mode setup for QA (live keys unchanged).
 *
 * Requires in .env.local:
 *   STRIPE_SECRET_KEY_TEST=sk_test_...
 * Optional:
 *   STRIPE_WEBHOOK_SECRET_TEST=whsec_...  (from Stripe Dashboard → Test mode → Webhooks)
 *
 * Run: npm run stripe:setup-test
 *
 * Creates test prices (same GBP amounts as live), pushes STRIPE_*_TEST secrets to Supabase Edge,
 * and prints webhook setup instructions if test webhook secret is missing.
 */
import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import Stripe from "stripe";

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
  { planId: "starter", productName: "MySafeOps — Solo", amountPence: 1900 },
  { planId: "team", productName: "MySafeOps — Team", amountPence: 9900 },
  { planId: "business", productName: "MySafeOps — Business", amountPence: 24900 },
  { planId: "enterprise", productName: "MySafeOps — Enterprise", amountPence: 49900 },
];

const TEST_SECRET = (process.env.STRIPE_SECRET_KEY_TEST || readStripeCliTestKey() || "").trim();
const TEST_WEBHOOK = process.env.STRIPE_WEBHOOK_SECRET_TEST?.trim();
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

async function getOrCreatePrice(plan) {
  let product = await findProductByPlanId(plan.planId);
  if (!product) {
    product = await stripe.products.create({
      name: plan.productName,
      metadata: { mysafeops_plan_id: plan.planId },
    });
    console.log(`Created test product ${plan.planId}: ${product.id}`);
  } else {
    console.log(`Found test product ${plan.planId}: ${product.id}`);
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 30 });
  const existing = prices.data.find(
    (p) => p.currency === "gbp" && p.unit_amount === plan.amountPence && p.recurring?.interval === "month",
  );
  if (existing) {
    console.log(`  Using existing test price: ${existing.id}`);
    return existing.id;
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: plan.amountPence,
    recurring: { interval: "month" },
    metadata: { mysafeops_plan_id: plan.planId },
  });
  console.log(`  Created test price: ${created.id}`);
  return created.id;
}

async function ensureTestWebhook() {
  if (TEST_WEBHOOK?.startsWith("whsec_")) return TEST_WEBHOOK;
  if (!SUPABASE_URL) return null;

  const url = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
  const events = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((w) => w.url === url && w.status !== "disabled");
  if (match) {
    console.warn(
      `\nTest webhook endpoint already exists (${match.id}) but STRIPE_WEBHOOK_SECRET_TEST is not in .env.local.`,
    );
    console.warn("Reveal the signing secret in Stripe Dashboard → Developers → Webhooks (Test mode) and add:");
    console.warn("  STRIPE_WEBHOOK_SECRET_TEST=whsec_...");
    return null;
  }

  const created = await stripe.webhookEndpoints.create({ url, enabled_events: events });
  console.log(`\nCreated test webhook endpoint: ${created.id}`);
  console.log(`STRIPE_WEBHOOK_SECRET_TEST=${created.secret}`);
  return created.secret;
}

async function main() {
  console.log("Stripe TEST mode setup (live keys unchanged)\n");

  const priceIds = {};
  for (const plan of PLANS) {
    priceIds[plan.planId] = await getOrCreatePrice(plan);
  }

  const webhookSecret = await ensureTestWebhook();

  const secrets = {
    STRIPE_SECRET_KEY_TEST: TEST_SECRET,
    STRIPE_PRICE_STARTER_TEST: priceIds.starter,
    STRIPE_PRICE_TEAM_TEST: priceIds.team,
    STRIPE_PRICE_BUSINESS_TEST: priceIds.business,
    STRIPE_PRICE_ENTERPRISE_TEST: priceIds.enterprise,
  };
  if (webhookSecret) secrets.STRIPE_WEBHOOK_SECRET_TEST = webhookSecret;

  console.log("\nPushing Supabase Edge secrets…");
  for (const [k, v] of Object.entries(secrets)) {
    console.log(`  ${k}=${v}`);
  }

  const args = ["supabase", "secrets", "set", ...Object.entries(secrets).map(([k, v]) => `${k}=${v}`)];
  const r = spawnSync("npx", args, { stdio: "inherit", shell: true, cwd: resolve(__dirname, "..") });
  if (r.status !== 0) process.exit(r.status ?? 1);

  console.log("\nNext steps:");
  console.log("  1. Deploy Edge Functions: npx supabase functions deploy stripe-checkout stripe-portal stripe-webhook");
  console.log("  2. Apply migration: npx supabase db push  (stripe_test_customer_id column)");
  console.log("  3. Redeploy Vercel with VITE_STRIPE_ALLOW_TEST_CHECKOUT=true (or use platform-owner login)");
  console.log("  4. Settings → Billing → QA section → Test Solo with card 4242 4242 4242 4242");
  console.log("\nLive Subscribe buttons remain on production Stripe.\n");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
