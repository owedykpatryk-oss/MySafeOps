import { describe, expect, it } from "vitest";
import { buildIntegrationAdaptersStatus } from "./permitIntegrationAdapters";

describe("buildIntegrationAdaptersStatus", () => {
  it("marks slack live when slack webhook configured", () => {
    const rows = buildIntegrationAdaptersStatus({
      slackEnabled: true,
      slackUrl: "https://hooks.slack.com/services/x",
    });
    const slack = rows.find((r) => r.channel === "slack");
    expect(slack?.enabled).toBe(true);
    expect(slack?.note).toContain("Live");
  });

  it("marks teams off without URL", () => {
    const rows = buildIntegrationAdaptersStatus({ teamsEnabled: true, teamsUrl: "" });
    expect(rows.find((r) => r.channel === "teams")?.enabled).toBe(false);
  });
});
