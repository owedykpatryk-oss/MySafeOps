/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  mapStripeStatus,
  isCustomerOrgBindingMismatch,
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

  it("maps unknown statuses to none", () => {
    expect(mapStripeStatus("incomplete")).toBe("none");
    expect(mapStripeStatus("paused")).toBe("none");
    expect(mapStripeStatus("")).toBe("none");
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
