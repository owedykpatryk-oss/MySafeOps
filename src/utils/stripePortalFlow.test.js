import { describe, expect, it, vi } from "vitest";
import { cancellationPortalFlow } from "../../supabase/functions/_shared/stripePortalFlow.ts";
const options = { subscriptionId: "sub_country", customerId: "cus_country", workspaceId: "country", configuration: "portal", returnUrl: "https://www.mysafeops.com/app?settingsTab=billing" };
function client({ customer = "cus_country", workspace = "country", status = "active", mode = "at_period_end", enabled = true } = {}) {
  return { subscriptions: { retrieve: vi.fn(async () => ({ id: "sub_country", customer, metadata: { workspace_id: workspace }, status })) }, billingPortal: { configurations: { retrieve: vi.fn(async () => ({ features: { subscription_cancel: { enabled, mode } } })) } } };
}
describe("portal cancellation", () => {
  it("opens confirmation for the server-resolved country subscription and returns to billing", async () => {
    expect(await cancellationPortalFlow(client(), options)).toMatchObject({ type: "subscription_cancel", subscription_cancel: { subscription: "sub_country" }, after_completion: { redirect: { return_url: options.returnUrl } } });
  });
  it.each([{customer:"cus_other"},{workspace:"other"},{status:"canceled"},{mode:"immediately"},{enabled:false}])("refuses a mismatched, ended or unsafe cancellation: %j", async (overrides) => {
    await expect(cancellationPortalFlow(client(overrides), options)).rejects.toThrow();
  });
  it("cannot choose a subscription without a server workspace binding", async () => {
    const stripe = client();
    await expect(cancellationPortalFlow(stripe, {...options, subscriptionId:null})).rejects.toThrow();
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
