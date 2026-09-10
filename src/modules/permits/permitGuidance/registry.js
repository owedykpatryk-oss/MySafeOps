import PermitDigGuidancePanel from "../components/PermitDigGuidancePanel";
import PermitHotWorkGuidancePanel from "./components/PermitHotWorkGuidancePanel";
import PermitWahGuidancePanel from "./components/PermitWahGuidancePanel";
import PermitConfinedSpaceGuidancePanel from "./components/PermitConfinedSpaceGuidancePanel";
import { getOrgMarketId } from "../../../utils/orgMarket";
import {
  isDigPermitType,
  isUkDigGuidanceMarket,
  renderDigGuidancePrintHtml,
  mechanicalDigAssessment,
  DIG_EXTRA_FIELD_KEYS,
} from "../permitDigGuidance";
import {
  isHotWorkPermitType,
  hotWorkAssessment,
  renderHotWorkPrintHtml,
  HOT_WORK_EXTRA_FIELD_KEYS,
} from "./hotWorkGuidance";
import {
  isWahPermitType,
  wahAssessment,
  renderWahPrintHtml,
  WAH_EXTRA_FIELD_KEYS,
} from "./wahGuidance";
import {
  isConfinedPermitType,
  confinedSpaceAssessment,
  renderConfinedPrintHtml,
  CONFINED_EXTRA_FIELD_KEYS,
} from "./confinedSpaceGuidance";

/** @typedef {{ Panel: import('react').ComponentType<any>, renderPrintHtml: Function, assess?: Function, extraFieldKeys?: string[], wizardHint?: string, theme?: { border: string, bg: string, color: string } }} PermitGuidanceEntry */

/** @type {Record<string, PermitGuidanceEntry>} */
const REGISTRY = {
  excavation: {
    Panel: PermitDigGuidancePanel,
    renderPrintHtml: renderDigGuidancePrintHtml,
    assess: (_, extra) => mechanicalDigAssessment(extra),
    extraFieldKeys: DIG_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes PAS 128 graphics (QL-D→A, survey types D/C/B1/B2/B3/A), hand-dig buffer and utility strike card.",
    theme: { border: "#86efac", bg: "#f0fdf4", color: "#14532d" },
    matches: isDigPermitType,
  },
  ground_disturbance: {
    Panel: PermitDigGuidancePanel,
    renderPrintHtml: renderDigGuidancePrintHtml,
    assess: (_, extra) => mechanicalDigAssessment(extra),
    extraFieldKeys: DIG_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes PAS 128 graphics (QL-D→A, survey types D/C/B1/B2/B3/A), hand-dig buffer and utility strike card.",
    theme: { border: "#86efac", bg: "#f0fdf4", color: "#14532d" },
    matches: isDigPermitType,
  },
  hot_work: {
    Panel: PermitHotWorkGuidancePanel,
    renderPrintHtml: renderHotWorkPrintHtml,
    assess: (permit, extra, marketId) => hotWorkAssessment(extra, permit, marketId),
    extraFieldKeys: HOT_WORK_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes 10 m zone diagram, fire watch timeline (min 60 min) and GO/NO-GO panel.",
    theme: { border: "#fca5a5", bg: "#fef2f2", color: "#991b1b" },
    matches: isHotWorkPermitType,
  },
  work_at_height: {
    Panel: PermitWahGuidancePanel,
    renderPrintHtml: renderWahPrintHtml,
    assess: (_, extra, marketId) => wahAssessment(extra, marketId),
    extraFieldKeys: WAH_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes WAH hierarchy (Avoid → Prevent → Mitigate), access method and exclusion zone.",
    theme: { border: "#fcd34d", bg: "#fffbeb", color: "#854F0B" },
    matches: isWahPermitType,
  },
  roof_access: {
    Panel: PermitWahGuidancePanel,
    renderPrintHtml: renderWahPrintHtml,
    assess: (_, extra, marketId) => wahAssessment(extra, marketId),
    extraFieldKeys: WAH_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes WAH hierarchy, roof access controls and exclusion zone below work.",
    theme: { border: "#fcd34d", bg: "#fffbeb", color: "#854F0B" },
    matches: isWahPermitType,
  },
  confined_space: {
    Panel: PermitConfinedSpaceGuidancePanel,
    renderPrintHtml: renderConfinedPrintHtml,
    assess: (_, extra) => confinedSpaceAssessment(extra),
    extraFieldKeys: CONFINED_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes atmospheric gauge panel, role diagram and entry sequence.",
    theme: { border: "#fca5a5", bg: "#fef2f2", color: "#791F1F" },
    matches: isConfinedPermitType,
  },
};

function wizardHintFor(key, marketId, fallback) {
  if (key === "hot_work") {
    if (marketId === "pl") {
      return "Krok 2 zawiera strefę 10 m, harmonogram dyżuru pożarowego (min. 60 min) i panel GO/NO-GO.";
    }
    if (marketId === "au") {
      return "Step 2 includes 10 m zone diagram, fire watch timeline (min 60 min) and WHS GO/NO-GO panel.";
    }
  }
  if (key === "work_at_height") {
    if (marketId === "pl") {
      return "Krok 2 zawiera hierarchię BHP (Unikaj → Zapobiegaj → Ograniczaj skutki), metodę dostępu i strefę wyłączoną.";
    }
    if (marketId === "au") {
      return "Step 2 includes WHS hierarchy of control (Avoid → Prevent → Mitigate), access method and exclusion zone.";
    }
  }
  if (key === "roof_access") {
    if (marketId === "pl") {
      return "Krok 2 zawiera hierarchię BHP, kontrolę wejścia na dach i strefę wyłączoną pod robotami.";
    }
    if (marketId === "au") {
      return "Step 2 includes WHS hierarchy of control, roof access controls and exclusion zone below work.";
    }
  }
  return fallback;
}

export function getPermitGuidance(type, marketId = getOrgMarketId()) {
  const key = String(type || "").trim();
  const entry = REGISTRY[key] || null;
  if (!entry) return null;
  if (isDigPermitType(key) && !isUkDigGuidanceMarket(marketId)) return null;
  const wizardHint = wizardHintFor(key, marketId, entry.wizardHint);
  return wizardHint === entry.wizardHint ? entry : { ...entry, wizardHint };
}

export function hasPermitGuidance(type, marketId = getOrgMarketId()) {
  return Boolean(getPermitGuidance(type, marketId));
}

/** Unified print section for all guidance-enabled permit types. */
export function renderGuidancePrintHtml(permit, options = {}) {
  const entry = getPermitGuidance(permit?.type, options.marketId);
  if (!entry?.renderPrintHtml) return "";
  return entry.renderPrintHtml(permit, options);
}

export function runGuidanceAssessment(permit) {
  const marketId = getOrgMarketId();
  const entry = getPermitGuidance(permit?.type, marketId);
  if (!entry?.assess) return { warnings: [], blockers: [] };
  return entry.assess(permit, permit?.extraFields || {}, marketId);
}

export { REGISTRY as PERMIT_GUIDANCE_REGISTRY };
