/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setOrgId, loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  buildFessClientDirectory,
  duplicateFessRamsForSite,
  findProjectForFessSite,
  generateFessJobRef,
  getFessSiteDocStats,
  launchFessSiteJobPack,
} from "./fessClientHub";
import { ensureFessSiteProject } from "./fessClientSites";
import { getFessJobStarter } from "./fessJobStarters";

vi.mock("./workspaceNavContext", () => ({
  openWorkspaceView: vi.fn(),
  setWorkspaceNavTarget: vi.fn(),
}));

describe("fessClientHub", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", slug: "fess-group", industryPackId: "fessGroup" });
    save("mysafeops_projects", []);
    save("rams_builder_docs", []);
    save("permits_v2", []);
    save("method_statements", []);
  });

  it("returns empty directory for non-FESS org", () => {
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Acme Ltd", slug: "acme-ltd" });
    expect(buildFessClientDirectory()).toEqual([]);
  });

  it("groups six MC reference sites by client", () => {
    const groups = buildFessClientDirectory();
    expect(groups.length).toBeGreaterThanOrEqual(4);
    const totalSites = groups.reduce((n, g) => n + g.siteCount, 0);
    expect(totalSites).toBe(6);
    const twoSisters = groups.find((g) => g.client.includes("2 Sisters"));
    expect(twoSisters?.siteCount).toBe(2);
  });

  it("generates FESS-style job refs from starter prefix", () => {
    const starter = getFessJobStarter("dolav_meyn");
    const ref = generateFessJobRef(starter);
    expect(ref).toMatch(/^FP1-DOLAV-\d{4}-\d{3}$/);
  });

  it("ensures site project and launches job pack", () => {
    const project = ensureFessSiteProject("fess_site_quorn");
    expect(project?.client).toMatch(/Quorn/i);
    expect(project?.fessSiteTemplateId).toBe("fess_site_quorn");

    const result = launchFessSiteJobPack("fess_site_quorn");
    expect(result.ok).toBe(true);
    const projects = load("mysafeops_projects", []);
    expect(findProjectForFessSite("fess_site_quorn", projects)?.id).toBe(project.id);
  });

  it("duplicates latest RAMS for repeat visit with new job ref", () => {
    const project = ensureFessSiteProject("fess_site_butternut");
    const now = new Date().toISOString();
    save("rams_builder_docs", [
      {
        id: "rams_test_1",
        projectId: project.id,
        title: "Spiral conveyor RAMS",
        status: "issued",
        rows: [{ hazard: "test" }],
        fessJobStarterKey: "spiral_conveyor",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = duplicateFessRamsForSite("fess_site_butternut");
    expect(result.ok).toBe(true);
    expect(result.jobRef).toMatch(/^SPIRAL-CO-\d{4}-\d{3}$/);

    const docs = load("rams_builder_docs", []);
    expect(docs.length).toBe(2);
    expect(docs[0].status).toBe("draft");
    expect(docs[0].documentNo).toBe(result.jobRef);
  });

  it("computes site doc stats", () => {
    const stats = getFessSiteDocStats(
      "proj_1",
      [
        { projectId: "proj_1", status: "draft" },
        { projectId: "proj_1", status: "issued" },
      ],
      [{ projectId: "proj_1", status: "active", permitType: "line_clearance" }],
      [{ projectId: "proj_1" }]
    );
    expect(stats.ramsCount).toBe(2);
    expect(stats.draftRams).toBe(1);
    expect(stats.activePermits).toBe(1);
    expect(stats.lineClearanceOpen).toBe(1);
    expect(stats.hasFullPack).toBe(true);
  });
});
