/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  buildProjectHubPulse,
  computeProjectReadiness,
  todayBriefingStats,
} from "./projectHubPulse";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("projectHubPulse", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "generalContractor" });
  });
  const project = {
    id: "p1",
    name: "Alpha",
    lat: 53.1,
    weatherSnapshot: "Dry, 12°C",
    permitDefaults: { requiredPermitTypes: ["excavation"] },
  };

  const fullDash = {
    rams: [{ id: "r1" }],
    permits: [{ id: "pt1", type: "excavation", status: "active" }],
    surveys: [{ id: "s1" }],
    methodStatements: [{ id: "ms1" }],
    cdmPacks: [{ id: "c1" }],
    plans: [{ id: "pl1" }],
    dailyBriefings: [{ id: "b1", projectId: "p1", date: new Date().toISOString().slice(0, 10), attendees: [{ present: true, sig: "x" }] }],
    team: [{ id: "w1", name: "Bob" }],
    permitReady: { required: 1, issued: 1, complete: true },
    totals: { documents: 8, briefingToday: true, activePermits: 1, openSnags: 0, permitsMissingRams: 0 },
    timesheetSummary: { hoursThisWeek: 16, workersThisWeek: 2 },
  };

  it("scores readiness from gates", () => {
    const { score, gates } = computeProjectReadiness(project, fullDash);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(gates.find((g) => g.key === "briefing")?.ok).toBe(true);
  });

  it("builds pipeline with briefing warn when missing", () => {
    const dash = { ...fullDash, totals: { ...fullDash.totals, briefingToday: false }, dailyBriefings: [] };
    const pulse = buildProjectHubPulse(project, dash);
    expect(pulse.pipeline.find((s) => s.key === "briefing")?.status).toBe("warn");
  });

  it("summarises today briefing attendance", () => {
    const stats = todayBriefingStats(fullDash.dailyBriefings, "p1");
    expect(stats?.signed).toBe(1);
    expect(stats?.present).toBe(1);
  });
});
