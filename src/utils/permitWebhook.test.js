import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

vi.mock("./orgStorage", () => ({
  loadOrgScoped: vi.fn(() => ({
    enabled: true,
    url: "https://hooks.slack.com/services/T00/B00/XXX",
    slackEnabled: false,
    slackUrl: "",
    teamsEnabled: false,
    teamsUrl: "",
    events: ["issued", "status_changed", "deleted"],
  })),
  saveOrgScoped: vi.fn(),
}));

vi.mock("./permitIntegrationNotify", () => ({
  detectIncomingWebhookKind: vi.fn(() => "slack"),
  pickWebhookPayload: vi.fn(() => ({ text: "hi" })),
  postIncomingWebhook: vi.fn(async () => ({ ok: true, status: 200 })),
}));

import { dispatchPermitWebhook } from "./permitWebhook.js";
import { postIncomingWebhook } from "./permitIntegrationNotify.js";

describe("dispatchPermitWebhook", () => {
  beforeEach(() => {
    vi.mocked(postIncomingWebhook).mockClear();
  });

  it("uses browser fallback in non-prod when Edge is unavailable", async () => {
    const prev = import.meta.env.PROD;
    // Vitest runs as non-PROD by default
    expect(import.meta.env.PROD).toBe(false);
    const out = await dispatchPermitWebhook("issued", { id: "p1", type: "hot_work", location: "Bay 1", status: "live" });
    expect(out.via).toBe("browser");
    expect(postIncomingWebhook).toHaveBeenCalled();
    void prev;
  });
});
