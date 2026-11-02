/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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
import { openWorkspaceView } from "./workspaceNavContext";

vi.mock("./workspaceNavContext", () => ({
  openWorkspaceView: vi.fn(),
  setWorkspaceNavTarget: vi.fn(),
}));

describe("fessClientHub", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("does not report a complete job pack when the project update cannot be saved", () => {
    ensureFessSiteProject("fess_site_quorn");
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).startsWith("mysafeops_projects_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(launchFessSiteJobPack("fess_site_quorn")).toMatchObject({ ok: false, reason: "storage_failed" });
    expect(openWorkspaceView).not.toHaveBeenCalled();
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
        documentStatus: "issued",
        signatureEvents: [{ action: "issue_released" }],
        operativeSignatures: { worker: { signedAt: now } },
        clientApproval: { at: now },
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
    expect(docs[0].documentStatus).toBe("draft");
    expect(docs[0].signatureEvents).toEqual([]);
    expect(docs[0].operativeSignatures).toEqual({});
    expect(docs[0].clientApproval).toBeNull();
    expect(docs[1].documentStatus).toBe("issued");
    expect(docs[0].documentNo).toBe(result.jobRef);
  });

  it("does not open an unsaved repeat visit when device storage is full", () => {
    const project = ensureFessSiteProject("fess_site_butternut");
    const original = { id: "r1", projectId: project.id, title: "Original", status: "issued", rows: [] };
    save("rams_builder_docs", [original]);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key.startsWith("rams_builder_docs_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(duplicateFessRamsForSite("fess_site_butternut")).toMatchObject({ ok: false, reason: "storage_failed" });
    expect(load("rams_builder_docs", [])).toEqual([original]);
    expect(openWorkspaceView).not.toHaveBeenCalled();
  });

  it("does not copy a deleted RAMS for a repeat visit", () => {
    const project = ensureFessSiteProject("fess_site_butternut");
    save("rams_builder_docs", [{ id: "deleted", projectId: project.id, deletedAt: "2026-10-01", rows: [] }]);
    expect(duplicateFessRamsForSite("fess_site_butternut")).toMatchObject({ ok: false, reason: "no_rams" });
    expect(openWorkspaceView).not.toHaveBeenCalled();
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
