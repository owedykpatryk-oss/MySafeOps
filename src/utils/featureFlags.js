import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";

const FLAG_KEY = "feature_flags_v1";

const defaults = {
  rams_header_smart_fields: true,
  rams_header_ai_suggest: true,
  permits_template_builder_v2: true,
  permits_board_timeline: true,
  permits_live_wall_v1: true,
  permits_site_pack_v1: true,
  permits_server_export_v1: true,
  permits_notifications_v1: true,
  rams_survey_library_v1: true,
  rams_survey_holdpoints_v1: true,
  rams_survey_print_toolbox_v1: true,
  permits_regulatory_compliance_v1: true,
  permits_field_capture_v1: true,
  permits_automation_sla_v1: true,
  permits_multichannel_notify_v1: true,
  permits_risk_analytics_v1: true,
  growth_playbook_v1: true,
  rams_hazard_deep_library_v1: true,
  sales_enablement_v1: true,
  permits_incident_traceability_v1: true,
  permits_plan_overlay_v1: true,
  smart_copilot_v1: true,
  platform_enterprise_readiness_v1: true,
};

export function getFeatureFlags() {
  const stored = load(FLAG_KEY, {});
  return { ...defaults, ...stored };
}

export function saveFeatureFlags(partial) {
  const next = { ...getFeatureFlags(), ...partial };
  save(FLAG_KEY, next);
  return next;
}

export function setFeatureFlag(flagName, value) {
  return saveFeatureFlags({ [flagName]: !!value });
}

export function isFeatureEnabled(flagName) {
  return !!getFeatureFlags()[flagName];
}

