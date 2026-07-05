import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  hasLiveStripeConfig,
  hasTestStripeConfig,
  isValidStripeSecret,
  isValidWebhookSecret,
  planFromPriceId,
  resolveStripeConfig,
  stripeDiagnostics,
  type StripeMode,
} from "../_shared/stripeConfig.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

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

function mapStripeStatus(status: string): "none" | "active" | "trialing" | "past_due" | "canceled" | "unpaid" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return status;
    default:
      return "none";
  }
}

async function applySubscription(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
  livemode: boolean,
) {
  const orgId = sub.metadata?.org_id;
  if (!orgId) {
    console.warn("stripe-webhook: subscription without org_id metadata", sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id;
  const mapped = priceId ? planFromPriceId(priceId) : null;
  const plan = mapped?.plan ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  const row: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: mapStripeStatus(sub.status),
    billing_plan: plan,
  };

  if (livemode) {
    row.stripe_customer_id = customerId ?? null;
  } else {
    row.stripe_test_customer_id = customerId ?? null;
  }

  if (sub.status === "canceled" || sub.status === "unpaid") {
    row.billing_plan = null;
  }

  const { error } = await supabase.from("organizations").update(row).eq("id", orgId);
  if (error) console.error("applySubscription update error", error);
}

async function findOrgIdByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .or(`stripe_customer_id.eq.${customerId},stripe_test_customer_id.eq.${customerId}`)
    .maybeSingle();
  if (error) {
    console.error("findOrgIdByCustomerId error", error);
    return null;
  }
  return data?.id ?? null;
}

async function recordWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<"inserted" | "duplicate" | "failed"> {
  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode ?? false,
  });
  if (!error) return "inserted";
  if (error.code === "23505") return "duplicate";
  console.error("recordWebhookEvent error", error);
  return "failed";
}

async function recordWebhookFailure(
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
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
  if (error) console.error("markWebhookFailureResolved error", error);
}

async function buildDiagnostics(
  supabase: ReturnType<typeof createClient> | null,
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

async function clearSubscription(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
) {
  const { error } = await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: null,
      subscription_status: "canceled",
      billing_plan: null,
    })
    .eq("id", orgId);
  if (error) console.error("clearSubscription error", error);
}

function constructStripeEvent(
  body: string,
  sig: string,
): { event: Stripe.Event; mode: StripeMode; stripe: Stripe } {
  const attempts: StripeMode[] = ["live", "test"];
  let lastError: unknown = null;

  for (const mode of attempts) {
    const config = resolveStripeConfig(mode);
    if (!config?.webhookSecret) continue;
    const stripe = new Stripe(config.secretKey, { apiVersion: "2023-10-16" });
    try {
      const event = stripe.webhooks.constructEvent(body, sig, config.webhookSecret);
      return { event, mode, stripe };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invalid payload");
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
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
    const liveReady = diagnostics.stripeLive.configured && diagnostics.stripeLive.configuredMap.webhookSecret;
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    return new Response(
      JSON.stringify({
        ...diagnostics,
        liveReady,
        testReady: diagnostics.stripeTest.configured && diagnostics.stripeTest.configuredMap.webhookSecret,
      }),
      {
        status: liveReady && allValid ? 200 : 503,
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

  if (!hasLiveStripeConfig() || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  const liveWebhook = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
  if (!isValidStripeSecret(Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "") || !isValidWebhookSecret(liveWebhook)) {
    return new Response(JSON.stringify({ error: "Webhook secret format invalid" }), {
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
    const parsed = constructStripeEvent(body, sig);
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
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = session.subscription;
        if (typeof subId === "string") {
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(supabase, sub, event.livemode ?? false);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(supabase, sub, event.livemode ?? false);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const orgId = sub.metadata?.org_id ?? (await findOrgIdByCustomerId(supabase, customerId));
        if (orgId) await clearSubscription(supabase, orgId);
        break;
      }
      default:
        break;
    }
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
