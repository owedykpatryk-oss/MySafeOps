import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  hasLiveStripeConfig,
  hasTestStripeConfig,
  isValidSiteUrl,
  resolveStripeConfig,
  stripeDiagnostics,
} from "../_shared/stripeConfig.ts";
import { getBillingAdminUser, publicStripeHealthBody } from "../_shared/stripeHealthGet.ts";
import { enforceEdgeRateLimits, enforceUserAndOrgEdgeRateLimits } from "../_shared/edgeRateLimit.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";

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
      function: "stripe-portal",
      deployed: true,
      stripeLive: live,
      stripeTest: test,
      configured: {
        stripeSecretKey: hasLiveStripeConfig(),
        stripeTestSecretKey: hasTestStripeConfig(),
        siteUrl: Boolean(siteUrl),
        supabaseUrl: Boolean(supabaseUrl),
        serviceRoleKey: Boolean(serviceKey),
      },
      valid: {
        stripeSecretKeyFormat: live.validMap.secretKeyFormat,
        siteUrlFormat: !siteUrl || isValidSiteUrl(siteUrl),
      },
      requestId,
    };
    const liveReady = live.configured;
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    const admin = await getBillingAdminUser(req, supabaseUrl, serviceKey);
    if (!admin) {
      const publicBody = publicStripeHealthBody("stripe-portal", liveReady && allValid, test.configured, requestId);
      return new Response(JSON.stringify(publicBody), {
        status: liveReady && allValid ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
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
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const body = await req.json().catch(() => ({}));
    const testMode = Boolean(body?.testMode);

    const stripeConfig = resolveStripeConfig(testMode ? "test" : "live");
    if (!stripeConfig) {
      return new Response(
        JSON.stringify({
          error: testMode
            ? "Stripe test portal is not configured."
            : "STRIPE_SECRET_KEY not configured",
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

    if (
      !(await enforceUserAndOrgEdgeRateLimits(supabase, {
        userKey: `stripe-portal:${user.id}`,
        orgKey: `stripe-portal:org:${mem.org_id}`,
        userMax: 20,
        orgMax: 40,
        windowMs: 60_000,
        failClosed: true,
      }))
    ) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    if (mem.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only organisation admins can manage billing" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const customerColumn = testMode ? "stripe_test_customer_id" : "stripe_customer_id";
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select(`id, ${customerColumn}`)
      .eq("id", mem.org_id)
      .single();

    const customerId = org?.[customerColumn] as string | null | undefined;
    if (orgErr || !customerId) {
      return new Response(
        JSON.stringify({
          error: testMode
            ? "No Stripe test customer on file yet. Start a test subscription first."
            : "No Stripe customer on file yet. Start a subscription first.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2023-10-16" });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/app?settingsTab=billing${testMode ? "&stripeMode=test" : ""}`,
    });

    return new Response(JSON.stringify({ url: session.url, requestId, stripeMode: stripeConfig.mode }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  } catch (e) {
    console.error("stripe-portal failed", { requestId, error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Portal failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  }
});
