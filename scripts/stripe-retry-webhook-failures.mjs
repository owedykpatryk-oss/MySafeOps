#!/usr/bin/env node
/**
 * Retry pending Stripe webhook failures by re-fetching events from Stripe
 * and re-applying billing mutations to organizations.
 *
 * Required env (.env.local or shell):
 * - STRIPE_SECRET_KEY
 * - VITE_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 * - STRIPE_RETRY_LIMIT (default: 25)
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const retryLimit = Number(process.env.STRIPE_RETRY_LIMIT || 25);

if (!stripeSecret || !stripeSecret.startsWith("sk_")) {
  console.error("Missing or invalid STRIPE_SECRET_KEY (expected sk_...)");
  process.exit(1);
}
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const stripe = new Stripe(stripeSecret);
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function planFromPriceId(priceId) {
  const p = String(priceId || "").trim();
  const s = (process.env.STRIPE_PRICE_STARTER || "").trim();
  const t = (process.env.STRIPE_PRICE_TEAM || "").trim();
  const b = (process.env.STRIPE_PRICE_BUSINESS || "").trim();
  if (s && p === s) return "starter";
  if (t && p === t) return "team";
  if (b && p === b) return "business";
  return null;
}

function mapStripeStatus(status) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "unpaid") return "unpaid";
  return "none";
}

async function findOrgIdByCustomerId(customerId) {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`findOrgIdByCustomerId failed: ${error.message}`);
  return data?.id ?? null;
}

async function applySubscription(sub) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const orgId = sub.metadata?.org_id || (await findOrgIdByCustomerId(customerId));
  if (!orgId) throw new Error(`No org_id mapping for subscription ${sub.id}`);

  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? planFromPriceId(priceId) : null;
  const row = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId || null,
    subscription_status: mapStripeStatus(sub.status),
    billing_plan: sub.status === "canceled" || sub.status === "unpaid" ? null : plan,
  };

  const { error } = await supabase.from("organizations").update(row).eq("id", orgId);
  if (error) throw new Error(`applySubscription update failed: ${error.message}`);
}

async function clearSubscription(sub) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const orgId = sub.metadata?.org_id || (await findOrgIdByCustomerId(customerId));
  if (!orgId) throw new Error(`No org_id mapping for deletion event (${sub.id})`);
  const { error } = await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: null,
      subscription_status: "canceled",
      billing_plan: null,
    })
    .eq("id", orgId);
  if (error) throw new Error(`clearSubscription update failed: ${error.message}`);
}

async function processEvent(event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subId = session.subscription;
      if (typeof subId === "string") {
        const sub = await stripe.subscriptions.retrieve(subId);
        await applySubscription(sub);
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await applySubscription(event.data.object);
      return;
    case "customer.subscription.deleted":
      await clearSubscription(event.data.object);
      return;
    default:
      return;
  }
}

async function markResolved(failureId) {
  const { error } = await supabase
    .from("stripe_webhook_failures")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: "resolved by stripe:retry-webhooks",
    })
    .eq("id", failureId);
  if (error) throw new Error(`markResolved failed: ${error.message}`);
}

async function markFailedRetry(failureId, message) {
  const { data: current, error: fetchErr } = await supabase
    .from("stripe_webhook_failures")
    .select("retry_count")
    .eq("id", failureId)
    .single();
  if (fetchErr) throw new Error(`retry_count fetch failed: ${fetchErr.message}`);
  const { error } = await supabase
    .from("stripe_webhook_failures")
    .update({
      retry_count: Number(current?.retry_count || 0) + 1,
      last_error: message,
      last_retry_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", failureId);
  if (error) throw new Error(`markFailedRetry failed: ${error.message}`);
}

async function main() {
  const { data: failures, error } = await supabase
    .from("stripe_webhook_failures")
    .select("id, event_id, event_type, retry_count, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(Math.max(1, retryLimit));
  if (error) throw new Error(`Could not load pending failures: ${error.message}`);

  if (!failures?.length) {
    console.log("No pending webhook failures.");
    return;
  }

  console.log(`Retrying ${failures.length} pending webhook failure(s)...`);

  let resolved = 0;
  let stillFailing = 0;
  for (const row of failures) {
    try {
      const event = await stripe.events.retrieve(row.event_id);
      await processEvent(event);
      await markResolved(row.id);
      resolved += 1;
      console.log(`- resolved ${row.event_id} (${row.event_type})`);
    } catch (e) {
      stillFailing += 1;
      const message = e instanceof Error ? e.message : String(e);
      await markFailedRetry(row.id, message);
      console.log(`- failed ${row.event_id}: ${message}`);
    }
  }

  console.log(`Done. resolved=${resolved}, still_failing=${stillFailing}`);
  if (stillFailing > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
