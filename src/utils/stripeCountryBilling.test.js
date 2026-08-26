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

  it("never falls back from a German workspace to UK GBP prices", () => {
    expect(resolveStripeConfig("live", "de")).toBeNull();
    expect(stripeMarketReady("live", "de")).toBe(false);
    values.STRIPE_PRICE_STARTER_EUR = "price_de_starter";
    values.STRIPE_PRICE_TEAM_EUR = "price_de_team";
    values.STRIPE_PRICE_BUSINESS_EUR = "price_de_business";
    values.STRIPE_PRICE_ENTERPRISE_EUR = "price_de_enterprise";
    expect(stripeMarketReady("live", "de")).toBe(true);
  });

  it("shares EUR Stripe catalogue with Austria", () => {
    values.STRIPE_PRICE_STARTER_EUR = "price_eur_starter";
    values.STRIPE_PRICE_TEAM_EUR = "price_eur_team";
    values.STRIPE_PRICE_BUSINESS_EUR = "price_eur_business";
    values.STRIPE_PRICE_ENTERPRISE_EUR = "price_eur_enterprise";
    expect(stripeMarketReady("live", "at")).toBe(true);
    expect(resolveStripeConfig("live", "at")?.prices.starter).toBe("price_eur_starter");
  });

  it("never falls back from a Swiss workspace to DE/AT EUR prices", () => {
    values.STRIPE_PRICE_STARTER_EUR = "price_eur_starter";
    values.STRIPE_PRICE_TEAM_EUR = "price_eur_team";
    values.STRIPE_PRICE_BUSINESS_EUR = "price_eur_business";
    values.STRIPE_PRICE_ENTERPRISE_EUR = "price_eur_enterprise";
    expect(resolveStripeConfig("live", "ch")).toBeNull();
    expect(stripeMarketReady("live", "ch")).toBe(false);
    values.STRIPE_PRICE_STARTER_CHF = "price_ch_starter";
    values.STRIPE_PRICE_TEAM_CHF = "price_ch_team";
    values.STRIPE_PRICE_BUSINESS_CHF = "price_ch_business";
    values.STRIPE_PRICE_ENTERPRISE_CHF = "price_ch_enterprise";
    expect(stripeMarketReady("live", "ch")).toBe(true);
    expect(resolveStripeConfig("live", "ch")?.prices.starter).toBe("price_ch_starter");
  });

  it("maps the full Stripe lifecycle and rejects customer reassignment", () => {
    expect(mapStripeStatus("incomplete_expired")).toBe("incomplete_expired");
    expect(mapStripeStatus("paused")).toBe("paused");
    expect(isCustomerOrgBindingMismatch("cus_org", "cus_other")).toBe(true);
    expect(isCustomerOrgBindingMismatch("cus_org", "cus_org")).toBe(false);
  });
});
