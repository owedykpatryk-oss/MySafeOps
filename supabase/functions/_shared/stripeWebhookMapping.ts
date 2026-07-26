/**
 * Pure Stripe webhook mapping helpers (testable from Vitest without Deno runtime).
 */

export type MappedSubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";

/** Map Stripe subscription.status → organizations.subscription_status. */
export function mapStripeStatus(status: string): MappedSubscriptionStatus {
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

/**
 * Once an org has a bound Stripe customer for this mode, refuse subscriptions
 * whose customer id does not match (metadata.org_id can be edited in Stripe).
 */
export function isCustomerOrgBindingMismatch(
  boundCustomerId: string | null | undefined,
  customerId: string | null | undefined,
): boolean {
  return Boolean(boundCustomerId && customerId && boundCustomerId !== customerId);
}

/** Unix seconds → ISO, or null. */
export function stripeUnixToIso(unixSeconds: number | null | undefined): string | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}
