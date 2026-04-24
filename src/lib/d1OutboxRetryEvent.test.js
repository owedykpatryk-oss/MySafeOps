import { describe, it, expect, vi, afterEach } from "vitest";
import { D1_OUTBOX_MANUAL_RETRY_EVENT, requestD1OutboxManualRetry } from "./d1OutboxRetryEvent.js";

describe("d1OutboxRetryEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches the expected event name", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    requestD1OutboxManualRetry();
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const ev = dispatchEvent.mock.calls[0][0];
    expect(ev.type).toBe(D1_OUTBOX_MANUAL_RETRY_EVENT);
  });
});
