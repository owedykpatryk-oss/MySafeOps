import { describe, expect, it } from "vitest";
import { billingStripeMode, billingStripeReady } from "./stripeBillingMode";

describe("billing screen mode", () => {
  it("uses the server test policy after reload and despite an old live return URL", () => {
    expect(billingStripeMode({ activeMode: "test" })).toBe("test");
    expect(billingStripeMode({ activeMode: "test" }, "live")).toBe("test");
  });
  it("keeps a test return in the test catalogue even on a live server", () => {
    expect(billingStripeMode({ activeMode: "live" }, "test")).toBe("test");
    expect(billingStripeMode({ activeMode: "live" })).toBe("live");
  });
  it("does not select live while diagnostics are loading or unavailable", () => {
    expect(billingStripeMode(null, "live")).toBe("test");
    expect(billingStripeMode(undefined)).toBe("test");
  });
  it("checks the active mode, not the presence of unused live credentials", () => {
    expect(billingStripeReady({ activeReady: true, liveReady: false })).toBe(true);
    expect(billingStripeReady({ activeReady: false, liveReady: true })).toBe(false);
    expect(billingStripeReady({ liveReady: true })).toBe(true);
  });
});
