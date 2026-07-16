/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  listSurveyTypesForOrg,
  filterPlaybooksForUtilityMappingFocus,
  UM_FOCUS_SURVEY_TYPE_KEYS,
} from "./utilityMappingFocus";
import { getPlaybooksForOrg } from "./projectHubIndustry";
import { SURVEY_TYPES } from "../modules/surveyReport/surveyReportConstants";

describe("Utility Mapping focus (utility/topo only)", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org" });
  });

  it("keeps full survey type list for other orgs", () => {
    expect(listSurveyTypesForOrg(SURVEY_TYPES).length).toBe(SURVEY_TYPES.length);
  });

  it("limits survey types for Utility Mapping — no CCTV/UAV/laser", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const keys = listSurveyTypesForOrg(SURVEY_TYPES).map((t) => t.key);
    expect(keys).toEqual(UM_FOCUS_SURVEY_TYPE_KEYS);
    expect(keys).not.toContain("cctv_drainage_survey");
    expect(keys).not.toContain("uav_aerial");
    expect(keys).not.toContain("laser_scanning");
    expect(keys).not.toContain("asbestos_survey");
    expect(keys).toContain("utility_mapping_survey");
    expect(keys).toContain("topo_plus_utility_survey");
    expect(keys).toContain("gpr_survey");
  });

  it("filters hub playbooks to utility/topo jobs for Utility Mapping", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      industryPackId: "utilityMapping",
    });
    const ids = getPlaybooksForOrg().map((p) => p.id);
    expect(ids).toContain("um_pas128_m2");
    expect(ids).toContain("um_topo_plus_utility");
    expect(ids).not.toContain("drainage_connectivity");
    expect(ids.some((id) => id.includes("uav") || id.includes("cctv"))).toBe(false);

    const filtered = filterPlaybooksForUtilityMappingFocus([
      { id: "um_pas128_m2", orgExclusive: true },
      { id: "drainage_connectivity", surveyType: "drainage_connectivity_survey" },
      { id: "utility_mapping", surveyType: "utility_mapping_survey" },
    ]);
    expect(filtered.map((p) => p.id).sort()).toEqual(["um_pas128_m2", "utility_mapping"].sort());
  });
});
