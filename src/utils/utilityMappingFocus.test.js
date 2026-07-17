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

describe("Utility Mapping focus (survey-related types)", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org" });
  });

  it("keeps full survey type list for other orgs", () => {
    expect(listSurveyTypesForOrg(SURVEY_TYPES).length).toBe(SURVEY_TYPES.length);
  });

  it("includes laser, topo, CCTV and UAV for Utility Mapping; excludes asbestos", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const keys = listSurveyTypesForOrg(SURVEY_TYPES).map((t) => t.key);
    expect(keys).toEqual(UM_FOCUS_SURVEY_TYPE_KEYS.filter((k) => keys.includes(k)));
    expect(keys).toContain("laser_scanning");
    expect(keys).toContain("topographical_survey");
    expect(keys).toContain("cctv_drainage_survey");
    expect(keys).toContain("uav_aerial");
    expect(keys).toContain("utility_mapping_survey");
    expect(keys).toContain("gpr_survey");
    expect(keys).not.toContain("asbestos_survey");
  });

  it("keeps UM playbooks including topo TS/GNSS and laser", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      industryPackId: "utilityMapping",
    });
    const ids = getPlaybooksForOrg().map((p) => p.id);
    expect(ids).toContain("um_pas128_m2");
    expect(ids).toContain("um_topo_plus_utility");
    expect(ids).toContain("um_topo_ts_gnss");
    expect(ids).toContain("um_laser_scanning");
    expect(ids).toContain("um_site_treatment");
    expect(ids).toContain("um_site_substation");
    expect(ids).toContain("um_site_rail");

    const filtered = filterPlaybooksForUtilityMappingFocus([
      { id: "um_pas128_m2", orgExclusive: true },
      { id: "drainage_connectivity", surveyType: "drainage_connectivity_survey" },
      { id: "utility_mapping", surveyType: "utility_mapping_survey" },
      { id: "asbestos_job", surveyType: "asbestos_survey" },
    ]);
    expect(filtered.map((p) => p.id).sort()).toEqual(
      ["drainage_connectivity", "um_pas128_m2", "utility_mapping"].sort()
    );
  });
});
