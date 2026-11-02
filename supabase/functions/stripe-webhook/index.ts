import { constructStripeEvent } from "../_shared/stripeWebhookSignature.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@14.21.0";
import {
  hasLiveStripeConfig,
  hasTestStripeConfig,
  isValidWebhookSecret,
  resolveStripeMode,
  stripeDiagnostics,
} from "../_shared/stripeConfig.ts";
import { getBillingAdminUser, publicStripeHealthBody } from "../_shared/stripeHealthGet.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { processStripeEvent } from "../_shared/stripeSubscriptionSync.ts";

type Diagnostics = {
  function: string;
  deployed: boolean;
  stripeLive: ReturnType<typeof stripeDiagnostics>;
  stripeTest: ReturnType<typeof stripeDiagnostics>;
  configured: {
    stripeSecretKey: boolean;
    stripeWebhookSecret: boolean;
    stripeTestSecretKey: boolean;
    stripeTestWebhookSecret: boolean;
    supabaseUrl: boolean;
    serviceRoleKey: boolean;
  };
  valid: {
    stripeSecretKeyFormat: boolean;
    stripeWebhookSecretFormat: boolean;
  };
  lastProcessedAt: string | null;
  pendingFailures: number | null;
  requestId: string;
};

async function recordWebhookEvent(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<"inserted" | "duplicate" | "pending_retry" | "failed"> {
  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode ?? false,
    processed_at: null,
  });
  if (!error) return "inserted";
  if (error.code === "23505") {
    const { data: existing, error: selErr } = await supabase
      .from("stripe_webhook_events")
      .select("processed_at")
      .eq("event_id", event.id)
      .maybeSingle();
    if (selErr) {
      console.error("recordWebhookEvent duplicate lookup error", selErr);
      return "failed";
    }
    // Prior attempt inserted the id then failed before stamping processed_at — allow retry.
    if (!existing?.processed_at) return "pending_retry";
    return "duplicate";
  }
  console.error("recordWebhookEvent error", error);
  return "failed";
}

async function markWebhookEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error) throw new Error(`Could not mark webhook processed: ${error.message}`);
}

async function recordWebhookFailure(
  supabase: SupabaseClient,
  event: Stripe.Event,
  errorMessage: string,
) {
  const { data, error: existingErr } = await supabase
    .from("stripe_webhook_failures")
    .select("retry_count")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existingErr) {
    console.error("recordWebhookFailure existing lookup error", existingErr);
    return;
  }
  const currentRetry = Number(data?.retry_count || 0);

  const { error } = await supabase.from("stripe_webhook_failures").upsert(
    {
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      last_error: errorMessage,
      retry_count: currentRetry + 1,
      status: "pending",
      last_retry_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (error) console.error("recordWebhookFailure upsert error", error);
}

async function markWebhookFailureResolved(
  supabase: SupabaseClient,
  eventId: string,
) {
  const { error } = await supabase
    .from("stripe_webhook_failures")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
  if (error) throw new Error(`Could not resolve webhook failure: ${error.message}`);
}

async function buildDiagnostics(
  supabase: SupabaseClient | null,
  requestId: string,
): Promise<Diagnostics> {
  const live = stripeDiagnostics("live");
  const test = stripeDiagnostics("test");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

  const diagnostics: Diagnostics = {
    function: "stripe-webhook",
    deployed: true,
    stripeLive: live,
    stripeTest: test,
    configured: {
      stripeSecretKey: hasLiveStripeConfig(),
      stripeWebhookSecret: live.configuredMap.webhookSecret,
      stripeTestSecretKey: hasTestStripeConfig(),
      stripeTestWebhookSecret: test.configuredMap.webhookSecret,
      supabaseUrl: Boolean(supabaseUrl),
      serviceRoleKey: Boolean(serviceKey),
    },
    valid: {
      stripeSecretKeyFormat: live.validMap.secretKeyFormat,
      stripeWebhookSecretFormat: live.validMap.webhookSecretFormat,
    },
    lastProcessedAt: null,
    pendingFailures: null,
    requestId,
  };

  if (supabase) {
    const { data: lastEvent, error: lastEventErr } = await supabase
      .from("stripe_webhook_events")
      .select("processed_at")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastEventErr) diagnostics.lastProcessedAt = lastEvent?.processed_at ?? null;

    const { count, error: countErr } = await supabase
      .from("stripe_webhook_failures")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (!countErr) diagnostics.pendingFailures = count ?? 0;
  }

  return diagnostics;
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const corsHeaders = {
    ...corsHeadersForRequest(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-request-id",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  if (req.method === "GET") {
    const diagnostics = await buildDiagnostics(supabase, requestId);
    const liveReady = Boolean(supabase) && hasLiveStripeConfig() && isValidWebhookSecret(Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() ?? "");
    const testReady = Boolean(supabase) && hasTestStripeConfig() && isValidWebhookSecret(Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST")?.trim() ?? "");
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    const activeMode = supabase ? await resolveStripeMode(supabase).catch(() => null) : null;
    const activeReady = activeMode !== null && (activeMode === "test" ? testReady : liveReady && allValid);
    const admin = await getBillingAdminUser(req, supabaseUrl, serviceKey);
    if (!admin) {
      const publicBody = { ...publicStripeHealthBody("stripe-webhook", liveReady && allValid, testReady, requestId), activeMode, activeReady };
      return new Response(JSON.stringify(publicBody), {
        status: activeReady ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    return new Response(
      JSON.stringify({
        ...diagnostics,
        liveReady,
        testReady,
        activeMode,
        activeReady,
      }),
      {
        status: activeReady ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  if ((!hasLiveStripeConfig() && !hasTestStripeConfig()) || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  if (!supabase) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  let event: Stripe.Event;
  let stripe: Stripe;
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    const parsed = await constructStripeEvent(Stripe, body, sig);
    event = parsed.event;
    stripe = parsed.stripe;
  } catch (e) {
    console.error("stripe-webhook invalid payload", { requestId, error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  try {
    const eventStore = await recordWebhookEvent(supabase, event);
    if (eventStore === "duplicate") {
      await markWebhookFailureResolved(supabase, event.id);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    if (eventStore === "failed") {
      return new Response(JSON.stringify({ error: "Could not persist webhook event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    console.log("stripe-webhook event", {
      requestId,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode ?? false,
      retry: eventStore === "pending_retry",
    });

    await processStripeEvent(supabase, stripe, event);
    await markWebhookEventProcessed(supabase, event.id);
    await markWebhookFailureResolved(supabase, event.id);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("stripe-webhook handler failed", { requestId, error: errorMessage });
    if (event) {
      await recordWebhookFailure(supabase, event, errorMessage);
    }
    return new Response(JSON.stringify({ error: "Handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
  });
});
