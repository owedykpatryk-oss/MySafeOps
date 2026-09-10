/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  mapStripeStatus,
  mapLegacyOrgStatus,
  isCustomerOrgBindingMismatch,
  resolveWorkspaceStripeCustomerId,
  stripeUnixToIso,
} from "../../supabase/functions/_shared/stripeWebhookMapping.ts";

describe("stripeWebhookMapping", () => {
  it("maps known Stripe subscription statuses", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("trialing");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("unpaid")).toBe("unpaid");
  });

  it("keeps the non-entitling Stripe statuses instead of flattening them to none", () => {
    expect(mapStripeStatus("incomplete")).toBe("incomplete");
    expect(mapStripeStatus("incomplete_expired")).toBe("incomplete_expired");
    expect(mapStripeStatus("paused")).toBe("paused");
  });

  it("maps unknown statuses to none", () => {
    expect(mapStripeStatus("")).toBe("none");
    expect(mapStripeStatus("something_new")).toBe("none");
  });

  it("clamps the legacy organisation mirror to statuses the old constraint allows", () => {
    expect(mapLegacyOrgStatus("incomplete")).toBe("none");
    expect(mapLegacyOrgStatus("incomplete_expired")).toBe("none");
    expect(mapLegacyOrgStatus("paused")).toBe("none");
    expect(mapLegacyOrgStatus("active")).toBe("active");
    expect(mapLegacyOrgStatus("trialing")).toBe("trialing");
    expect(mapLegacyOrgStatus("past_due")).toBe("past_due");
    expect(mapLegacyOrgStatus("canceled")).toBe("canceled");
    expect(mapLegacyOrgStatus("unpaid")).toBe("unpaid");
  });

  it("bills every country workspace on its own Stripe customer", () => {
    // A secondary country never inherits the organisation customer: Stripe locks that
    // customer to the primary country's currency and would reject the checkout.
    expect(
      resolveWorkspaceStripeCustomerId({ workspaceCustomerId: null, orgCustomerId: "cus_uk", isPrimary: false }),
    ).toBe(null);
    expect(
      resolveWorkspaceStripeCustomerId({ workspaceCustomerId: "cus_pl", orgCustomerId: "cus_uk", isPrimary: false }),
    ).toBe("cus_pl");
  });

  it("keeps the primary country on the existing organisation customer", () => {
    expect(
      resolveWorkspaceStripeCustomerId({ workspaceCustomerId: null, orgCustomerId: "cus_uk", isPrimary: true }),
    ).toBe("cus_uk");
    expect(
      resolveWorkspaceStripeCustomerId({ workspaceCustomerId: "cus_workspace", orgCustomerId: "cus_uk", isPrimary: true }),
    ).toBe("cus_workspace");
    expect(resolveWorkspaceStripeCustomerId({ workspaceCustomerId: "  ", orgCustomerId: "", isPrimary: true })).toBe(null);
  });

  it("refuses customer/org binding mismatch when both ids are set and differ", () => {
    expect(isCustomerOrgBindingMismatch("cus_a", "cus_b")).toBe(true);
    expect(isCustomerOrgBindingMismatch("cus_a", "cus_a")).toBe(false);
    expect(isCustomerOrgBindingMismatch(null, "cus_b")).toBe(false);
    expect(isCustomerOrgBindingMismatch("cus_a", null)).toBe(false);
    expect(isCustomerOrgBindingMismatch("", "cus_b")).toBe(false);
  });

  it("converts Stripe unix timestamps to ISO", () => {
    expect(stripeUnixToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(stripeUnixToIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
    expect(stripeUnixToIso(null)).toBe(null);
    expect(stripeUnixToIso(undefined)).toBe(null);
    expect(stripeUnixToIso(Number.NaN)).toBe(null);
  });
});
