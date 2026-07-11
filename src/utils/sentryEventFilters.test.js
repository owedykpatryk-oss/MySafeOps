import { describe, expect, it } from "vitest";
import { shouldDropSentryEvent } from "./sentryEventFilters.js";

describe("shouldDropSentryEvent", () => {
  it("drops Turnstile appendChild syntax noise", () => {
    const drop = shouldDropSentryEvent({
      exception: {
        values: [{ value: "Failed to execute 'appendChild' on 'Node': Missing catch or finally after try" }],
      },
      transaction: "/login",
    });
    expect(drop).toBe(true);
  });

  it("drops MyPitLab URLs on a shared DSN", () => {
    const drop = shouldDropSentryEvent({
      message: "field.offline.diagnostic_snapshot",
      request: { url: "https://mypitlab.com/field" },
    });
    expect(drop).toBe(true);
  });

  it("keeps first-party MySafeOps workspace errors", () => {
    const drop = shouldDropSentryEvent({
      exception: { values: [{ value: "Cannot read properties of undefined (reading 'map')" }] },
      request: { url: "https://mysafeops.com/app" },
      transaction: "/app",
    });
    expect(drop).toBe(false);
  });
});
