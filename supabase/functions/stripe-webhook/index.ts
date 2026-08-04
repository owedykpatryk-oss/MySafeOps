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
import { getBillingAdminUser, publicStripeHealthBody } from "../_shared/stripeHealthGet.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import {
  isCustomerOrgBindingMismatch,
  mapLegacyOrgStatus,
  mapStripeStatus,
  resolveWorkspaceStripeCustomerId,
  stripeUnixToIso,
} from "../_shared/stripeWebhookMapping.ts";

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

async function applySubscription(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
  livemode: boolean,
) {
  const metadataOrgId = sub.metadata?.org_id;
  const metadataWorkspaceId = sub.metadata?.workspace_id;
  let workspaceQuery = supabase
    .from("org_country_workspaces")
    .select("id, org_id, market_id, is_primary");
  workspaceQuery = metadataWorkspaceId
    ? workspaceQuery.eq("id", metadataWorkspaceId)
    : workspaceQuery.eq("org_id", metadataOrgId || "").eq("is_primary", true);
  const { data: workspace, error: workspaceErr } = await workspaceQuery.limit(1).maybeSingle();
  if (workspaceErr || !workspace?.id || (metadataOrgId && workspace.org_id !== metadataOrgId)) {
    console.warn("stripe-webhook: subscription without a valid country workspace", sub.id, workspaceErr);
    return;
  }
  const orgId = workspace.org_id;

  const priceId = sub.items.data[0]?.price?.id;
  const mapped = priceId ? planFromPriceId(priceId) : null;
  if (!mapped || mapped.market !== workspace.market_id) {
    console.error("stripe-webhook: unknown price or market/workspace mismatch — refusing entitlement", {
      subscriptionId: sub.id,
      workspaceId: workspace.id,
      workspaceMarket: workspace.market_id,
      priceMarket: mapped?.market ?? null,
    });
    return;
  }
  const plan = mapped.plan;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  // Defend against a subscription whose `metadata` doesn't actually belong to the Stripe
  // customer that owns it (metadata can be edited via the Stripe dashboard/API). The
  // binding is per country workspace, because each country bills its own customer — only
  // the primary workspace falls back to the legacy organisation-level customer.
  const { data: existingOrg, error: existingOrgErr } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id, stripe_test_customer_id")
    .eq("id", orgId)
    .maybeSingle();
  if (existingOrgErr || !existingOrg) {
    console.error("stripe-webhook: org not found for subscription", sub.id, orgId, existingOrgErr);
    return;
  }

  const stripeMode = livemode ? "live" : "test";
  const { data: existingBilling } = await supabase
    .from("org_country_workspace_subscriptions")
    .select("subscription_status, past_due_since, stripe_customer_id")
    .eq("workspace_id", workspace.id)
    .eq("stripe_mode", stripeMode)
    .maybeSingle();

  const boundCustomerId = resolveWorkspaceStripeCustomerId({
    workspaceCustomerId: existingBilling?.stripe_customer_id as string | null | undefined,
    orgCustomerId: livemode ? existingOrg.stripe_customer_id : existingOrg.stripe_test_customer_id,
    isPrimary: workspace.is_primary,
  });
  if (isCustomerOrgBindingMismatch(boundCustomerId, customerId)) {
    console.error(
      "stripe-webhook: customer/workspace binding mismatch — refusing to apply subscription",
      { subscriptionId: sub.id, orgId, workspaceId: workspace.id, boundCustomerId, customerId, livemode },
    );
    return;
  }

  const mappedStatus = mapStripeStatus(sub.status);
  const periodEnd = stripeUnixToIso(sub.current_period_end);
  const trialEnd = stripeUnixToIso(sub.trial_end);

  const row: Record<string, unknown> = {
    workspace_id: workspace.id,
    stripe_mode: stripeMode,
    market_id: workspace.market_id,
    currency: workspace.market_id === "pl" ? "PLN" : workspace.market_id === "au" ? "AUD" : "GBP",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: sub.id,
    subscription_status: mappedStatus,
    billing_plan: plan,
    stripe_price_id: priceId ?? null,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    stripe_trial_end: trialEnd,
  };

  if (mappedStatus === "past_due") {
    if (
      existingBilling?.subscription_status !== "past_due" ||
      !existingBilling?.past_due_since
    ) {
      row.past_due_since = new Date().toISOString();
    }
  } else {
    row.past_due_since = null;
  }

  if (sub.status === "canceled" || sub.status === "unpaid") {
    row.billing_plan = null;
  }

  const { error } = await supabase
    .from("org_country_workspace_subscriptions")
    .upsert(row, { onConflict: "workspace_id,stripe_mode" });
  if (error) {
    console.error("applySubscription workspace update error", error);
    return;
  }

  // Keep legacy organisation billing fields in sync for the primary workspace only.
  // A secondary country must never touch them: its customer id would overwrite the
  // primary binding, and its plan would leak into the organisation-wide entitlement.
  if (!workspace.is_primary) return;

  const legacyRow: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: mapLegacyOrgStatus(mappedStatus),
    billing_plan: row.billing_plan,
    stripe_current_period_end: periodEnd,
    stripe_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    stripe_trial_end: trialEnd,
    subscription_past_due_since: row.past_due_since,
    [livemode ? "stripe_customer_id" : "stripe_test_customer_id"]: customerId ?? null,
  };
  const { error: legacyErr } = await supabase.from("organizations").update(legacyRow).eq("id", orgId);
  if (legacyErr) console.error("applySubscription legacy mirror error", legacyErr);
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

