// Merged hazard library: base + extended + pro (108+ hazards; categories include Traffic Management TMP)
import BASE, {
  TRADE_CATEGORIES as BASE_TRADE_CATEGORIES,
  getRiskLevel,
  RISK_COLORS,
} from "./ramsHazardLibrary";
import EXT, { EXTENDED_CATEGORIES } from "./ramsHazardLibraryExtended";
import PRO, { PRO_CATEGORIES } from "./ramsHazardLibraryPro";

export const TRADE_CATEGORIES = [
  ...BASE_TRADE_CATEGORIES,
  ...EXTENDED_CATEGORIES,
  ...PRO_CATEGORIES,
];

const ALL = [...BASE, ...EXT, ...PRO];

export const getByCategory = (category) => ALL.filter((h) => h.category === category);

export const searchHazards = (query) => {
  const q = query.toLowerCase();
  return ALL.filter(
    (h) =>
      h.activity.toLowerCase().includes(q) ||
      h.hazard.toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q)
  );
};

export { getRiskLevel, RISK_COLORS };
export default ALL;
