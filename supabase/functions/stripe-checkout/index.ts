import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  hasLiveStripeConfig,
  hasTestStripeConfig,
  isValidSiteUrl,
  priceForPlan,
  resolveStripeConfig,
  stripeDiagnostics,
  stripeMarketReady,
  type StripePricePlanId,
} from "../_shared/stripeConfig.ts";
import { getBillingAdminUser, publicStripeHealthBody } from "../_shared/stripeHealthGet.ts";
import { enforceEdgeRateLimits, enforceUserAndOrgEdgeRateLimits } from "../_shared/edgeRateLimit.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { resolveBillingMembership } from "../_shared/resolveBillingMembership.ts";
import { resolveWorkspaceStripeCustomerId } from "../_shared/stripeWebhookMapping.ts";

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const corsHeaders = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    const live = stripeDiagnostics("live");
    const test = stripeDiagnostics("test");
    const diagnostics = {
      function: "stripe-checkout",
      deployed: true,
      stripeLive: live,
      stripeTest: test,
      marketBilling: {
        uk: stripeMarketReady("live", "uk"),
        au: stripeMarketReady("live", "au"),
        pl: stripeMarketReady("live", "pl"),
      },
      configured: {
        stripeSecretKey: hasLiveStripeConfig(),
        stripePriceStarter: live.configuredMap.priceStarter,
        stripePriceTeam: live.configuredMap.priceTeam,
        stripePriceBusiness: live.configuredMap.priceBusiness,
        stripePriceEnterprise: live.configuredMap.priceEnterprise,
        siteUrl: Boolean(siteUrl),
        supabaseUrl: Boolean(supabaseUrl),
        serviceRoleKey: Boolean(serviceKey),
      },
      valid: {
        stripeSecretKeyFormat: live.validMap.secretKeyFormat,
        stripePriceStarterFormat: live.validMap.priceStarterFormat,
        stripePriceTeamFormat: live.validMap.priceTeamFormat,
        stripePriceBusinessFormat: live.validMap.priceBusinessFormat,
        stripePriceEnterpriseFormat: live.validMap.priceEnterpriseFormat,
        siteUrlFormat: !siteUrl || isValidSiteUrl(siteUrl),
      },
      requestId,
    };
    const liveReady = hasLiveStripeConfig() && Object.values(diagnostics.marketBilling).some(Boolean);
    const testReady = hasTestStripeConfig() && (["uk", "pl", "au"] as const).some((market) => stripeMarketReady("test", market));
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    const admin = await getBillingAdminUser(req, supabaseUrl, serviceKey);
    if (!admin) {
      const publicBody = publicStripeHealthBody("stripe-checkout", liveReady && allValid, testReady, requestId);
      return new Response(JSON.stringify(publicBody), {
        status: liveReady && allValid ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    return new Response(JSON.stringify({ ...diagnostics, liveReady, testReady }), {
      status: liveReady && allValid ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }

  try {
    const siteUrl = (Deno.env.get("SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");
    if (!isValidSiteUrl(siteUrl)) {
      return new Response(JSON.stringify({ error: "SITE_URL invalid. Expected absolute http(s) URL." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const body = await req.json().catch(() => ({}));
    const planId = body?.planId as StripePricePlanId | undefined;
    const testMode = Boolean(body?.testMode);
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
    const orgSlug = typeof body?.orgSlug === "string" ? body.orgSlug : null;
    if (!planId || !["starter", "team", "business", "enterprise"].includes(planId)) {
      return new Response(JSON.stringify({ error: "planId must be starter, team, business, or enterprise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const mem = await resolveBillingMembership(supabase, user.id, orgSlug);

    const rateOk = mem?.org_id
      ? await enforceUserAndOrgEdgeRateLimits(supabase, {
          userKey: `stripe-checkout:${user.id}`,
          orgKey: `stripe-checkout:org:${mem.org_id}`,
          userMax: 12,
          orgMax: 20,
          windowMs: 60_000,
          failClosed: true,
        })
      : await enforceEdgeRateLimits(supabase, `stripe-checkout:${user.id}`, 12, 60_000, { failClosed: true });
    if (!rateOk) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    if (!mem?.org_id) {
      return new Response(JSON.stringify({ error: "No organisation membership" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    if (mem.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only organisation admins can manage billing" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const { data: workspace, error: workspaceErr } = await supabase
      .from("org_country_workspaces")
      .select("id, org_id, market_id, enabled, is_primary")
      .eq("id", workspaceId)
      .eq("org_id", mem.org_id)
      .maybeSingle();
    if (workspaceErr || !workspace?.id || !workspace.enabled) {
      return new Response(JSON.stringify({ error: "Country workspace is not available for this organisation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const market = workspace.market_id as "uk" | "pl" | "au";
    const stripeMode = testMode ? "test" : "live";
    const stripeConfig = resolveStripeConfig(stripeMode, market);
    if (!stripeConfig) {
      return new Response(
        JSON.stringify({ error: `Stripe ${stripeMode} prices are not fully configured for ${market.toUpperCase()}. Checkout is blocked to prevent charging in the wrong currency.` }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const priceId = priceForPlan(stripeConfig, planId);
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `The ${planId} price is not configured for ${market.toUpperCase()}.` }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const { data: existingWorkspaceBilling } = await supabase
      .from("org_country_workspace_subscriptions")
      .select("stripe_subscription_id, subscription_status, stripe_customer_id")
      .eq("workspace_id", workspace.id)
      .eq("stripe_mode", stripeMode)
      .maybeSingle();
    if (
      existingWorkspaceBilling?.stripe_subscription_id &&
      ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(
        String(existingWorkspaceBilling.subscription_status || ""),
      )
    ) {
      return new Response(JSON.stringify({ error: "This country already has a subscription. Use Manage billing to change or pay it." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, stripe_test_customer_id")
      .eq("id", mem.org_id)
      .single();

    if (orgErr || !org?.id) {
      return new Response(JSON.stringify({ error: "Organisation not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const orgId = org.id;
    const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2023-10-16" });
    const customerColumn = testMode ? "stripe_test_customer_id" : "stripe_customer_id";
    const currency = market === "pl" ? "PLN" : market === "au" ? "AUD" : "GBP";

    // Stripe locks a customer to the currency of its first subscription, so every country
    // workspace bills its own customer. Only the primary workspace inherits the existing
    // organisation customer, which keeps current UK subscribers on their billing history.
    let customerId = resolveWorkspaceStripeCustomerId({
      workspaceCustomerId: existingWorkspaceBilling?.stripe_customer_id as string | null | undefined,
      orgCustomerId: org[customerColumn] as string | null,
      isPrimary: workspace.is_primary,
    });

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          org_id: orgId,
          workspace_id: workspace.id,
          market,
          currency,
          stripe_mode: stripeConfig.mode,
        },
      });
      customerId = customer.id;
      // The organisation column stays the primary country's binding only; a secondary
      // country must never repoint it, or the webhook would reject its subscription.
      if (workspace.is_primary) {
        const { error: upErr } = await supabase
          .from("organizations")
          .update({ [customerColumn]: customerId })
          .eq("id", orgId);
        if (upErr) {
          console.error("stripe-checkout update customer failed", { requestId, orgId, testMode, error: upErr });
          return new Response(JSON.stringify({ error: "Could not save Stripe customer" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
          });
        }
      }
    }

    const { error: billingSeedErr } = await supabase
      .from("org_country_workspace_subscriptions")
      .upsert(
        {
          workspace_id: workspace.id,
          stripe_mode: stripeMode,
          market_id: market,
          currency,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          billing_plan: planId,
        },
        { onConflict: "workspace_id,stripe_mode" },
      );
    if (billingSeedErr) {
      console.error("stripe-checkout seed workspace billing failed", { requestId, workspaceId, error: billingSeedErr });
      return new Response(JSON.stringify({ error: "Could not prepare country billing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const automaticTax = Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/app?checkout=success&settingsTab=billing&billingWorkspace=${workspace.id}${testMode ? "&stripeMode=test" : ""}`,
      cancel_url: `${siteUrl}/app?checkout=canceled&settingsTab=billing&billingWorkspace=${workspace.id}${testMode ? "&stripeMode=test" : ""}`,
      client_reference_id: workspace.id,
      metadata: { org_id: orgId, workspace_id: workspace.id, plan_id: planId, stripe_mode: stripeConfig.mode, market },
      subscription_data: {
        metadata: { org_id: orgId, workspace_id: workspace.id, plan_id: planId, stripe_mode: stripeConfig.mode, market },
      },
      ...(automaticTax
        ? {
            automatic_tax: { enabled: true },
            billing_address_collection: "required",
            customer_update: { address: "auto" },
          }
        : {}),
    });

    return new Response(JSON.stringify({ url: session.url, requestId, stripeMode: stripeConfig.mode, workspaceId: workspace.id, priceMarket: market }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  } catch (e) {
    console.error("stripe-checkout failed", { requestId, error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Checkout failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }
});
