/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { formatInviteEmailDeliveryDetail } from "./inviteEmailDelivery";

describe("formatInviteEmailDeliveryDetail", () => {
  it("maps missing Resend key to admin setup guidance", () => {
    const out = formatInviteEmailDeliveryDetail("RESEND_API_KEY not set");
    expect(out).toMatch(/RESEND_API_KEY/);
    expect(out).toMatch(/Edge Functions/);
    expect(out).toMatch(/invite link manually/i);
  });

  it("passes through other provider errors", () => {
    expect(formatInviteEmailDeliveryDetail("Resend failed: 429")).toBe("Resend failed: 429");
  });
});
