import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@14.21.0";
import {
  hasLiveStripeConfig,
  hasTestStripeConfig,
  isValidSiteUrl,
  stripeDiagnostics,
  resolveStripeMode,
} from "../_shared/stripeConfig.ts";
import { getBillingAdminUser, publicStripeHealthBody } from "../_shared/stripeHealthGet.ts";
import { enforceEdgeRateLimits, enforceUserAndOrgEdgeRateLimits } from "../_shared/edgeRateLimit.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { resolveBillingMembership } from "../_shared/resolveBillingMembership.ts";
import { resolveWorkspaceStripeCustomerId } from "../_shared/stripeWebhookMapping.ts";
import { cancellationPortalFlow } from "../_shared/stripePortalFlow.ts";

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
    const activeMode = supabaseUrl && serviceKey ? await resolveStripeMode(createClient(supabaseUrl, serviceKey)).catch(() => null) : null;
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
        siteUrlFormat: isValidSiteUrl(siteUrl),
      },
      requestId,
    };
    const serverReady = Boolean(supabaseUrl && serviceKey) && isValidSiteUrl(siteUrl);
    const liveReady = serverReady && hasLiveStripeConfig();
    const testReady = serverReady && hasTestStripeConfig();
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    const activeReady = activeMode !== null && (activeMode === "test" ? testReady : liveReady && allValid);
    const admin = await getBillingAdminUser(req, supabaseUrl, serviceKey);
    if (!admin) {
      const publicBody = { ...publicStripeHealthBody("stripe-portal", liveReady && allValid, testReady, requestId), activeMode, activeReady };
      return new Response(JSON.stringify(publicBody), {
        status: activeReady ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    return new Response(JSON.stringify({ ...diagnostics, liveReady, testReady, activeMode, activeReady }), {
      status: activeReady ? 200 : 503,
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
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").trim().replace(/\/$/, "");
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
    if (body.action && !["manage", "cancel"].includes(body.action)) {
      return new Response(JSON.stringify({ error: "Unsupported billing action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const testMode = (await resolveStripeMode(supabase, body?.testMode)) === "test";
    const orgSlug = typeof body?.orgSlug === "string" ? body.orgSlug : null;
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
    const stripeMode = testMode ? "test" : "live";
    const secretKey = Deno.env.get(testMode ? "STRIPE_SECRET_KEY_TEST" : "STRIPE_SECRET_KEY")?.trim() ?? "";
    if (!(testMode ? hasTestStripeConfig() : hasLiveStripeConfig())) {
      return new Response(
        JSON.stringify({
          error: testMode
            ? "Stripe test portal is not configured."
            : "STRIPE_SECRET_KEY not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const mem = await resolveBillingMembership(supabase, user.id, orgSlug);

    if (!mem?.org_id) {
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

    let workspaceIsPrimary = true;
    let workspaceCustomerId: string | null = null;
    let workspaceSubscriptionId: string | null = null;
    if (workspaceId) {
      const { data: workspace, error: workspaceErr } = await supabase
        .from("org_country_workspaces")
        .select("id, is_primary")
        .eq("id", workspaceId)
        .eq("org_id", mem.org_id)
        .maybeSingle();
      if (workspaceErr || !workspace?.id) {
        return new Response(JSON.stringify({ error: "Country workspace is not available for this organisation" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
        });
      }
      workspaceIsPrimary = Boolean(workspace.is_primary);
      // Each country bills its own Stripe customer, so the portal must open that
      // country's customer — not the organisation-wide one.
      const { data: workspaceBilling, error: workspaceBillingError } = await supabase
        .from("org_country_workspace_subscriptions")
        .select("stripe_customer_id, stripe_subscription_id")
        .eq("workspace_id", workspace.id)
        .eq("stripe_mode", stripeMode)
        .maybeSingle();
      if (workspaceBillingError) throw new Error("Could not read country billing. Please try again.");
      workspaceCustomerId = (workspaceBilling?.stripe_customer_id as string | null) ?? null;
      workspaceSubscriptionId = (workspaceBilling?.stripe_subscription_id as string | null) ?? null;
    }

    const customerColumn = testMode ? "stripe_test_customer_id" : "stripe_customer_id";
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, stripe_test_customer_id")
      .eq("id", mem.org_id)
      .single();

    const customerId = resolveWorkspaceStripeCustomerId({
      workspaceCustomerId,
      orgCustomerId: org?.[customerColumn] as string | null | undefined,
      isPrimary: workspaceIsPrimary,
    });
    if (orgErr || !customerId) {
      return new Response(
        JSON.stringify({
          error: testMode
            ? "No Stripe test customer on file yet. Start a test subscription first."
            : "No Stripe customer on file for this country yet. Start a subscription first.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" });

    const configurationKey = testMode ? "STRIPE_PORTAL_CONFIGURATION_TEST" : "STRIPE_PORTAL_CONFIGURATION";
    let configuration = Deno.env.get(configurationKey)?.trim();
    if (!configuration) {
      // The Stripe account may serve several applications. Never accidentally open
      // another application's portal configuration or product-switching catalogue.
      for await (const candidate of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
        if (candidate.metadata?.application === "mysafeops") { configuration = candidate.id; break; }
      }
    }
    if (!configuration) throw new Error("MySafeOps billing portal is not configured. Please contact support.");

    const returnUrl = `${siteUrl}/app?settingsTab=billing${workspaceId ? `&billingWorkspace=${workspaceId}` : ""}${testMode ? "&stripeMode=test" : ""}`;
    const flow = body.action === "cancel" ? await cancellationPortalFlow(stripe, {
      subscriptionId: workspaceSubscriptionId, customerId, workspaceId, configuration, returnUrl,
    }) : undefined;
    const session = await stripe.billingPortal.sessions.create({
      configuration,
      customer: customerId,
      return_url: returnUrl,
      ...(flow ? { flow_data: flow } : {}),
    });

    return new Response(JSON.stringify({ url: session.url, requestId, stripeMode }), {
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
