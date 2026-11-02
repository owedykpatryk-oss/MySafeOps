import { D1_BACKUP_PUSH_NAMESPACES } from "../lib/d1ImportNamespaces.js";

// Explicit namespace boundaries prevent an organisation suffix from being
// mistaken for part of a namespace (e.g. records_other_acme versus records_acme).
// Add new persistent organisation registers/preferences here when introduced.
export const BACKUP_NAMESPACES = new Set([
  ...D1_BACKUP_PUSH_NAMESPACES,
  "mysafeops_org_settings", "mysafeops_org_settings_updated_at", "mysafeops_audit",
  "mysafeops_doc_library", "mysafeops_r2_uploads", "mysafeops_site_presence",
  "mysafeops_recycle_bin_v1", "mysafeops_pde_session_v2",
  "document_templates", "emergency_contacts", "emergency_site_extras",
  "induction_sites", "induction_entries", "signatures", "sig_docs", "client_portals",
  "construction_onboarding_progress", "fess_onboarding_progress", "food_pharma_onboarding_progress",
  "geospatial_onboarding_progress", "utility_mapping_onboarding_progress", "legislation_register",
  "custom_workspace_profiles", "ghp_register", "dynamic_risk_assessments", "orz_cards",
  "pl_instrukcje", "pl_czynniki_szkodliwe", "pl_forms_records", "project_wizard_draft",
  "management_overview_v1", "project_drawing_editor_prefs_v1", "project_drawing_objects_v1",
  "project_plan_overlays_v1", "rams_org_activity_templates", "rams_hazard_picker_prefs",
  "rams_hazard_quick_packs", "rams_quick_packs", "coshh_register",
  "permit_compliance_profiles_v1", "permit_incidents_v1", "permit_recent_history_v1",
  "permit_default_saved_view_id_v1", "permit_templates_v1", "permit_form_prefs",
  "permit_evidence_note_snippets_v1", "permit_conditions_snippets_v1", "permit_saved_views_v1",
  "permit_last_view_v1", "permit_wall_sound_v1", "permit_conflict_matrix_overrides_v1",
  "permit_type_overrides_v1", "permit_shift_boundary_hours_v1", "permit_theme_mode_v1",
  "permit_workflow_overrides_v1", "permit_workflow_role_overrides_v1", "permit_dependency_rule_overrides_v1",
  "permit_form_defaults_v1", "permit_form_field_overrides_v1", "permit_conditional_rules_v1",
  "permit_recent_locations_v1", "permit_context_tips_dismissed_v1", "permit_first_run_guide_v1",
  "riddor_reports", "snag_counter", "subcontractor_portals", "subcontractor_submissions",
  "rams_header_recent_values", "drone_missions", "drone_manuals", "drone_setups", "drone_library",
  "drone_editor_session", "mysafeops_survey_simple_pref",
  "client_portal_published_tokens", "mysafeops_ops_log",
]);
