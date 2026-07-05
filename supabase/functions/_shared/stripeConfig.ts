export type StripeMode = "live" | "test";

export type StripePricePlanId = "starter" | "team" | "business" | "enterprise";

export interface StripeEnvConfig {
  mode: StripeMode;
  secretKey: string;
  prices: Record<StripePricePlanId, string>;
  webhookSecret?: string;
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

export function resolveStripeConfig(mode: StripeMode): StripeEnvConfig | null {
  const secretKey =
    mode === "test" ? envTrim("STRIPE_SECRET_KEY_TEST") : envTrim("STRIPE_SECRET_KEY");
  if (!isValidStripeSecret(secretKey)) return null;
  if (mode === "test" && !secretKey.startsWith("sk_test_")) return null;
  if (mode === "live" && secretKey.startsWith("sk_test_")) return null;

  const priceKeys: Record<StripePricePlanId, string> = {
    starter: mode === "test" ? "STRIPE_PRICE_STARTER_TEST" : "STRIPE_PRICE_STARTER",
    team: mode === "test" ? "STRIPE_PRICE_TEAM_TEST" : "STRIPE_PRICE_TEAM",
    business: mode === "test" ? "STRIPE_PRICE_BUSINESS_TEST" : "STRIPE_PRICE_BUSINESS",
    enterprise: mode === "test" ? "STRIPE_PRICE_ENTERPRISE_TEST" : "STRIPE_PRICE_ENTERPRISE",
  };

  const prices = {
    starter: envTrim(priceKeys.starter),
    team: envTrim(priceKeys.team),
    business: envTrim(priceKeys.business),
    enterprise: envTrim(priceKeys.enterprise),
  };

  if (!Object.values(prices).every(isValidPriceId)) return null;

  const webhookSecret =
    mode === "test" ? envTrim("STRIPE_WEBHOOK_SECRET_TEST") : envTrim("STRIPE_WEBHOOK_SECRET");

  return { mode, secretKey, prices, webhookSecret: webhookSecret || undefined };
}

export function priceForPlan(config: StripeEnvConfig, planId: StripePricePlanId): string | undefined {
  const priceId = config.prices[planId];
  return priceId && isValidPriceId(priceId) ? priceId : undefined;
}

export function planFromPriceId(priceId: string): { plan: StripePricePlanId; mode: StripeMode } | null {
  const p = priceId.trim();
  for (const mode of ["live", "test"] as const) {
    const config = resolveStripeConfig(mode);
    if (!config) continue;
    for (const plan of ["starter", "team", "business", "enterprise"] as const) {
      if (config.prices[plan] === p) return { plan, mode };
    }
  }
  return null;
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
