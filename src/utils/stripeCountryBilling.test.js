import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveStripeConfig,
  stripeMarketReady,
} from "../../supabase/functions/_shared/stripeConfig.ts";
import {
  isCustomerOrgBindingMismatch,
  mapStripeStatus,
} from "../../supabase/functions/_shared/stripeWebhookMapping.ts";

describe("country Stripe billing", () => {
  let values;

  beforeEach(() => {
    values = {
      STRIPE_SECRET_KEY: ["sk", "live", "fixture"].join("_"),
      STRIPE_PRICE_STARTER: "price_uk_starter",
      STRIPE_PRICE_TEAM: "price_uk_team",
      STRIPE_PRICE_BUSINESS: "price_uk_business",
      STRIPE_PRICE_ENTERPRISE: "price_uk_enterprise",
    };
    vi.stubGlobal("Deno", { env: { get: (key) => values[key] } });
  });

  it("never falls back from a Polish workspace to UK GBP prices", () => {
    expect(resolveStripeConfig("live", "uk")?.prices.starter).toBe("price_uk_starter");
    expect(resolveStripeConfig("live", "pl")).toBeNull();
    expect(stripeMarketReady("live", "pl")).toBe(false);
  });

  it("requires the complete exact-market price catalogue before reporting ready", () => {
    values.STRIPE_PRICE_STARTER_PLN = "price_pl_starter";
    expect(resolveStripeConfig("live", "pl")).not.toBeNull();
    expect(stripeMarketReady("live", "pl")).toBe(false);
    values.STRIPE_PRICE_TEAM_PLN = "price_pl_team";
    values.STRIPE_PRICE_BUSINESS_PLN = "price_pl_business";
    values.STRIPE_PRICE_ENTERPRISE_PLN = "price_pl_enterprise";
    expect(stripeMarketReady("live", "pl")).toBe(true);
  });

  it("maps the full Stripe lifecycle and rejects customer reassignment", () => {
    expect(mapStripeStatus("incomplete_expired")).toBe("incomplete_expired");
    expect(mapStripeStatus("paused")).toBe("paused");
    expect(isCustomerOrgBindingMismatch("cus_org", "cus_other")).toBe(true);
    expect(isCustomerOrgBindingMismatch("cus_org", "cus_org")).toBe(false);
  });
});
