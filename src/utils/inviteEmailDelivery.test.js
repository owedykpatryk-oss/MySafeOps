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

  it("explains Resend test-mode / unverified domain errors", () => {
    const out = formatInviteEmailDeliveryDetail(
      JSON.stringify({
        statusCode: 403,
        name: "validation_error",
        message:
          "You can only send testing emails to your own email address (owedykpatryk@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.",
      })
    );
    expect(out).toMatch(/verify mysafeops\.com/i);
    expect(out).toMatch(/support@mysafeops\.com/i);
  });

  it("explains Cloudflare HTML outage pages from Resend", () => {
    const out = formatInviteEmailDeliveryDetail(
      `<!DOCTYPE html><html><title>resend.com | 520: Web server is returning an unknown error</title><div class="cf-error-details">Error code 520</div></html>`
    );
    expect(out).toMatch(/temporarily unavailable/i);
    expect(out).toMatch(/520/);
    expect(out).not.toMatch(/<!DOCTYPE/i);
  });
});
