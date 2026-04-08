import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function planFromPriceId(priceId: string): "starter" | "team" | "business" | null {
  const p = priceId.trim();
  const s = Deno.env.get("STRIPE_PRICE_STARTER")?.trim();
  const t = Deno.env.get("STRIPE_PRICE_TEAM")?.trim();
  const b = Deno.env.get("STRIPE_PRICE_BUSINESS")?.trim();
  if (s && p === s) return "starter";
  if (t && p === t) return "team";
  if (b && p === b) return "business";
  return null;
}

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

async function applySubscription(supabase: ReturnType<typeof createClient>, sub: Stripe.Subscription) {
  const orgId = sub.metadata?.org_id;
  if (!orgId) {
    console.warn("stripe-webhook: subscription without org_id metadata", sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? planFromPriceId(priceId) : null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  const row: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId ?? null,
    subscription_status: mapStripeStatus(sub.status),
    billing_plan: plan,
  };

  if (sub.status === "canceled" || sub.status === "unpaid") {
    row.billing_plan = null;
  }

  const { error } = await supabase.from("organizations").update(row).eq("id", orgId);
  if (error) console.error("applySubscription update error", error);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!secret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = session.subscription;
        if (typeof subId === "string") {
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(supabase, sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(supabase, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.org_id;
        if (orgId) await clearSubscription(supabase, orgId);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
