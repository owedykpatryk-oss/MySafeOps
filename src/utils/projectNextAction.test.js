/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildProjectActionContext,
  pickNextActionForProject,
  listProjectsWithNextActions,
} from "./projectNextAction";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("projectNextAction", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });
  const project = { id: "p1", name: "Alpha Site", permitDefaults: { requiredPermitTypes: ["excavation"] } };

  it("prioritises RAMS when missing", () => {
    const ctx = buildProjectActionContext({});
    const a = pickNextActionForProject(project, ctx);
    expect(a?.label).toBe("Create RAMS");
    expect(a?.viewId).toBe("rams");
  });

  it("suggests PTW when RAMS exists but required permit missing", () => {
    const ctx = buildProjectActionContext({
      rams: [{ id: "r1", projectId: "p1" }],
      permits: [],
    });
    const a = pickNextActionForProject(project, ctx);
    expect(a?.label).toMatch(/Issue.*PTW/i);
    expect(a?.viewId).toBe("permits");
  });

  it("prioritises survey QA completion for surveying orgs", () => {
    saveOrgSettingsRaw({ industryPackId: "surveyingGeodesy" });
    const old = new Date();
    old.setDate(old.getDate() - 20);
    const today = new Date().toISOString().slice(0, 10);
    const ctx = buildProjectActionContext({
      rams: [{ id: "r1", projectId: "p1" }],
      permits: [{ id: "ptw1", projectId: "p1", type: "excavation", status: "active", location: "Site A", linkedRamsId: "r1" }],
      surveys: [{ id: "s1", projectId: "p1", status: "draft", updatedAt: old.toISOString() }],
      methodStatements: [{ id: "ms1", projectId: "p1" }],
      dailyBriefings: [{ id: "b1", projectId: "p1", date: today }],
    });
    const a = pickNextActionForProject(project, ctx);
    expect(a?.label).toBe("Complete survey QA checklist");
    expect(a?.reportId).toBe("s1");
  });

  it("suggests daily briefing when none recorded today", () => {
    const ctx = buildProjectActionContext({
      rams: [{ id: "r1", projectId: "p1" }],
      permits: [{ id: "ptw1", projectId: "p1", type: "excavation", status: "active", location: "Site A", linkedRamsId: "r1" }],
      surveys: [{ id: "s1", projectId: "p1", status: "final" }],
      methodStatements: [{ id: "ms1", projectId: "p1" }],
      dailyBriefings: [],
    });
    const a = pickNextActionForProject(project, ctx);
    expect(a?.label).toBe("Record today's briefing");
    expect(a?.viewId).toBe("daily-briefing");
  });

  it("listProjectsWithNextActions returns only projects needing work", () => {
    const ctx = buildProjectActionContext({});
    const rows = listProjectsWithNextActions(
      [project, { id: "p2", name: "Done", closed: true }],
      ctx
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].project.id).toBe("p1");
  });
});
