import type Stripe from "npm:stripe@14.21.0";
export class BillingCheckoutConflict extends Error {}
export class BillingConfigurationError extends Error {}

/** Do not accept a new payment without a registered route for granting access. */
export async function requireBillingWebhook(stripe: Stripe, endpointUrl: string, livemode: boolean, signingSecret?: string) {
  const message = "Payments are temporarily unavailable because subscription activation is not configured. Please contact support.";
  if (!signingSecret?.startsWith("whsec_")) throw new BillingConfigurationError(message);
  const required = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"];
  for await (const hook of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (hook.url === endpointUrl && hook.status === "enabled" && hook.livemode === livemode &&
        required.every(event => hook.enabled_events.includes("*") || hook.enabled_events.includes(event))) return;
  }
  throw new BillingConfigurationError(message);
}

/** Called while holding the database checkout lease for this country and mode. */
export async function reusableCheckout(stripe: Stripe, customerId: string, workspaceId: string, planId: string, priceId: string) {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  if (subscriptions.has_more || subscriptions.data.some((sub) => !["canceled", "incomplete_expired"].includes(sub.status))) {
    throw new BillingCheckoutConflict("This country already has a subscription. Use Manage billing to change or pay it.");
  }
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
  if (sessions.has_more) throw new BillingCheckoutConflict("Too many pending checkouts. Please contact support.");
  let reusable: Stripe.Checkout.Session | null = null;
  for (const pending of sessions.data) {
    if (pending.metadata?.workspace_id !== workspaceId) continue;
    if (!reusable && pending.metadata?.plan_id === planId && pending.metadata?.price_id === priceId && pending.url) {
      reusable = pending;
    } else {
      await stripe.checkout.sessions.expire(pending.id);
    }
  }
  return reusable;
}
