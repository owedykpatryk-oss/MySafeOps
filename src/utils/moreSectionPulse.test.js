/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMoreSectionPulse, buildMoreCommandCentrePulse } from "./moreSectionPulse";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

vi.mock("./orgStorage", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadOrgScoped: vi.fn(() => []),
  };
});

import { loadOrgScoped } from "./orgStorage";

describe("moreSectionPulse", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "generalContractor" });
    vi.mocked(loadOrgScoped).mockReturnValue([]);
  });

  it("prioritises daily briefing when none logged today (site)", () => {
    vi.mocked(loadOrgScoped).mockImplementation((key) => {
      if (key === "daily_briefings") {
        return [{ id: "b1", date: "2026-01-01", attendees: [] }];
      }
      return [];
    });
    const pulse = buildMoreSectionPulse(
      "site",
      [{ id: "daily-briefing" }, { id: "snags" }],
      {
        "daily-briefing": { status: "active", count: 1, attentionCount: 0 },
        snags: { status: "active", count: 0, attentionCount: 0 },
      },
    );
    expect(pulse.nextAction?.viewId).toBe("daily-briefing");
    expect(pulse.nextAction?.label).toMatch(/today/i);
  });

  it("combines site and HSE scores for command centre", () => {
    const pulse = buildMoreCommandCentrePulse(
      [{ id: "daily-briefing" }],
      [{ id: "inspections" }],
      {
        "daily-briefing": { status: "active", count: 2, attentionCount: 0 },
        inspections: { status: "attention", count: 3, attentionCount: 1 },
      },
    );
    expect(pulse.combinedScore).toBeGreaterThan(0);
    expect(pulse.attentionModules.length).toBeGreaterThan(0);
  });
});
