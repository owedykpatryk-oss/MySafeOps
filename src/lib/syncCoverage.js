/**
 * Authoritative map: which org data syncs to D1 vs stays device-local only.
 * Keep D1_BACKUP_PUSH_NAMESPACES aligned with D1_LIVE_SYNC_NAMESPACES.
 */
import { D1_BACKUP_PUSH_NAMESPACES } from "./d1ImportNamespaces.js";

/** Namespaces written by `useD1OrgArraySync` (live debounced PUT). */
export const D1_LIVE_SYNC_NAMESPACES = [
  "mysafeops_workers",
  "mysafeops_projects",
  "permits_v2",
  "rams_builder_docs",
  "method_statements",
  "toolbox_talks",
  "snags",
  "mysafeops_incidents",
  "incident_actions_v1",
  "training_matrix",
  "inspection_records",
  "gate_book",
  "daily_briefings",
  "visitor_log",
  "welfare_check_log",
  "ladder_inspections",
  "water_hygiene_log",
  "environmental_log",
  "waste_register",
  "mewp_log",
  "excavation_log",
  "scaffold_register",
  "electrical_pat_log",
  "plant_register",
  "safety_observations",
  "confined_space_log",
  "noise_vibration_log",
  "lifting_plan_register",
  "dsear_register",
  "asbestos_register",
  "hot_work_register",
  "temporary_works_register",
  "lone_working_log",
  "gmp_deviation_log",
  "cip_signoff_register",
  "allergen_changeover_windows",
  "high_care_access_register",
  "coshh_items",
  "ppe_register",
  "loto_register",
  "survey_reports",
  "geo_photos",
  "fire_safety_log",
  "first_aid_register",
  "cdm_packs",
  "mysafeops_timesheets",
];

/**
 * Org-scoped keys with no D1 hook — localStorage (+ optional Supabase app_sync blob) only.
 * Shown in Settings / docs so teams know backup JSON is the source of truth for these.
 */
export const LOCAL_ONLY_STORAGE_KEYS = [
  "emergency_contacts",
  "qr_induction_log",
  "digital_signatures",
  "document_templates",
  "mysafeops_recycle_bin_v1",
  "audit_log",
  "monthly_reports",
];

/** @returns {{ ok: boolean, missingFromBackup: string[] }} */
export function validateD1BackupCoverage() {
  const missingFromBackup = D1_LIVE_SYNC_NAMESPACES.filter((ns) => !D1_BACKUP_PUSH_NAMESPACES.has(ns));
  return { ok: missingFromBackup.length === 0, missingFromBackup };
}

export function isLocalOnlyStorageKey(baseKey) {
  return LOCAL_ONLY_STORAGE_KEYS.includes(baseKey);
}

export function isD1LiveSyncNamespace(namespace) {
  return D1_LIVE_SYNC_NAMESPACES.includes(namespace);
}
