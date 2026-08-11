/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import {
  PROJECT_PLAYBOOKS,
  getPlaybook,
  applyProjectPlaybook,
  projectHasRams,
  docsForProject,
  buildMissingDocChecklist,
  createRamsDraftFromPlaybook,
} from "./projectPlaybooks";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("projectPlaybooks", () => {
  const project = {
    id: "proj_1",
    name: "Test Site Alpha",
    address: "1 High Street, London",
    site: "Client Co",
  };

  it("exposes at least three named presets", () => {
    expect(PROJECT_PLAYBOOKS.length).toBeGreaterThanOrEqual(3);
    expect(getPlaybook("utility_mapping").id).toBe("utility_mapping");
    expect(getPlaybook("unknown").id).toBe("general");
  });

  it("creates RAMS draft with survey pack fields for utility mapping", () => {
    const pb = getPlaybook("utility_mapping");
    const rams = createRamsDraftFromPlaybook(project, pb);
    expect(rams.projectId).toBe("proj_1");
    expect(rams.surveyWorkType).toBe("utility_mapping_survey");
    expect(rams.surveyDeliverables).toMatch(/PAS ?128/i);
    expect(rams.documentNo).toMatch(/^RAMS-/);
  });

  it("creates RAMS draft for site investigation playbook", () => {
    const pb = getPlaybook("site_investigation");
    const rams = createRamsDraftFromPlaybook(project, pb);
    expect(rams.surveyWorkType).toBe("site_investigation_campaign");
    expect(pb.permitTypes).toContain("ground_disturbance");
  });

  it("topo playbook drafts topographical survey without PAS128 QL", () => {
    const pb = getPlaybook("topo");
    expect(pb.surveyType).toBe("topographical_survey");
    const result = applyProjectPlaybook(project, pb.id, {
      rams: [],
      surveys: [],
      gprReports: [],
      permits: [],
      methodStatements: [],
    });
    expect(result.applied).toBe(true);
    expect(result.created.surveys[0].surveyType).toBe("topographical_survey");
    expect(result.created.surveys[0].pas128Ql || "").toBe("");
    expect(result.created.gprReports).toHaveLength(0);
  });

  it("applyProjectPlaybook creates RAMS, survey, permits and MS when empty", () => {
    const pb = getPlaybook("utility_mapping");
    const result = applyProjectPlaybook(project, pb.id, {
      rams: [],
      surveys: [],
      gprReports: [],
      permits: [],
      methodStatements: [],
    });
    expect(result.applied).toBe(true);
    expect(result.created.rams).toHaveLength(1);
    expect(result.created.surveys).toHaveLength(1);
    expect(result.created.surveys[0].surveyType).toBe("utility_mapping_survey");
    expect(result.created.surveys[0].pas128Ql).toBe("B1");
    expect(result.created.gprReports).toHaveLength(1);
    expect(result.created.gprReports[0].ref).toMatch(/^GPR-/);
    expect(result.created.permits.length).toBeGreaterThan(0);
    expect(result.created.methodStatements).toHaveLength(1);
    expect(result.project.playbookId).toBe("utility_mapping");
    expect(result.project.startupChecklist.length).toBeGreaterThan(0);
  });

  it("applyProjectPlaybook skips docs that already exist", () => {
    const pb = getPlaybook("utility_mapping");
    const existingRams = createRamsDraftFromPlaybook(project, pb);
    const first = applyProjectPlaybook(project, pb.id, {
      rams: [existingRams],
      surveys: [],
      permits: [],
      methodStatements: [],
    });
    expect(first.created.rams).toHaveLength(0);
    expect(first.created.surveys).toHaveLength(1);
  });

  it("buildMissingDocChecklist lists absent modules", () => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "surveyingGeodesy" });
    const items = buildMissingDocChecklist({ rams: [], surveys: [], permits: [], methodStatements: [], plans: [] });
    expect(items.some((i) => i.actionType === "create_rams")).toBe(true);
    expect(items.some((i) => i.actionType === "create_survey")).toBe(true);
    expect(items.some((i) => i.actionType === "capture_geo_photos")).toBe(true);
  });

  it("projectHasRams detects linked RAMS", () => {
    expect(projectHasRams("proj_1", [{ projectId: "proj_1" }])).toBe(true);
    expect(projectHasRams("proj_1", [{ projectId: "other" }])).toBe(false);
    expect(projectHasRams("", [])).toBe(true);
    expect(projectHasRams("proj_1", { broken: true })).toBe(false);
  });

  it("docsForProject tolerates corrupted non-array rows", () => {
    expect(docsForProject("proj_1", [{ projectId: "proj_1", id: "a" }])).toHaveLength(1);
    expect(docsForProject("proj_1", { broken: true })).toEqual([]);
  });
});
