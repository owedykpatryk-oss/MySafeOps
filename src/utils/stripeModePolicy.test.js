import { describe, expect, it, vi } from "vitest";
import { resolveStripeMode } from "../../supabase/functions/_shared/stripeConfig.ts";

describe("shared server-controlled Stripe mode", () => {
  it.each(["live", "test"])("reads %s from the same policy as write permissions", async (mode) => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: mode, error: null }) };
    expect(await resolveStripeMode(client)).toBe(mode);
    expect(await resolveStripeMode(client, false)).toBe(mode);
    expect(await resolveStripeMode(client, true)).toBe("test");
    expect(client.rpc).toHaveBeenCalledWith("get_billing_runtime_mode");
  });
  it.each([null, "", "invalid"])("refuses checkout if server mode is %s", async (mode) => {
    await expect(resolveStripeMode({ rpc: async () => ({ data: mode, error: null }) }))
      .rejects.toThrow("Billing mode is unavailable");
  });
  it("refuses checkout when policy cannot be read, even for requested test mode", async () => {
    await expect(resolveStripeMode({ rpc: async () => ({ data: "live", error: new Error("offline") }) }, true))
      .rejects.toThrow("Billing mode is unavailable");
  });
});
