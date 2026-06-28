/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import {
  buildProjectActionContext,
  pickNextActionForProject,
  listProjectsWithNextActions,
} from "./projectNextAction";

describe("projectNextAction", () => {
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

  it("flags stale survey drafts", () => {
    const old = new Date();
    old.setDate(old.getDate() - 20);
    const ctx = buildProjectActionContext({
      rams: [{ id: "r1", projectId: "p1" }],
      permits: [{ id: "ptw1", projectId: "p1", type: "excavation", status: "active", location: "Site A", linkedRamsId: "r1" }],
      surveys: [{ id: "s1", projectId: "p1", status: "draft", updatedAt: old.toISOString() }],
      methodStatements: [{ id: "ms1", projectId: "p1" }],
    });
    const a = pickNextActionForProject(project, ctx);
    expect(a?.label).toMatch(/Survey draft idle/i);
    expect(a?.reportId).toBe("s1");
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
