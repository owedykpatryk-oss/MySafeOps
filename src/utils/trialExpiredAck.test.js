/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  acknowledgeTrialExpired,
  clearTrialExpiredAck,
  hasAcknowledgedTrialExpired,
} from "./trialExpiredAck";

describe("trialExpiredAck", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "org-a");
  });

  it("tracks acknowledgement per org", () => {
    expect(hasAcknowledgedTrialExpired("org-a")).toBe(false);
    acknowledgeTrialExpired("org-a");
    expect(hasAcknowledgedTrialExpired("org-a")).toBe(true);
    expect(hasAcknowledgedTrialExpired("org-b")).toBe(false);
  });

  it("clears acknowledgement", () => {
    acknowledgeTrialExpired("org-a");
    clearTrialExpiredAck("org-a");
    expect(hasAcknowledgedTrialExpired("org-a")).toBe(false);
  });
});
