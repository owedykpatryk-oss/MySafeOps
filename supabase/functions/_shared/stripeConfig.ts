export type StripeMarketId = "uk" | "au" | "pl";

export type StripeMode = "live" | "test";

export type StripePricePlanId = "starter" | "team" | "business" | "enterprise";

const MARKET_PRICE_SUFFIX: Record<StripeMarketId, string> = {
  uk: "",
  au: "_AUD",
  pl: "_PLN",
};

export interface StripeEnvConfig {
  mode: StripeMode;
  secretKey: string;
  prices: Record<StripePricePlanId, string>;
  webhookSecret?: string;
  /** Market whose exact Price IDs are used. */
  billingMarket?: StripeMarketId;
}

function envTrim(key: string): string {
  return Deno.env.get(key)?.trim() ?? "";
}

export function isValidStripeSecret(value: string): boolean {
  return value.startsWith("sk_");
}

export function isValidWebhookSecret(value: string): boolean {
  return value.startsWith("whsec_");
}

export function isValidPriceId(value: string): boolean {
  return value.startsWith("price_");
}

export function isValidSiteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function hasLiveStripeConfig(): boolean {
  const secret = envTrim("STRIPE_SECRET_KEY");
  return isValidStripeSecret(secret);
}

export function hasTestStripeConfig(): boolean {
  const secret = envTrim("STRIPE_SECRET_KEY_TEST");
  return secret.startsWith("sk_test_");
}

export function resolveStripeConfig(mode: StripeMode, market: StripeMarketId = "uk"): StripeEnvConfig | null {
  const secretKey =
    mode === "test" ? envTrim("STRIPE_SECRET_KEY_TEST") : envTrim("STRIPE_SECRET_KEY");
  if (!isValidStripeSecret(secretKey)) return null;
  if (mode === "test" && !secretKey.startsWith("sk_test_")) return null;
  if (mode === "live" && secretKey.startsWith("sk_test_")) return null;

  const marketSuffix = MARKET_PRICE_SUFFIX[market] ?? "";
  const priceKeys: Record<StripePricePlanId, string> = {
    starter: mode === "test" ? `STRIPE_PRICE_STARTER_TEST${marketSuffix}` : `STRIPE_PRICE_STARTER${marketSuffix}`,
    team: mode === "test" ? `STRIPE_PRICE_TEAM_TEST${marketSuffix}` : `STRIPE_PRICE_TEAM${marketSuffix}`,
    business: mode === "test" ? `STRIPE_PRICE_BUSINESS_TEST${marketSuffix}` : `STRIPE_PRICE_BUSINESS${marketSuffix}`,
    enterprise: mode === "test" ? `STRIPE_PRICE_ENTERPRISE_TEST${marketSuffix}` : `STRIPE_PRICE_ENTERPRISE${marketSuffix}`,
  };

  const prices = {
    starter: envTrim(priceKeys.starter),
    team: envTrim(priceKeys.team),
    business: envTrim(priceKeys.business),
    enterprise: envTrim(priceKeys.enterprise),
  };

  // Country workspaces are independently billed. Never substitute another
  // country's currency or price: checkout must fail closed until the exact
  // market catalogue is configured.
  if (!Object.values(prices).some(isValidPriceId)) return null;

  const webhookSecret =
    mode === "test" ? envTrim("STRIPE_WEBHOOK_SECRET_TEST") : envTrim("STRIPE_WEBHOOK_SECRET");

  return { mode, secretKey, prices, webhookSecret: webhookSecret || undefined, billingMarket: market };
}

export function priceForPlan(config: StripeEnvConfig, planId: StripePricePlanId): string | undefined {
  const priceId = config.prices[planId];
  return priceId && isValidPriceId(priceId) ? priceId : undefined;
}

export function planFromPriceId(priceId: string): { plan: StripePricePlanId; mode: StripeMode; market: StripeMarketId } | null {
  const p = priceId.trim();
  for (const mode of ["live", "test"] as const) {
    for (const market of ["uk", "au", "pl"] as const) {
      const config = resolveStripeConfig(mode, market);
      if (!config) continue;
      for (const plan of ["starter", "team", "business", "enterprise"] as const) {
        if (config.prices[plan] === p) return { plan, mode, market };
      }
    }
  }
  return null;
}

/** Whether all four plan price IDs are configured for the requested market (no GBP fallback). */
export function stripeMarketReady(mode: StripeMode, market: StripeMarketId): boolean {
  const config = resolveStripeConfig(mode, market);
  return config !== null && Object.values(config.prices).every(isValidPriceId);
}

export function stripeDiagnostics(mode: StripeMode) {
  const config = resolveStripeConfig(mode);
  const secret = mode === "test" ? envTrim("STRIPE_SECRET_KEY_TEST") : envTrim("STRIPE_SECRET_KEY");
  const pricePrefix = mode === "test" ? "STRIPE_PRICE_" : "STRIPE_PRICE_";
  const priceSuffix = mode === "test" ? "_TEST" : "";
  const starter = envTrim(`${pricePrefix}STARTER${priceSuffix}`);
  const team = envTrim(`${pricePrefix}TEAM${priceSuffix}`);
  const business = envTrim(`${pricePrefix}BUSINESS${priceSuffix}`);
  const enterprise = envTrim(`${pricePrefix}ENTERPRISE${priceSuffix}`);
  const webhook =
    mode === "test" ? envTrim("STRIPE_WEBHOOK_SECRET_TEST") : envTrim("STRIPE_WEBHOOK_SECRET");

  return {
    mode,
    configured: Boolean(config),
    configuredMap: {
      secretKey: Boolean(secret),
      priceStarter: Boolean(starter),
      priceTeam: Boolean(team),
      priceBusiness: Boolean(business),
      priceEnterprise: Boolean(enterprise),
      webhookSecret: Boolean(webhook),
    },
    validMap: {
      secretKeyFormat: !secret || isValidStripeSecret(secret),
      priceStarterFormat: !starter || isValidPriceId(starter),
      priceTeamFormat: !team || isValidPriceId(team),
      priceBusinessFormat: !business || isValidPriceId(business),
      priceEnterpriseFormat: !enterprise || isValidPriceId(enterprise),
      webhookSecretFormat: !webhook || isValidWebhookSecret(webhook),
    },
  };
}
