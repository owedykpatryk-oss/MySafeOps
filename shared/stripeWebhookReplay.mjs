/** Replay the original Stripe event through the same signed handler as delivery. */
export async function replayStripeEvent({ stripe, eventId, webhookSecret, endpoint, fetchImpl = fetch }) {
  if (!webhookSecret?.startsWith("whsec_")) throw new Error("Matching Stripe webhook signing secret is required");
  const event = await stripe.events.retrieve(eventId);
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
    body: payload,
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.received) throw new Error(`Webhook replay failed (HTTP ${response.status})`);
  return body;
}
