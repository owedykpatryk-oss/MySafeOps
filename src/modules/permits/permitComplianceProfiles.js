import { loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";
import { PERMIT_TYPES } from "./permitTypes";
import { getComplianceProfile, UK_COMPLIANCE_MATRIX_VERSION } from "./ukComplianceMatrix";

const COMPLIANCE_PROFILES_KEY = "permit_compliance_profiles_v1";

function uniqueStrings(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  );
}

export function checklistIdsForType(type) {
  const checklist = PERMIT_TYPES[type]?.checklist || PERMIT_TYPES.general?.checklist || [];
  return checklist.map((_, idx) => `${type}_${idx + 1}`);
}

export function evidenceKeysForType(type) {
  const fields = PERMIT_TYPES[type]?.extraFields || PERMIT_TYPES.general?.extraFields || [];
  return fields.map((f) => String(f?.key || "").trim()).filter(Boolean);
}

export function defaultComplianceProfileForType(type) {
  const base = getComplianceProfile(type);
  return {
    matrixVersion: UK_COMPLIANCE_MATRIX_VERSION,
    legalRequiredChecklistIds: uniqueStrings(base.legalRequiredChecklistIds),
    requiredEvidenceFields: uniqueStrings(base.requiredEvidenceFields),
    legalReferences: [],
    notes: "",
  };
}

export function normalizeComplianceProfile(type, input) {
  const base = defaultComplianceProfileForType(type);
  const merged = {
    ...base,
    ...(input && typeof input === "object" ? input : {}),
  };
  return {
    matrixVersion: String(merged.matrixVersion || UK_COMPLIANCE_MATRIX_VERSION),
    legalRequiredChecklistIds: uniqueStrings(merged.legalRequiredChecklistIds),
    requiredEvidenceFields: uniqueStrings(merged.requiredEvidenceFields),
    legalReferences: uniqueStrings(merged.legalReferences),
    notes: String(merged.notes || "").trim(),
  };
}

export function loadPermitComplianceProfiles() {
  const raw = loadOrgScoped(COMPLIANCE_PROFILES_KEY, {});
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  Object.keys(raw).forEach((type) => {
    out[type] = normalizeComplianceProfile(type, raw[type]);
  });
  return out;
}

export function savePermitComplianceProfiles(profiles) {
  const src = profiles && typeof profiles === "object" ? profiles : {};
  const out = {};
  Object.keys(src).forEach((type) => {
    out[type] = normalizeComplianceProfile(type, src[type]);
  });
  saveOrgScoped(COMPLIANCE_PROFILES_KEY, out);
}

export function resolvePermitComplianceProfile(type, profileMap, embeddedProfile = null) {
  if (embeddedProfile && typeof embeddedProfile === "object") {
    return normalizeComplianceProfile(type, embeddedProfile);
  }
  return normalizeComplianceProfile(type, profileMap?.[type]);
}
