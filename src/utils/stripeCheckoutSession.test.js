import { describe, expect, it, vi } from "vitest";
import { requireBillingWebhook, reusableCheckout } from "../../supabase/functions/_shared/stripeCheckoutSession.ts";
import { replayStripeEvent } from "../../shared/stripeWebhookReplay.mjs";

function stripeClient({ subscriptions = [], sessions = [] } = {}) {
  return { subscriptions: { list: vi.fn().mockResolvedValue({ data: subscriptions }) }, checkout: { sessions: {
    list: vi.fn().mockResolvedValue({ data: sessions }), expire: vi.fn().mockResolvedValue({}),
  } } };
}
const pending = (overrides = {}) => ({ id: "cs_open", url: "https://checkout.stripe.com/test", metadata: { workspace_id: "ws", plan_id: "team", price_id: "price_new" }, ...overrides });

describe("checkout activation prerequisite", () => {
  const url = "https://project.supabase.co/functions/v1/stripe-webhook";
  const client = (hooks) => ({ webhookEndpoints: { list: () => hooks } });
  it("refuses to take payment when the application webhook is missing", async () => {
    await expect(requireBillingWebhook(client([]), url, true, "whsec_fixture")).rejects.toThrow("activation is not configured");
  });
  it("does not count other applications, modes, disabled or incomplete endpoints", async () => {
    for (const override of [{ url: "https://other.test/hook" }, { livemode: false }, { status: "disabled" }, { enabled_events: ["checkout.session.completed"] }]) {
      const hook = { url, status: "enabled", livemode: true, enabled_events: ["*"], ...override };
      await expect(requireBillingWebhook(client([hook]), url, true, "whsec_fixture")).rejects.toThrow("activation is not configured");
    }
  });
  it("requires a signing secret and accepts a correctly registered webhook", async () => {
    const stripe = client([{ url, status: "enabled", livemode: true, enabled_events: ["*"] }]);
    await expect(requireBillingWebhook(stripe, url, true)).rejects.toThrow();
    await expect(requireBillingWebhook(stripe, url, true, "whsec_fixture")).resolves.toBeUndefined();
  });
});

describe("checkout duplication protection", () => {
  it("reuses the unpaid session without creating a second subscription", async () => {
    const stripe=stripeClient({sessions:[pending()]});
    expect((await reusableCheckout(stripe,"cus","ws","team","price_new")).id).toBe("cs_open");
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
  });
  it("blocks another purchase even if the paid webhook has not arrived", async () => {
    const stripe=stripeClient({subscriptions:[{status:"active"}]});
    await expect(reusableCheckout(stripe,"cus","ws","team","price_new")).rejects.toThrow("already has a subscription");
    expect(stripe.checkout.sessions.list).not.toHaveBeenCalled();
  });
  it("expires old-price sessions before offering the current price", async () => {
    const stripe=stripeClient({sessions:[pending({metadata:{workspace_id:"ws",plan_id:"team",price_id:"price_old"}})]});
    expect(await reusableCheckout(stripe,"cus","ws","team","price_new")).toBeNull();
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_open");
  });
  it("expires duplicate sessions but preserves other workspaces", async () => {
    const stripe=stripeClient({sessions:[pending(),pending({id:"cs_duplicate"}),pending({id:"cs_other",metadata:{workspace_id:"other"}})]});
    await reusableCheckout(stripe,"cus","ws","team","price_new");
    expect(stripe.checkout.sessions.expire.mock.calls).toEqual([["cs_duplicate"]]);
  });
  it("fails closed if an older checkout cannot be expired", async () => {
    const stripe=stripeClient({sessions:[pending({metadata:{workspace_id:"ws",plan_id:"starter"}})]});
    stripe.checkout.sessions.expire.mockRejectedValue(new Error("already completed"));
    await expect(reusableCheckout(stripe,"cus","ws","team","price_new")).rejects.toThrow("already completed");
  });
});

describe("webhook replay", () => {
  it("replays the original event through the signed handler", async () => {
    const event={id:"evt_original",livemode:false};
    const stripe={events:{retrieve:vi.fn().mockResolvedValue(event)},webhooks:{generateTestHeaderString:vi.fn().mockReturnValue("signature")}};
    const fetchImpl=vi.fn().mockResolvedValue({ok:true,json:async()=>({received:true})});
    await replayStripeEvent({stripe,eventId:event.id,webhookSecret:"whsec_fixture",endpoint:"https://example.com/webhook",fetchImpl});
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({method:"POST",body:JSON.stringify(event),headers:{"Stripe-Signature":"signature"}});
  });
  it("does not report a rejected webhook as resolved", async () => {
    const stripe={events:{retrieve:vi.fn().mockResolvedValue({id:"evt"})},webhooks:{generateTestHeaderString:vi.fn().mockReturnValue("signature")}};
    await expect(replayStripeEvent({stripe,eventId:"evt",webhookSecret:"whsec_fixture",endpoint:"https://example.com",fetchImpl:async()=>({ok:false,status:500,json:async()=>({error:"handler failed"})})})).rejects.toThrow("HTTP 500");
  });
});
