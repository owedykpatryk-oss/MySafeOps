/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { collectProjectDashboard } from "./projectDashboard";
import { buildProjectHubPulse } from "./projectHubPulse";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

function newProject() {
  return {
    id: "w_test_proj_1",
    name: "Test mobilisation",
    site: "Unit test site",
    postcode: "KT22 7SH",
    lat: 51.32,
    lng: -0.26,
    permitDefaults: { requiredPermitTypes: ["excavation"] },
    startupChecklist: [
      { id: "chk1", text: "Invite site team", status: "todo" },
      { id: "chk2", text: "Review permit flow", status: "todo", actionType: "create_permit" },
    ],
    healthScore: 12,
    industryStarter: "general",
  };
}

describe("ProjectDashboard hub data", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({ industryPackId: "surveyingGeodesy" });
  });

  it("collectProjectDashboard tolerates non-array storage rows", () => {
    localStorage.setItem("geo_photos_test-org", JSON.stringify({ broken: true }));
    localStorage.setItem("rams_builder_docs_test-org", "null");
    localStorage.setItem("electrical_pat_log_test-org", JSON.stringify({ not: "array" }));
    const dash = collectProjectDashboard(newProject(), []);
    expect(Array.isArray(dash.geoPhotos)).toBe(true);
    expect(Array.isArray(dash.rams)).toBe(true);
    expect(() => buildProjectHubPulse(newProject(), dash)).not.toThrow();
    const pulse = buildProjectHubPulse(newProject(), dash);
    expect(pulse.pipeline.every((step) => step?.key)).toBe(true);
  });

  it("buildProjectHubPulse works for a freshly created project shape", () => {
    const project = newProject();
    const dash = collectProjectDashboard(project, []);
    const pulse = buildProjectHubPulse(project, dash);
    expect(pulse.readiness).toBeGreaterThanOrEqual(0);
    expect(pulse.pipelineTotal).toBeGreaterThan(0);
    expect(dash.totals.documents).toBe(0);
  });
});
