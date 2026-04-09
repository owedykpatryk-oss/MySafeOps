import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isValidStripeSecret(value: string): boolean {
  return value.startsWith("sk_");
}

function isValidSiteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const secret = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
    const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    const diagnostics = {
      function: "stripe-portal",
      deployed: true,
      configured: {
        stripeSecretKey: Boolean(secret),
        siteUrl: Boolean(siteUrl),
        supabaseUrl: Boolean(supabaseUrl),
        serviceRoleKey: Boolean(serviceKey),
      },
      valid: {
        stripeSecretKeyFormat: !secret || isValidStripeSecret(secret),
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
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
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
      .select("stripe_customer_id")
      .eq("id", mem.org_id)
      .single();

    if (orgErr || !org?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No Stripe customer on file yet. Start a subscription first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
      });
    }

    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${siteUrl}/app?settingsTab=billing`,
    });

    return new Response(JSON.stringify({ url: session.url, requestId }), {
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
