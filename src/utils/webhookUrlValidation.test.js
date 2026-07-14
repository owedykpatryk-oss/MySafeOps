import { describe, expect, it } from "vitest";
import { sanitizeWebhookConfigUrls, validateOutboundWebhookUrl } from "./webhookUrlValidation";

describe("validateOutboundWebhookUrl", () => {
  it("accepts public HTTPS Slack webhook", () => {
    const r = validateOutboundWebhookUrl("https://hooks.slack.com/services/T/B/x");
    expect(r.ok).toBe(true);
  });

  it("rejects private IP targets", () => {
    expect(validateOutboundWebhookUrl("https://192.168.1.1/hook").ok).toBe(false);
    expect(validateOutboundWebhookUrl("https://10.0.0.5/hook").ok).toBe(false);
  });

  it("rejects credentials in URL", () => {
    expect(validateOutboundWebhookUrl("https://user:pass@example.com/hook").ok).toBe(false);
  });

  it("rejects plain HTTP except localhost in dev", () => {
    expect(validateOutboundWebhookUrl("http://example.com/hook", { allowHttpLocalhost: false }).ok).toBe(false);
    expect(validateOutboundWebhookUrl("http://localhost:8080/hook", { allowHttpLocalhost: true }).ok).toBe(true);
  });

  it("sanitize strips invalid URLs", () => {
    const out = sanitizeWebhookConfigUrls({
      url: "https://hooks.slack.com/services/x",
      slackUrl: "https://192.168.0.1/x",
      teamsUrl: "",
    });
    expect(out.url).toContain("hooks.slack.com");
    expect(out.slackUrl).toBe("");
  });
});
