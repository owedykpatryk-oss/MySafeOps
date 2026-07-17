/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  getPlaybook,
  createRamsDraftFromPlaybook,
  applyProjectPlaybook,
  createSurveyDraftFromPlaybook,
  createGprDraftFromPlaybook,
} from "./projectPlaybooks";
import { siteContextBadgeLabel } from "../modules/rams/ramsPlaybookEnrichment";
import { inheritSiteContextOntoDoc } from "./inheritSiteContext";

describe("playbook site context P0", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      industryPackId: "utilityMapping",
    });
  });

  const project = {
    id: "proj_site_1",
    name: "Substation job",
    address: "Yard A",
    site: "DNO",
  };

  it("auto-applies pack + site overlay on RAMS draft from UM playbook", () => {
    const pb = getPlaybook("um_site_substation");
    expect(pb.siteContextKey).toBe("substation_hv");
    const rams = createRamsDraftFromPlaybook(project, pb);
    expect(rams.surveyWorkType).toBe("utility_mapping_survey");
    expect(rams.siteContextKey).toBe("substation_hv");
    expect(rams.scope).toMatch(/substation/i);
    expect(rams.surveyRequiredCerts?.length).toBeGreaterThan(0);
    expect((rams.rows || []).length).toBeGreaterThan(0);
    expect(siteContextBadgeLabel(rams)).toMatch(/Substation/i);
  });

  it("stores siteContextKey on project when playbook applied", () => {
    const result = applyProjectPlaybook(project, "um_site_rail", {
      rams: [],
      surveys: [],
      gprReports: [],
      permits: [],
      methodStatements: [],
    });
    expect(result.project.siteContextKey).toBe("rail_nr");
    expect(result.created.rams[0].siteContextKey).toBe("rail_nr");
  });

  it("survey and GPR drafts inherit site context from project/RAMS", () => {
    const pb = getPlaybook("um_site_highway");
    const rams = createRamsDraftFromPlaybook(project, pb);
    const proj = { ...project, siteContextKey: "highway_tm", siteContextLabel: "Live highway / Chapter 8 TM" };
    const survey = createSurveyDraftFromPlaybook(proj, pb, [], rams);
    expect(survey.siteContextKey).toBe("highway_tm");
    expect(survey.accessLimitationsNotes).toMatch(/Chapter 8|highway|TM/i);

    const gpr = createGprDraftFromPlaybook({ ...proj, playbookId: pb.id }, { ...pb, gprPlaybook: true }, [], rams);
    expect(gpr.siteContextKey).toBe("highway_tm");
    expect(gpr.acquisition?.notes).toMatch(/Highway|TM/i);
  });

  it("inheritSiteContextOntoDoc is idempotent and prefers doc key", () => {
    const next = inheritSiteContextOntoDoc(
      { siteContextKey: "brownfield", accessLimitationsNotes: "" },
      { siteContextKey: "rail_nr" },
      null
    );
    expect(next.siteContextKey).toBe("brownfield");
    expect(next.accessLimitationsNotes).toMatch(/brownfield|contamination/i);
  });
});
