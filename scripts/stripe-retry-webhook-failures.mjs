#!/usr/bin/env node
/** Replay pending events through the deployed handler; never bypass country billing. */
import { config } from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { replayStripeEvent } from "../shared/stripeWebhookReplay.mjs";

config({ path: new URL("../.env.local", import.meta.url) });
config({ path: new URL("../.env", import.meta.url) });
const baseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!baseUrl || !serviceKey) throw new Error("Supabase URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const supabase = createClient(baseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: failures, error } = await supabase.from("stripe_webhook_failures")
    .select("event_id, payload, created_at").eq("status", "pending")
    .order("created_at", { ascending: true }).limit(Math.max(1, Math.min(100, Number(process.env.STRIPE_RETRY_LIMIT) || 25)));
  if (error) throw new Error("Could not load pending webhook failures: " + error.message);
  let failed = 0;
  for (const failure of failures || []) {
    try {
      const live = failure.payload?.livemode;
      if (typeof live !== "boolean") throw new Error("Stored event has no billing mode");
      const suffix = live ? "" : "_TEST";
      const key = process.env["STRIPE_SECRET_KEY" + suffix];
      if (!new RegExp("^(sk|rk)_" + (live ? "live" : "test") + "_").test(key || "")) throw new Error("Matching Stripe API key is required");
      await replayStripeEvent({
        stripe: new Stripe(key), eventId: failure.event_id,
        webhookSecret: process.env["STRIPE_WEBHOOK_SECRET" + suffix],
        endpoint: baseUrl + "/functions/v1/stripe-webhook",
      });
      console.log("Resolved " + failure.event_id);
    } catch (error) {
      failed += 1;
      console.error("Failed " + failure.event_id + ": " + error.message);
    }
  }
  console.log("Replay complete: " + ((failures?.length || 0) - failed) + " resolved, " + failed + " failed.");
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
