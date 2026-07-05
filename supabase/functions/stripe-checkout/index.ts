import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  hasLiveStripeConfig,
  hasTestStripeConfig,
  isValidSiteUrl,
  priceForPlan,
  resolveStripeConfig,
  stripeDiagnostics,
  type StripePricePlanId,
} from "../_shared/stripeConfig.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
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
    const liveReady = live.configured;
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    return new Response(JSON.stringify({ ...diagnostics, liveReady, testReady: test.configured }), {
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
    if (!planId || !["starter", "team", "business", "enterprise"].includes(planId)) {
      return new Response(JSON.stringify({ error: "planId must be starter, team, business, or enterprise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const stripeConfig = resolveStripeConfig(testMode ? "test" : "live");
    if (!stripeConfig) {
      return new Response(
        JSON.stringify({
          error: testMode
            ? "Stripe test mode is not configured. Set STRIPE_SECRET_KEY_TEST and STRIPE_PRICE_*_TEST in Supabase Edge secrets."
            : "STRIPE_SECRET_KEY not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const priceId = priceForPlan(stripeConfig, planId);
    if (!priceId) {
      return new Response(
        JSON.stringify({
          error: testMode
            ? "Stripe test Price ID not configured for this plan."
            : "Stripe Price ID not configured for this plan. Set STRIPE_PRICE_STARTER / TEAM / BUSINESS / ENTERPRISE.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const { data: mem, error: memErr } = await supabase
      .from("org_memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr || !mem?.org_id) {
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
    let customerId = (org[customerColumn] as string | null) ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { org_id: orgId, stripe_mode: stripeConfig.mode },
      });
      customerId = customer.id;
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/app?checkout=success&settingsTab=billing${testMode ? "&stripeMode=test" : ""}`,
      cancel_url: `${siteUrl}/app?checkout=canceled&settingsTab=billing${testMode ? "&stripeMode=test" : ""}`,
      client_reference_id: orgId,
      metadata: { org_id: orgId, plan_id: planId, stripe_mode: stripeConfig.mode },
      subscription_data: {
        metadata: { org_id: orgId, plan_id: planId, stripe_mode: stripeConfig.mode },
      },
    });

    return new Response(JSON.stringify({ url: session.url, requestId, stripeMode: stripeConfig.mode }), {
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
