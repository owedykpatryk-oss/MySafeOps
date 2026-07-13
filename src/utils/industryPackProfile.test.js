/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { applyIndustryPack } from "./orgIndustryPacks";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { saveOrgScoped } from "./orgStorage";
import {
  previewPackSwitch,
  applyIndustryReadinessGates,
  pickIndustryMoreNextAction,
  pickIndustryProjectNextAction,
  getIndustryPackLabel,
  getPackWorkflowHelp,
  getIndustrySitePackTitle,
} from "./industryPackProfile";

describe("industryPackProfile", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("previewPackSwitch describes survey vs inspections change", () => {
    const preview = previewPackSwitch("generalContractor", "surveyingGeodesy");
    expect(preview.changes.some((c) => c.includes("Survey"))).toBe(true);
    expect(preview.label).toBe("Surveying & geodesy");
  });

  it("previewPackSwitch localizes RAMS/CDM for AU market", () => {
    const preview = previewPackSwitch("showEverything", "generalContractor", "au");
    expect(preview.changes.some((c) => /SWMS|WHS/i.test(c))).toBe(true);
    expect(preview.changes.join(" ")).not.toMatch(/\bRAMS\b/);
  });

  it("getPackWorkflowHelp localizes electrical summary for AU", () => {
    const help = getPackWorkflowHelp("electricalContractor", "au");
    expect(help.summary).toMatch(/SWMS/i);
  });

  it("getIndustrySitePackTitle localizes for AU market", () => {
    expect(getIndustrySitePackTitle("generalContractor", "uk")).toMatch(/RAMS|Contractor/i);
    expect(getIndustrySitePackTitle("generalContractor", "au")).toMatch(/SWMS|Contractor/i);
  });

  it("electrical pack adds hot work readiness gate", () => {
    applyIndustryPack("electricalContractor");
    const gates = [
      { key: "plans", label: "Drawings", max: 5, ok: false, points: 0 },
    ];
    applyIndustryReadinessGates(
      gates,
      { id: "p1" },
      { permits: [{ type: "hot_work", status: "active" }] },
      "electricalContractor"
    );
    expect(gates.find((g) => g.key === "hotwork")?.ok).toBe(true);
  });

  it("pickIndustryMoreNextAction surfaces overdue PAT for electrical org", () => {
    applyIndustryPack("electricalContractor");
    saveOrgScoped("electrical_pat_log", [{ id: "1", nextTestDue: "2020-01-01" }]);
    const action = pickIndustryMoreNextAction("electricalContractor");
    expect(action?.viewId).toBe("electrical-pat");
    expect(action?.label).toMatch(/PAT/i);
  });

  it("pickIndustryProjectNextAction suggests inspection for electrical project", () => {
    applyIndustryPack("electricalContractor");
    const action = pickIndustryProjectNextAction(
      { id: "p1" },
      {
        ramsByProject: { p1: [{}] },
        permitsByProject: { p1: [{}] },
        inspectionsByProject: { p1: [] },
      },
      "electricalContractor"
    );
    expect(action?.viewId).toBe("inspections");
  });

  it("getIndustryPackLabel falls back to general contractor", () => {
    expect(getIndustryPackLabel()).toBe("General construction & trades");
  });
});
