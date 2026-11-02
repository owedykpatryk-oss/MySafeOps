import type Stripe from "npm:stripe@14.21.0";

/** The subscription id comes from the authorised workspace, never from the browser. */
export async function cancellationPortalFlow(stripe: Stripe, options: {
  subscriptionId: string | null; customerId: string; workspaceId: string;
  configuration: string; returnUrl: string;
}): Promise<Stripe.BillingPortal.SessionCreateParams.FlowData> {
  if (!options.workspaceId || !options.subscriptionId) throw new Error("No subscription to cancel for this country.");
  const sub = await stripe.subscriptions.retrieve(options.subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (customerId !== options.customerId || (sub.metadata?.workspace_id && sub.metadata.workspace_id !== options.workspaceId)) {
    throw new Error("Subscription does not belong to this country.");
  }
  if (["canceled", "incomplete_expired"].includes(sub.status)) throw new Error("This subscription has already ended.");
  const config = await stripe.billingPortal.configurations.retrieve(options.configuration);
  if (!config.features.subscription_cancel.enabled || config.features.subscription_cancel.mode !== "at_period_end") {
    throw new Error("Cancellation at the end of the paid period is temporarily unavailable. Please contact support.");
  }
  return {
    type: "subscription_cancel", subscription_cancel: { subscription: sub.id },
    after_completion: { type: "redirect", redirect: { return_url: options.returnUrl } },
  };
}
