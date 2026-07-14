import { describe, expect, it } from "vitest";
import {
  buildPermitIntegrationSummary,
  detectIncomingWebhookKind,
  formatSlackWebhookPayload,
  formatTeamsWebhookPayload,
} from "./permitIntegrationNotify";

describe("permitIntegrationNotify", () => {
  const permit = {
    id: "PTW-001",
    type: "hot_work",
    status: "active",
    location: "Level 3 plant room",
    issuedTo: "Sparky Ltd",
  };

  it("detects Slack and Teams webhook URLs", () => {
    expect(detectIncomingWebhookKind("https://hooks.slack.com/services/T/B/x")).toBe("slack");
    expect(detectIncomingWebhookKind("https://outlook.office.com/webhook/abc")).toBe("teams");
    expect(detectIncomingWebhookKind("https://example.com/hook")).toBe("generic");
  });

  it("builds human summary for issued events", () => {
    const summary = buildPermitIntegrationSummary("issued", permit);
    expect(summary).toContain("hot work");
    expect(summary).toContain("Level 3");
    expect(summary).toContain("PTW-001");
  });

  it("formats Slack blocks payload", () => {
    const payload = formatSlackWebhookPayload("issued", permit);
    expect(payload.text).toContain("PTW-001");
    expect(payload.blocks?.[0]?.type).toBe("header");
  });

  it("formats Teams message card", () => {
    const payload = formatTeamsWebhookPayload("deleted", permit);
    expect(payload["@type"]).toBe("MessageCard");
    expect(payload.sections?.[0]?.facts?.length).toBeGreaterThan(0);
  });
});
