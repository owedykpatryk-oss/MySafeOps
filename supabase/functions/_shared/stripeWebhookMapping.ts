/**
 * Pure Stripe webhook mapping helpers (testable from Vitest without Deno runtime).
 */

export type MappedSubscriptionStatus =
  | "none"
  | "incomplete"
  | "incomplete_expired"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/** Map Stripe subscription.status → organizations.subscription_status. */
export function mapStripeStatus(status: string): MappedSubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
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

/**
 * `organizations.subscription_status` only gained incomplete/incomplete_expired/paused
 * in the country-workspace migration. The legacy mirror is clamped to the older set so
 * deploying this function ahead of the migration cannot fail the whole webhook on a
 * check-constraint violation. None of the clamped values grant entitlement, so the
 * mirror stays accurate for gating — the exact status is kept per workspace.
 */
export function mapLegacyOrgStatus(status: MappedSubscriptionStatus): MappedSubscriptionStatus {
  switch (status) {
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "none";
    default:
      return status;
  }
}

/**
 * A Stripe customer is locked to one currency by its first subscription, so each country
 * workspace needs its own customer. The organisation-level customer is reused only for the
 * primary workspace, which keeps existing UK customers on their original billing history.
 *
 * @returns the customer to bill, or null when a new one must be created for this workspace.
 */
export function resolveWorkspaceStripeCustomerId(input: {
  workspaceCustomerId?: string | null;
  orgCustomerId?: string | null;
  isPrimary?: boolean | null;
}): string | null {
  const workspaceCustomerId = input.workspaceCustomerId?.trim() || "";
  if (workspaceCustomerId) return workspaceCustomerId;
  const orgCustomerId = input.orgCustomerId?.trim() || "";
  if (input.isPrimary && orgCustomerId) return orgCustomerId;
  return null;
}
