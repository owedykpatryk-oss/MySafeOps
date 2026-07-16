/**
 * RAMS starter options for custom profile editor — split to avoid customWorkspaceProfiles cycles.
 */
import { getRamsStarterLabel, isSurveyRamsStarterKey, isValidTradeRamsStarterKey } from "./ramsIndustryStarters";

/** RAMS starter options for profile editor. */
export function ramsStarterOptionsForEditor() {
  const tradeKeys = [
    "general",
    "electrical",
    "refurb_build",
    "groundworks",
    "demolition",
    "geospatial_intelligence",
    "utility_mapping_survey",
    "healthcare_fm",
  ];
  return tradeKeys
    .map((key) => ({
      key,
      label: getRamsStarterLabel(key),
    }))
    .filter((o) => isSurveyRamsStarterKey(o.key) || isValidTradeRamsStarterKey(o.key) || o.key === "geospatial_intelligence");
}
