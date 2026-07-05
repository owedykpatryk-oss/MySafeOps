import PermitDigGuidancePanel from "../components/PermitDigGuidancePanel";
import PermitHotWorkGuidancePanel from "./components/PermitHotWorkGuidancePanel";
import PermitWahGuidancePanel from "./components/PermitWahGuidancePanel";
import PermitConfinedSpaceGuidancePanel from "./components/PermitConfinedSpaceGuidancePanel";
import {
  isDigPermitType,
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
    assess: (permit, extra) => hotWorkAssessment(extra, permit),
    extraFieldKeys: HOT_WORK_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes 10 m zone diagram, fire watch timeline (min 60 min) and GO/NO-GO panel.",
    theme: { border: "#fca5a5", bg: "#fef2f2", color: "#991b1b" },
    matches: isHotWorkPermitType,
  },
  work_at_height: {
    Panel: PermitWahGuidancePanel,
    renderPrintHtml: renderWahPrintHtml,
    assess: (_, extra) => wahAssessment(extra),
    extraFieldKeys: WAH_EXTRA_FIELD_KEYS,
    wizardHint: "Step 2 includes WAH hierarchy (Avoid → Prevent → Mitigate), access method and exclusion zone.",
    theme: { border: "#fcd34d", bg: "#fffbeb", color: "#854F0B" },
    matches: isWahPermitType,
  },
  roof_access: {
    Panel: PermitWahGuidancePanel,
    renderPrintHtml: renderWahPrintHtml,
    assess: (_, extra) => wahAssessment(extra),
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

export function getPermitGuidance(type) {
  const key = String(type || "").trim();
  return REGISTRY[key] || null;
}

export function hasPermitGuidance(type) {
  return Boolean(getPermitGuidance(type));
}

/** Unified print section for all guidance-enabled permit types. */
export function renderGuidancePrintHtml(permit, options = {}) {
  const entry = getPermitGuidance(permit?.type);
  if (!entry?.renderPrintHtml) return "";
  return entry.renderPrintHtml(permit, options);
}

export function runGuidanceAssessment(permit) {
  const entry = getPermitGuidance(permit?.type);
  if (!entry?.assess) return { warnings: [], blockers: [] };
  return entry.assess(permit, permit?.extraFields || {});
}

export { REGISTRY as PERMIT_GUIDANCE_REGISTRY };
