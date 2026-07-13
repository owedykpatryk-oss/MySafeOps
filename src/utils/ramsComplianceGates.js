/**
 * COSHH / hazardous substances compliance gate for RAMS/SWMS approval/issue.
 */
import { loadOrgScoped as load } from "./orgStorage";
import { getOrgMarketId } from "./orgMarket";
import { getEmergencyHospitalHeading, getRamsShortLabel } from "./marketLabels";

function gateMarketId() {
  if (typeof window === "undefined") return "uk";
  return getOrgMarketId();
}

function substanceRegisterLabel(marketId) {
  if (marketId === "pl") return "rejestr substancji niebezpiecznych";
  if (marketId === "au") return "hazardous substances register";
  return "COSHH register";
}

const COSHH_KEY = "coshh_register";

const SUBSTANCE_HINTS = [
  "sealant", "silicone", "lubricant", "threadlock", "adhesive", "solvent", "primer",
  "paint", "coating", "flux", "oil", "grease", "chemical", "acid", "caustic", "resin",
  "epoxy", "foam", "fume", "coshh", "sds", "msds", "chlorination", "disinfect",
];

function textBlob(form, rows) {
  const parts = [
    form?.title,
    form?.scope,
    form?.methodStatement,
    form?.surveyMethodStatement,
    form?.notes,
    ...(rows || []).flatMap((r) => [r.activity, r.hazard, ...(r.controlMeasures || [])]),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** @returns {{ required: boolean, missing: { name: string, reason: string }[], ok: boolean, message?: string }} */
export function evaluateRamsCoshhGate(form, rows, { coshhItems = null, strict = true } = {}) {
  const marketId = gateMarketId();
  const registerLabel = substanceRegisterLabel(marketId);
  const docLabel = getRamsShortLabel(marketId);
  const items = coshhItems ?? load(COSHH_KEY, []);
  const blob = textBlob(form, rows);
  const mentionsCoshh = SUBSTANCE_HINTS.some((h) => blob.includes(h));
  if (!mentionsCoshh) {
    return { required: false, missing: [], ok: true };
  }
  if (!items.length) {
    return {
      required: true,
      missing: [{ name: `(${registerLabel} empty)`, reason: `Add substances used on this job with SDS links before approving ${docLabel}.` }],
      ok: !strict,
      message: `${registerLabel} is empty but ${docLabel} scope references chemicals/sealants/lubricants.`,
    };
  }
  const missing = items
    .filter((i) => {
      const name = String(i.name || "").trim();
      if (!name) return false;
      const inScope = blob.includes(name.toLowerCase()) || SUBSTANCE_HINTS.some((h) => blob.includes(h));
      if (!inScope) return false;
      return !String(i.sdsUrl || "").trim();
    })
    .map((i) => ({
      name: i.name,
      reason: "Missing SDS URL in hazardous substances register",
    }));
  if (missing.length === 0 && items.every((i) => !String(i.sdsUrl || "").trim())) {
    return {
      required: true,
      missing: items.slice(0, 5).map((i) => ({ name: i.name || "Unnamed substance", reason: "No SDS URL on file" })),
      ok: !strict,
      message: "Substances exist but none have SDS URLs attached.",
    };
  }
  return {
    required: true,
    missing,
    ok: missing.length === 0,
    message: missing.length ? `${missing.length} in-scope substance(s) missing SDS.` : undefined,
  };
}

/** Nearest hospital gate when project has coordinates. */
export function evaluateRamsHospitalGate(form, project) {
  const hospitalHeading = getEmergencyHospitalHeading(gateMarketId());
  const lat = Number(project?.lat ?? form?.siteLat);
  const lng = Number(project?.lng ?? form?.siteLng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const hospital = String(form?.nearestHospital || project?.nearestHospital || "").trim();
  if (!hasCoords) return { ok: true, required: false };
  return {
    required: true,
    ok: hospital.length > 2,
    message: hospital ? undefined : `Project has map coordinates but ${hospitalHeading.toLowerCase()} is not set — use Enrich site on the project.`,
  };
}
