import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlanId = "starter" | "team" | "business";

function isValidStripeSecret(value: string): boolean {
  return value.startsWith("sk_");
}

function isValidPriceId(value: string): boolean {
  return value.startsWith("price_");
}

function isValidSiteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function priceForPlan(planId: PlanId): string | undefined {
  const key =
    planId === "starter"
      ? "STRIPE_PRICE_STARTER"
      : planId === "team"
        ? "STRIPE_PRICE_TEAM"
        : "STRIPE_PRICE_BUSINESS";
  const v = Deno.env.get(key);
  return v && v.trim() ? v.trim() : undefined;
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const secret = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
    const starter = Deno.env.get("STRIPE_PRICE_STARTER")?.trim() ?? "";
    const team = Deno.env.get("STRIPE_PRICE_TEAM")?.trim() ?? "";
    const business = Deno.env.get("STRIPE_PRICE_BUSINESS")?.trim() ?? "";
    const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    const diagnostics = {
      function: "stripe-checkout",
      deployed: true,
      configured: {
        stripeSecretKey: Boolean(secret),
        stripePriceStarter: Boolean(starter),
        stripePriceTeam: Boolean(team),
        stripePriceBusiness: Boolean(business),
        siteUrl: Boolean(siteUrl),
        supabaseUrl: Boolean(supabaseUrl),
        serviceRoleKey: Boolean(serviceKey),
      },
      valid: {
        stripeSecretKeyFormat: !secret || isValidStripeSecret(secret),
        stripePriceStarterFormat: !starter || isValidPriceId(starter),
        stripePriceTeamFormat: !team || isValidPriceId(team),
        stripePriceBusinessFormat: !business || isValidPriceId(business),
        siteUrlFormat: !siteUrl || isValidSiteUrl(siteUrl),
      },
      requestId,
    };
    const allConfigured = Object.values(diagnostics.configured).every(Boolean);
    const allValid = Object.values(diagnostics.valid).every(Boolean);
    return new Response(JSON.stringify(diagnostics), {
      status: allConfigured && allValid ? 200 : 503,
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
    const secret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");
    if (!isValidSiteUrl(siteUrl)) {
      return new Response(JSON.stringify({ error: "SITE_URL invalid. Expected absolute http(s) URL." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    if (!secret) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }
    if (!isValidStripeSecret(secret)) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY format invalid. Expected sk_..." }), {
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
    const planId = body?.planId as PlanId | undefined;
    if (!planId || !["starter", "team", "business"].includes(planId)) {
      return new Response(JSON.stringify({ error: "planId must be starter, team, or business" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const priceId = priceForPlan(planId);
    if (!priceId) {
      return new Response(
        JSON.stringify({
          error: "Stripe Price ID not configured for this plan. Set STRIPE_PRICE_STARTER / TEAM / BUSINESS.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId } },
      );
    }
    if (!isValidPriceId(priceId)) {
      return new Response(
        JSON.stringify({
          error: "Stripe Price ID format invalid. Expected price_...",
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
      .select("id, stripe_customer_id")
      .eq("id", mem.org_id)
      .single();

    if (orgErr || !org?.id) {
      return new Response(JSON.stringify({ error: "Organisation not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const orgId = org.id;

    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { org_id: orgId },
      });
      customerId = customer.id;
      const { error: upErr } = await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);
      if (upErr) {
        console.error("stripe-checkout update customer failed", { requestId, orgId, error: upErr });
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
      success_url: `${siteUrl}/app?checkout=success&settingsTab=billing`,
      cancel_url: `${siteUrl}/app?checkout=canceled&settingsTab=billing`,
      client_reference_id: orgId,
      metadata: { org_id: orgId, plan_id: planId },
      subscription_data: {
        metadata: { org_id: orgId, plan_id: planId },
      },
    });

    return new Response(JSON.stringify({ url: session.url, requestId }), {
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