/**
 * Secondary-country customers are never written to `organizations`, so a subscription
 * without workspace metadata is resolved from the workspace billing rows first.
 */
async function findWorkspaceIdByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string | null | undefined,
  stripeMode: "live" | "test",
): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from("org_country_workspace_subscriptions")
    .select("workspace_id")
    .eq("stripe_customer_id", customerId)
    .eq("stripe_mode", stripeMode)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("findWorkspaceIdByCustomerId error", error);
    return null;
  }
  return data?.workspace_id ?? null;
}

async function recordWebhookEvent(
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
  eventId: string,
) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error) console.error("markWebhookEventProcessed error", error);
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
  workspaceId: string,
  opts: { customerId?: string | null; livemode?: boolean } = {},
) {
  const stripeMode = opts.livemode === false ? "test" : "live";
  const { data: workspace, error: workspaceErr } = await supabase
    .from("org_country_workspaces")
    .select("id, org_id, is_primary")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceErr || !workspace?.id) {
    console.error("stripe-webhook: workspace not found for clearSubscription", workspaceId, workspaceErr);
    return;
  }

  if (opts.customerId) {
    const { data: existingBilling, error: existingBillingErr } = await supabase
      .from("org_country_workspace_subscriptions")
      .select("stripe_customer_id")
      .eq("workspace_id", workspaceId)
      .eq("stripe_mode", stripeMode)
      .maybeSingle();
    if (existingBillingErr) {
      console.error("stripe-webhook: billing not found for clearSubscription", workspaceId, existingBillingErr);
      return;
    }
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("stripe_customer_id, stripe_test_customer_id")
      .eq("id", workspace.org_id)
      .maybeSingle();
    const boundCustomerId = resolveWorkspaceStripeCustomerId({
      workspaceCustomerId: existingBilling?.stripe_customer_id as string | null | undefined,
      orgCustomerId: stripeMode === "live" ? existingOrg?.stripe_customer_id : existingOrg?.stripe_test_customer_id,
      isPrimary: workspace.is_primary,
    });
    if (isCustomerOrgBindingMismatch(boundCustomerId, opts.customerId)) {
      console.error(
        "stripe-webhook: customer/workspace binding mismatch — refusing to clear subscription",
        { workspaceId, boundCustomerId, customerId: opts.customerId, stripeMode },
      );
      return;
    }
  }

  const { error } = await supabase
    .from("org_country_workspace_subscriptions")
    .update({
      stripe_subscription_id: null,
      subscription_status: "canceled",
      billing_plan: null,
      stripe_price_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_trial_end: null,
      past_due_since: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("stripe_mode", stripeMode);
  if (error) console.error("clearSubscription error", error);

  if (workspace.is_primary) {
    const { error: legacyErr } = await supabase
      .from("organizations")
      .update({
        stripe_subscription_id: null,
        subscription_status: "canceled",
        billing_plan: null,
        stripe_current_period_end: null,
        stripe_cancel_at_period_end: false,
        stripe_trial_end: null,
        subscription_past_due_since: null,
      })
      .eq("id", workspace.org_id);
    if (legacyErr) console.error("clearSubscription legacy mirror error", legacyErr);
  }
}

function constructStripeEvent(
  body: string,
  sig: string,
): { event: Stripe.Event; mode: StripeMode; stripe: Stripe } {
  const attempts: StripeMode[] = ["live", "test"];
  let lastError: unknown = null;

  for (const mode of attempts) {
    const secretKey = Deno.env.get(mode === "test" ? "STRIPE_SECRET_KEY_TEST" : "STRIPE_SECRET_KEY")?.trim() ?? "";
    const webhookSecret = Deno.env.get(mode === "test" ? "STRIPE_WEBHOOK_SECRET_TEST" : "STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
    if (!isValidStripeSecret(secretKey) || !isValidWebhookSecret(webhookSecret)) continue;
    const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" });
    try {
      const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      return { event, mode, stripe };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invalid payload");
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
    const liveReady = diagnostics.stripeLive.configured && diagnostics.stripeLive.configuredMap.webhookSecret;
    const testReady = diagnostics.stripeTest.configured && diagnostics.stripeTest.configuredMap.webhookSecret;
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    const admin = await getBillingAdminUser(req, supabaseUrl, serviceKey);
    if (!admin) {
      const publicBody = publicStripeHealthBody("stripe-webhook", liveReady && allValid, testReady, requestId);
      return new Response(JSON.stringify(publicBody), {
        status: liveReady && allValid ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    return new Response(
      JSON.stringify({
        ...diagnostics,
        liveReady,
        testReady,
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
      retry: eventStore === "pending_retry",
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
        let workspaceId = sub.metadata?.workspace_id ?? null;
        if (!workspaceId) {
          workspaceId = await findWorkspaceIdByCustomerId(
            supabase,
            customerId,
            event.livemode ? "live" : "test",
          );
        }
        if (!workspaceId) {
          const orgId = sub.metadata?.org_id ?? (await findOrgIdByCustomerId(supabase, customerId));
          if (orgId) {
            const { data: primaryWorkspace } = await supabase
              .from("org_country_workspaces")
              .select("id")
              .eq("org_id", orgId)
              .eq("is_primary", true)
              .maybeSingle();
            workspaceId = primaryWorkspace?.id ?? null;
          }
        }
        if (workspaceId) {
          await clearSubscription(supabase, workspaceId, {
            customerId,
            livemode: event.livemode ?? false,
          });
        }
        break;
      }
      default:
        break;
    }
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
