// Merged hazard library: base + extended + pro + construction sector extension
import BASE, { TRADE_CATEGORIES as BASE_TRADE_CATEGORIES } from "./ramsHazardLibrary";
import EXT, { EXTENDED_CATEGORIES } from "./ramsHazardLibraryExtended";
import PRO, { PRO_CATEGORIES } from "./ramsHazardLibraryPro";
import CONSTRUCTION, { CONSTRUCTION_CATEGORIES } from "./constructionHazardLibrary";
import SUPPLEMENT, { SUPPLEMENT_CATEGORIES } from "./ramsHazardLibrarySupplement";
import GEOSPATIAL, { GEOSPATIAL_CATEGORIES } from "./ramsHazardLibraryGeospatial";
import SITE_INVESTIGATION, { SITE_INVESTIGATION_CATEGORIES } from "./ramsHazardLibrarySiteInvestigation";
import FESS_EXCEL, { FESS_EXCEL_CATEGORIES } from "./fessExcelHazardLibrary";
import { getRiskLevel, RISK_COLORS } from "./ramsRiskLevel.js";

export const TRADE_CATEGORIES = [
  ...BASE_TRADE_CATEGORIES,
  ...EXTENDED_CATEGORIES,
  ...PRO_CATEGORIES,
  ...CONSTRUCTION_CATEGORIES.filter((c) => !BASE_TRADE_CATEGORIES.includes(c) && !EXTENDED_CATEGORIES.includes(c) && !PRO_CATEGORIES.includes(c)),
  ...SUPPLEMENT_CATEGORIES.filter((c) => !BASE_TRADE_CATEGORIES.includes(c) && !EXTENDED_CATEGORIES.includes(c) && !PRO_CATEGORIES.includes(c) && !CONSTRUCTION_CATEGORIES.includes(c)),
  ...GEOSPATIAL_CATEGORIES.filter(
    (c) =>
      !BASE_TRADE_CATEGORIES.includes(c) &&
      !EXTENDED_CATEGORIES.includes(c) &&
      !PRO_CATEGORIES.includes(c) &&
      !CONSTRUCTION_CATEGORIES.includes(c) &&
      !SUPPLEMENT_CATEGORIES.includes(c)
  ),
  ...SITE_INVESTIGATION_CATEGORIES.filter(
    (c) =>
      !BASE_TRADE_CATEGORIES.includes(c) &&
      !EXTENDED_CATEGORIES.includes(c) &&
      !PRO_CATEGORIES.includes(c) &&
      !CONSTRUCTION_CATEGORIES.includes(c) &&
      !SUPPLEMENT_CATEGORIES.includes(c) &&
      !GEOSPATIAL_CATEGORIES.includes(c)
  ),
  ...FESS_EXCEL_CATEGORIES.filter((c) => !BASE_TRADE_CATEGORIES.includes(c) && !EXTENDED_CATEGORIES.includes(c) && !PRO_CATEGORIES.includes(c)),
];

const CORE = [...BASE, ...EXT, ...PRO, ...CONSTRUCTION, ...SUPPLEMENT, ...GEOSPATIAL, ...SITE_INVESTIGATION];
const CORE_IDS = new Set(CORE.map((h) => h.id));
const ALL = [...CORE, ...FESS_EXCEL.filter((h) => !CORE_IDS.has(h.id))];

/** @param {string} [sector] */
export const getBySector = (sector) =>
  ALL.filter((h) => !sector || String(h.sector || "").toLowerCase() === String(sector).toLowerCase());

export const getByCategory = (category) => ALL.filter((h) => h.category === category);

export const searchHazards = (query) => {
  const q = query.toLowerCase();
  return ALL.filter(
    (h) =>
      h.activity.toLowerCase().includes(q) ||
      h.hazard.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q) ||
      String(h.sector || "").toLowerCase().includes(q)
  );
};

export { getRiskLevel, RISK_COLORS };
export default ALL;
