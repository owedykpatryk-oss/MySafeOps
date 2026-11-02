import { isValidStripeSecret, isValidWebhookSecret, type StripeMode } from "./stripeConfig.ts";
import type Stripe from "npm:stripe@14.21.0";

/** Keep Web Crypto verification asynchronous in both Node and Deno. */
export async function constructStripeEvent(StripeClient: typeof Stripe, body: string, signature: string) {
  let lastError: unknown;
  for (const mode of ["live", "test"] as StripeMode[]) {
    const suffix = mode === "test" ? "_TEST" : "";
    const key = Deno.env.get(`STRIPE_SECRET_KEY${suffix}`)?.trim() ?? "";
    const secret = Deno.env.get(`STRIPE_WEBHOOK_SECRET${suffix}`)?.trim() ?? "";
    if (!isValidStripeSecret(key) || !isValidWebhookSecret(secret)) continue;
    if (!key.startsWith(`sk_${mode}_`) && !key.startsWith(`rk_${mode}_`)) continue;
    const stripe = new StripeClient(key, { apiVersion: "2023-10-16" });
    try {
      const event = await stripe.webhooks.constructEventAsync(
        body, signature, secret, undefined, StripeClient.createSubtleCryptoProvider(),
      );
      if (Boolean(event.livemode) !== (mode === "live")) throw new Error("Webhook mode mismatch");
      return { event, mode, stripe };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Webhook signing secret is not configured");
}
