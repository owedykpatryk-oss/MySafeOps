import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ms } from "../../utils/moduleStyles";
import PageHero from "../../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import { getTemplateForType, saveOrgTemplate } from "./permitTemplateCatalog";
import { evaluatePermitCompliance } from "./permitComplianceChecks";
import { buildPermitEvidencePack, buildEvidencePackCsv } from "./permitEvidencePack";
import {
  loadPermitComplianceProfiles,
  savePermitComplianceProfiles,
  resolvePermitComplianceProfile,
  checklistIdsForType,
  evidenceKeysForType,
} from "./permitComplianceProfiles";
import { buildPermitWarRoomStats, derivePermitStatus, permitEndIso, permitsHeatmap } from "./permitRules";
import { nextLegalReviewDate } from "./permitLegalGovernance";
import { runPermitQualityGates } from "./permitQualityGates";
import { isFeatureEnabled } from "../../utils/featureFlags";
import { trackEvent } from "../../utils/telemetry";
import PermitBuilder from "./components/PermitBuilder";
import PermitBoardView from "./components/PermitBoard";
import PermitTimelineView from "./components/PermitTimeline";
import PermitLiveWall from "./components/PermitLiveWall";
import { createDefaultChecklistItems, normalizeChecklistItems, normalizeChecklistState } from "./permitChecklistUtils";
import { findSimopsConflicts, buildSimopsConflictMap } from "./permitSimops";
import { evaluatePermitTypeConflicts, PERMIT_CONFLICT_MATRIX, normalizeConflictPair } from "./permitConflictMatrix";
import { consumeWorkspaceNavTarget, openWorkspaceView, setWorkspaceNavTarget } from "../../utils/workspaceNavContext";
import { getOrgId } from "../../utils/orgStorage";
import { mirrorPermitsToSupabase } from "../../utils/permitSupabaseMirror";
import {
  logPermitAuditToSupabase,
  logPermitDeletedToSupabase,
  fetchPermitAuditPage,
  fetchAllPermitAuditRows,
  exportPermitAuditCsvViaServer,
} from "../../utils/permitSupabaseAudit";
import { supabase } from "../../lib/supabase";
import { uploadPermitEvidencePhoto } from "../../utils/permitEvidenceUpload";
import { appendPermitAuditEntry } from "./permitAuditLog";
import PermitEvidenceImage from "./components/PermitEvidenceImage";
import { getTypeComplianceMeta } from "./ukComplianceMatrix";
import { PERMIT_TYPES, checklistStringsForType } from "./permitTypes";
import { renderPermitDocumentHtml } from "./permitDocumentHtml";
import { buildPermitEmailRecipients, parseManualEmails, sendPermitNotificationEmail, sendPermitNotificationWebPush } from "../../utils/permitNotifications";
import {
  listPermitIncidents,
  savePermitIncidents,
  createPermitIncident,
  addCorrectiveAction,
} from "./permitIncidentRegistry";
import {
  listProjectPlans,
  saveProjectPlans,
  buildPlanOverlayRecord,
  addPlanEmergencyAsset,
  addPlanEscapeRoute,
} from "./permitPlanOverlayRegistry";
import {
  PROJECT_DRAWING_OBJECT_TYPES,
  drawingObjectLabel,
  drawingObjectTypeMeta,
  listProjectDrawingObjects,
  objectsForProject,
} from "./projectDrawingRegistry";
import { buildPermitSlaQueue, buildPermitDigest } from "./permitAutomationSla";
import { buildPermitRiskInsights } from "./permitRiskIntelligence";
import {
  getDynamicFieldSpec,
  normalizeAdvancedPermit,
  evaluateDynamicRequirements,
  evaluatePermitRules,
  computePermitRiskScore,
  summarizePermitQuality,
  getRequiredSignatureRoles,
  signPermitRole,
  buildRevalidationSnapshot,
  diffRevalidationSnapshot,
  buildTemplateRollbackSnapshot,
  buildIssueSnapshot,
  diffPermitVsIssueSnapshot,
  evaluatePermitActionGate,
  buildPermitNextActorHint,
} from "./permitAdvancedEngine";
import { evaluatePermitHandoverRequirement, latestCompletedHandover, normalizeShiftHours } from "./permitHandover";
import { evaluatePermitDependencies, mergeDependencyRules, normalizeDependencyRules } from "./permitDependencyRules";
import { evaluatePermitConditionalRules, normalizePermitConditionalRules } from "./permitConditionalRules";
import { useApp } from "../../context/AppContext";
import {
  suggestPermitDescriptionText,
  queueIntegrationEvent,
  buildIntegrationAdaptersStatus,
} from "./permitIntegrationAdapters";
import { evaluateWorkerPermitEligibility } from "../../utils/certifications";
import { pushRecycleBinItem } from "../../utils/recycleBin";

const genId = () => `ptw_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const genAckToken = () => `ack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

function getOrgLocale() {
  try {
    const o = JSON.parse(localStorage.getItem("mysafeops_org_settings") || "{}");
    if (o.locale && typeof o.locale === "string") return o.locale.trim() || "en-GB";
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-GB";
}

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(getOrgLocale(), { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(getOrgLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };

function formatHoursDelta(ms) {
  const absMs = Math.abs(Number(ms || 0));
  const totalMinutes = Math.round(absMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function buildPermitSlaBadge(permit, derived) {
  const status = derived === "pending_review" ? (permit.status || "pending_review") : derived;
  const now = Date.now();
  const baseTs = new Date(permit.updatedAt || permit.createdAt || now).getTime();
  if (Number.isNaN(baseTs)) return null;
  if (status === "pending_review" || status === "ready_for_review") {
    const targetMs = 4 * 60 * 60 * 1000;
    const dueTs = baseTs + targetMs;
    const delta = dueTs - now;
    if (delta <= 0) {
      return {
        label: `Review SLA overdue ${formatHoursDelta(delta)}`,
        bg: "#FCEBEB",
        color: "#791F1F",
      };
    }
    if (delta <= 60 * 60 * 1000) {
      return {
        label: `Review SLA due in ${formatHoursDelta(delta)}`,
        bg: "#FAEEDA",
        color: "#633806",
      };
    }
    return {
      label: `Review SLA ${formatHoursDelta(delta)} left`,
      bg: "#E6F1FB",
      color: "#0C447C",
    };
  }
  if (status === "approved") {
    const targetMs = 2 * 60 * 60 * 1000;
    const dueTs = baseTs + targetMs;
    const delta = dueTs - now;
    if (delta <= 0) {
      return {
        label: `Activation overdue ${formatHoursDelta(delta)}`,
        bg: "#FCEBEB",
        color: "#791F1F",
      };
    }
    if (delta <= 30 * 60 * 1000) {
      return {
        label: `Activate in ${formatHoursDelta(delta)}`,
        bg: "#FAEEDA",
        color: "#633806",
      };
    }
    return {
      label: `Activation SLA ${formatHoursDelta(delta)} left`,
      bg: "#E6F1FB",
      color: "#0C447C",
    };
  }
  return null;
}

function collectSlaSignalsForPermit(permit, nowTs) {
  const status = String(permit?.status || "");
  const queueType =
    status === "pending_review" || status === "ready_for_review"
      ? "review"
      : status === "approved"
      ? "activation"
      : "";
  if (!queueType) return [];
  const cfg =
    queueType === "review"
      ? { targetMs: 4 * 60 * 60 * 1000, remindBeforeMin: [60, 30, 15], escalateOverdueMin: [0, 30] }
      : { targetMs: 2 * 60 * 60 * 1000, remindBeforeMin: [30, 10], escalateOverdueMin: [0, 30] };
  const baseTs = new Date(permit.updatedAt || permit.createdAt || nowTs).getTime();
  if (Number.isNaN(baseTs)) return [];
  const dueTs = baseTs + cfg.targetMs;
  const msLeft = dueTs - nowTs;
  const minsLeft = Math.floor(msLeft / 60000);
  const minsOverdue = Math.floor((nowTs - dueTs) / 60000);
  const kindLabel = queueType === "review" ? "review" : "activation";
  const signals = [];
  cfg.remindBeforeMin.forEach((threshold) => {
    if (minsLeft <= threshold && minsLeft >= threshold - 1) {
      signals.push({
        key: `reminder_${queueType}_${threshold}`,
        note: `Auto reminder: ${kindLabel} SLA due in ~${threshold} min.`,
        status: "queued",
      });
    }
  });
  cfg.escalateOverdueMin.forEach((threshold) => {
    if (minsOverdue >= threshold && minsOverdue <= threshold + 1) {
      signals.push({
        key: `escalation_${queueType}_${threshold}`,
        note:
          threshold === 0
            ? `Auto escalation: ${kindLabel} SLA overdue.`
            : `Auto escalation: ${kindLabel} SLA overdue by ${threshold}+ min.`,
        status: "escalated",
      });
    }
  });
  return signals;
}

function getPermitStatusMeta(derived) {
  if (derived === "closed") return { label: "Closed", bg: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-secondary)", icon: "●" };
  if (derived === "expired") return { label: "Expired", bg: "#FCEBEB", color: "#791F1F", icon: "!" };
  if (derived === "draft") return { label: "Draft", bg: "#FAEEDA", color: "#633806", icon: "•" };
  if (derived === "pending_review") return { label: "In review", bg: "#FAEEDA", color: "#633806", icon: "◔" };
  if (derived === "suspended") return { label: "Suspended", bg: "#FCEBEB", color: "#791F1F", icon: "⏸" };
  if (derived === "approved") return { label: "Approved", bg: "#E6F1FB", color: "#0C447C", icon: "✓" };
  return { label: "Active", bg: "#EAF3DE", color: "#27500A", icon: "▶" };
}

function permitWorkflowRail(derived) {
  const steps = ["draft", "pending_review", "approved", "active", "closed"];
  const normalized = derived === "expired" ? "active" : derived;
  const idx = steps.indexOf(normalized);
  return steps.map((step, i) => ({
    step,
    done: idx >= i,
    current: idx === i,
  }));
}

function permitStepLabel(step) {
  if (step === "pending_review") return "Review";
  return step[0].toUpperCase() + step.slice(1);
}

function quickCountBadgeStyle(tone = "neutral") {
  if (tone === "critical") return { background: "var(--permit-critical-bg)", color: "var(--permit-critical-fg)", border: "1px solid var(--permit-critical-border)" };
  if (tone === "warn") return { background: "var(--permit-warn-bg)", color: "var(--permit-warn-fg)", border: "1px solid var(--permit-warn-border)" };
  if (tone === "ok") return { background: "var(--permit-ok-bg)", color: "var(--permit-ok-fg)", border: "1px solid var(--permit-ok-border)" };
  return { background: "var(--permit-chip-neutral-bg)", color: "var(--permit-chip-neutral-fg)", border: "1px solid var(--permit-chip-neutral-border)" };
}

function permitDecisionTone(tone = "info") {
  if (tone === "critical") return { bg: "var(--permit-critical-bg)", border: "var(--permit-critical-border)", color: "var(--permit-critical-fg)" };
  if (tone === "warn") return { bg: "var(--permit-warn-bg)", border: "var(--permit-warn-border)", color: "var(--permit-warn-fg)" };
  if (tone === "ok") return { bg: "var(--permit-ok-bg)", border: "var(--permit-ok-border)", color: "var(--permit-ok-fg)" };
  return { bg: "var(--permit-info-bg)", border: "var(--permit-info-border)", color: "var(--permit-info-fg)" };
}

function resolvePermitThemeVars(themeMode = "auto", prefersDark = false) {
  const dark = themeMode === "dark" || (themeMode === "auto" && prefersDark);
  if (dark) {
    return {
      "--permit-surface-bg": "#0b1220",
      "--permit-panel-bg": "#121b2e",
      "--permit-panel-border": "#263245",
      "--permit-text": "#e5e7eb",
      "--permit-text-muted": "#aeb8c7",
      "--permit-chip-neutral-bg": "#1f2937",
      "--permit-chip-neutral-fg": "#cbd5e1",
      "--permit-chip-neutral-border": "#334155",
      "--permit-info-bg": "#172554",
      "--permit-info-fg": "#bfdbfe",
      "--permit-info-border": "#1d4ed8",
      "--permit-warn-bg": "#3f2b08",
      "--permit-warn-fg": "#fcd34d",
      "--permit-warn-border": "#92400e",
      "--permit-critical-bg": "#3b1111",
      "--permit-critical-fg": "#fecaca",
      "--permit-critical-border": "#7f1d1d",
      "--permit-ok-bg": "#052e1a",
      "--permit-ok-fg": "#86efac",
      "--permit-ok-border": "#166534",
    };
  }
  return {
    "--permit-surface-bg": "transparent",
    "--permit-panel-bg": "#ffffff",
    "--permit-panel-border": "#e5e7eb",
    "--permit-text": "var(--color-text-primary)",
    "--permit-text-muted": "var(--color-text-secondary)",
    "--permit-chip-neutral-bg": "var(--color-background-secondary,#f7f7f5)",
    "--permit-chip-neutral-fg": "var(--color-text-secondary)",
    "--permit-chip-neutral-border": "var(--color-border-tertiary,#e5e5e5)",
    "--permit-info-bg": "#eff6ff",
    "--permit-info-fg": "#1e3a8a",
    "--permit-info-border": "#bfdbfe",
    "--permit-warn-bg": "#fffbea",
    "--permit-warn-fg": "#854d0e",
    "--permit-warn-border": "#fde68a",
    "--permit-critical-bg": "#fef2f2",
    "--permit-critical-fg": "#991b1b",
    "--permit-critical-border": "#fecaca",
    "--permit-ok-bg": "#ecfdf5",
    "--permit-ok-fg": "#166534",
    "--permit-ok-border": "#bbf7d0",
  };
}

function mergePermitTypeOverrides(baseTypes, overrides) {
  const base = baseTypes && typeof baseTypes === "object" ? baseTypes : {};
  const src = overrides && typeof overrides === "object" ? overrides : {};
  const out = {};
  Object.entries(base).forEach(([type, def]) => {
    const ov = src[type] && typeof src[type] === "object" ? src[type] : {};
    out[type] = {
      ...def,
      label: String(ov.label || def.label || ""),
      color: String(ov.color || def.color || ""),
      bg: String(ov.bg || def.bg || ""),
      description: String(ov.description || def.description || ""),
    };
  });
  return out;
}

function normalizeWorkflowPolicyOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([from, targets]) => {
    const fromKey = String(from || "").trim().toLowerCase();
    if (!fromKey || !Array.isArray(targets)) return;
    const allowed = Array.from(
      new Set(
        targets
          .map((x) => String(x || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    out[fromKey] = allowed;
  });
  return out;
}

function mergeWorkflowPolicy(overrides) {
  const base = DEFAULT_PERMIT_WORKFLOW_POLICY;
  const ov = normalizeWorkflowPolicyOverrides(overrides);
  const out = {};
  Object.keys(base).forEach((state) => {
    out[state] = Array.isArray(ov[state]) ? ov[state] : base[state];
  });
  return out;
}

function permitCurrentWorkflowState(permit) {
  return String(permit?.workflow?.state || permit?.status || "draft").toLowerCase();
}

function canPermitWorkflowTransition(permit, targetState, policy) {
  const from = permitCurrentWorkflowState(permit);
  const to = String(targetState || "").trim().toLowerCase();
  const allowed = Array.isArray(policy?.[from]) ? policy[from] : [];
  return allowed.includes(to);
}

function transitionPermitWorkflowWithPolicy(permit, targetState, note = "") {
  const from = permitCurrentWorkflowState(permit);
  const to = String(targetState || "").trim().toLowerCase();
  const event = { from, to, at: new Date().toISOString(), note: String(note || "").trim() };
  return {
    ...permit,
    status: to,
    workflow: {
      state: to,
      history: [event, ...(permit?.workflow?.history || [])].slice(0, 120),
    },
  };
}

function normalizeWorkflowRolePolicyOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([targetState, roles]) => {
    const key = String(targetState || "").trim().toLowerCase();
    if (!key || !Array.isArray(roles)) return;
    const allowedRoles = Array.from(
      new Set(
        roles
          .map((r) => String(r || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    if (allowedRoles.length > 0) out[key] = allowedRoles;
  });
  return out;
}

function mergeWorkflowRolePolicy(overrides) {
  const ov = normalizeWorkflowRolePolicyOverrides(overrides);
  return { ...DEFAULT_WORKFLOW_ROLE_POLICY, ...ov };
}

function isWorkflowRoleAllowed(targetState, role, rolePolicy) {
  const target = String(targetState || "").trim().toLowerCase();
  const actorRole = String(role || "").trim().toLowerCase();
  const allowed = Array.isArray(rolePolicy?.[target]) ? rolePolicy[target] : [];
  if (allowed.length === 0) return true;
  return allowed.includes(actorRole);
}

const permitPersonLabel = (w) => `${w.name || ""}${w.role ? ` — ${w.role}` : ""}`.trim();
const PERMIT_PREFS_KEY = "permit_form_prefs";
const PERMIT_EVIDENCE_NOTE_SNIPPETS_KEY = "permit_evidence_note_snippets_v1";
const PERMIT_CONDITIONS_SNIPPETS_KEY = "permit_conditions_snippets_v1";

function certificationDisplayLabel(cert) {
  if (!cert) return "";
  return String(cert.label || cert.type || cert.name || cert.certification || cert.code || "").trim();
}

function loadSnippetList(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(rows)) return [];
    return rows.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 24);
  } catch {
    return [];
  }
}

function saveSnippetToList(key, text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const next = [clean, ...loadSnippetList(key).filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 24);
  localStorage.setItem(key, JSON.stringify(next));
}

function pickProjectLocation(project) {
  if (!project) return "";
  return String(project.location || project.site || project.address || "").trim();
}

function clonePermitForPrefill(permit, fallbackType) {
  if (!permit) return null;
  return {
    type: permit.type || fallbackType || "hot_work",
    projectId: permit.projectId || "",
    location: permit.location || "",
    locationObjectId: permit.locationObjectId || "",
    locationObjectType: permit.locationObjectType || "",
    description: permit.description || "",
    issuedTo: permit.issuedTo || "",
    issuedBy: permit.issuedBy || "",
    checklist: permit.checklist || {},
    checklistItems: Array.isArray(permit.checklistItems) ? permit.checklistItems : undefined,
    extraFields: permit.extraFields || {},
    notes: permit.notes || "",
    authorisedByRole: permit.authorisedByRole || "",
    briefingConfirmedAt: permit.briefingConfirmedAt || "",
    evidenceNotes: permit.evidenceNotes || "",
    evidencePhotoUrl: permit.evidencePhotoUrl || "",
    evidencePhotoStoragePath: permit.evidencePhotoStoragePath || "",
  };
}

function matchWorkerPick(str, workers) {
  if (!str?.trim()) return "";
  const t = str.trim();
  const m = workers.find((w) => permitPersonLabel(w) === t || (w.name || "").trim() === t);
  return m ? m.id : "__custom__";
}

const ss = {
  ...ms,
  btnO: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #c2410c", background:"#f97316", color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  btnR: { padding:"10px 14px", borderRadius:6, border:"0.5px solid #A32D2D", background:"#FCEBEB", color:"#791F1F", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif", minHeight:44, lineHeight:1.3 },
  ta:   { width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, fontSize:13, background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary)", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical", lineHeight:1.5 },
};

const AUDIT_PAGE_SIZE = 20;
const AUDIT_ACTION_OPTIONS = [
  "created",
  "updated",
  "status_changed",
  "deleted",
  "conflict_warn_override",
  "handover_submitted",
  "handover_ack_outgoing",
  "handover_ack_incoming",
];
const PERMIT_SAVED_VIEWS_KEY = "permit_saved_views_v1";
const PERMIT_CONFLICT_MATRIX_OVERRIDES_KEY = "permit_conflict_matrix_overrides_v1";
const PERMIT_TYPE_OVERRIDES_KEY = "permit_type_overrides_v1";
const PERMIT_SHIFT_BOUNDARY_HOURS_KEY = "permit_shift_boundary_hours_v1";
const PERMIT_THEME_MODE_KEY = "permit_theme_mode_v1";
const PERMIT_THEME_MODES = ["auto", "light", "dark"];
const PERMIT_WORKFLOW_OVERRIDES_KEY = "permit_workflow_overrides_v1";
const PERMIT_WORKFLOW_ROLE_OVERRIDES_KEY = "permit_workflow_role_overrides_v1";
const PERMIT_DEPENDENCY_RULE_OVERRIDES_KEY = "permit_dependency_rule_overrides_v1";
const PERMIT_FORM_DEFAULTS_KEY = "permit_form_defaults_v1";
const PERMIT_FORM_FIELD_OVERRIDES_KEY = "permit_form_field_overrides_v1";
const PERMIT_CONDITIONAL_RULES_KEY = "permit_conditional_rules_v1";
const PERMIT_RECENT_LOCATIONS_KEY = "permit_recent_locations_v1";
const DEFAULT_PERMIT_FORM_DEFAULTS = {
  defaultIssuedBy: "",
  defaultIssuedTo: "",
  defaultAuthorisingRole: "",
  defaultValidityHours: 8,
  signaturePolicy: "allow_later",
  requireBriefingBeforeIssue: false,
  requireEvidencePhotoBeforeIssue: false,
  defaultConditionsTemplate: "",
  defaultEvidenceNotesTemplate: "",
};

const PERMIT_FIELD_CATALOG = [
  { id: "description", section: "Scope", label: "Description of work", type: "textarea", defaultRequired: true, defaultPlaceholder: "Describe the specific work to be carried out under this permit…", defaultHelp: "Short, clear work scope in plain language.", defaultMaxLength: 1200 },
  { id: "location", section: "Scope", label: "Location", type: "text", defaultRequired: true, defaultPlaceholder: "Where will work be carried out?", defaultHelp: "Use exact area/zone reference for traceability.", defaultMaxLength: 240 },
  { id: "linkedRamsId", section: "Scope", label: "Linked RAMS", type: "select", defaultRequired: false, defaultPlaceholder: "", defaultHelp: "Recommended for stronger legal context.", defaultMaxLength: 0 },
  { id: "issuedTo", section: "People", label: "Permit issued to", type: "person", defaultRequired: true, defaultPlaceholder: "Name of person receiving permit", defaultHelp: "Worker responsible for permit execution.", defaultMaxLength: 120 },
  { id: "issuedBy", section: "People", label: "Issued by", type: "person", defaultRequired: true, defaultPlaceholder: "Authorised person name", defaultHelp: "Authorised issuer approving the task scope.", defaultMaxLength: 120 },
  { id: "authorisedByRole", section: "People", label: "Authorising role / competency reference", type: "text", defaultRequired: false, defaultPlaceholder: "e.g. Competent person (electrical), AP lifting", defaultHelp: "Role or competency baseline for issuer.", defaultMaxLength: 220 },
  { id: "startDateTime", section: "Timing", label: "Start date / time", type: "date", defaultRequired: true, defaultPlaceholder: "", defaultHelp: "Planned safe start window.", defaultMaxLength: 0 },
  { id: "endDateTime", section: "Timing", label: "Expiry date / time", type: "date", defaultRequired: true, defaultPlaceholder: "", defaultHelp: "Permit validity end; must be after start.", defaultMaxLength: 0 },
  { id: "briefingConfirmedAt", section: "Evidence", label: "Briefing confirmed at", type: "date", defaultRequired: false, defaultPlaceholder: "", defaultHelp: "Record briefing completion timestamp.", defaultMaxLength: 0 },
  { id: "evidencePhotoUrl", section: "Evidence", label: "Site evidence photo", type: "photo", defaultRequired: false, defaultPlaceholder: "https://…", defaultHelp: "Attach direct URL or upload image below.", defaultMaxLength: 1200 },
  { id: "evidenceNotes", section: "Evidence", label: "Evidence notes", type: "textarea", defaultRequired: false, defaultPlaceholder: "Toolbox talk reference, barrier ID, etc.", defaultHelp: "Reference IDs and evidence context.", defaultMaxLength: 1200 },
  { id: "notes", section: "Conditions", label: "Additional conditions / notes", type: "textarea", defaultRequired: false, defaultPlaceholder: "Any specific conditions, restrictions or additional requirements…", defaultHelp: "Restrictions and special controls for this permit.", defaultMaxLength: 2000 },
];

function normalizePermitFieldOverrides(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  Object.entries(raw).forEach(([typeKey, fields]) => {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return;
    const cleanedFields = {};
    Object.entries(fields).forEach(([fieldId, cfg]) => {
      if (!cfg || typeof cfg !== "object") return;
      const entry = {};
      if (cfg.required != null) entry.required = Boolean(cfg.required);
      if (cfg.placeholder != null) entry.placeholder = String(cfg.placeholder).slice(0, 220);
      if (cfg.helpText != null) entry.helpText = String(cfg.helpText).slice(0, 240);
      if (cfg.maxLength != null) {
        const n = Number(cfg.maxLength);
        if (Number.isFinite(n) && n > 0) entry.maxLength = Math.max(20, Math.min(5000, Math.round(n)));
      }
      cleanedFields[fieldId] = entry;
    });
    out[String(typeKey || "").toLowerCase()] = cleanedFields;
  });
  return out;
}

function resolvePermitFieldConfig(type, overrides) {
  const typeKey = String(type || "general").toLowerCase();
  const ov = normalizePermitFieldOverrides(overrides);
  const typeOverrides = ov[typeKey] || {};
  const sharedOverrides = ov._all || {};
  const out = {};
  PERMIT_FIELD_CATALOG.forEach((field) => {
    const patch = { ...(sharedOverrides[field.id] || {}), ...(typeOverrides[field.id] || {}) };
    out[field.id] = {
      ...field,
      required: patch.required == null ? Boolean(field.defaultRequired) : Boolean(patch.required),
      placeholder: patch.placeholder || field.defaultPlaceholder || "",
      helpText: patch.helpText || field.defaultHelp || "",
      maxLength: patch.maxLength || field.defaultMaxLength || 0,
    };
  });
  return out;
}

function normalizePermitFormDefaults(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const hoursNum = Number(src.defaultValidityHours);
  const signaturePolicy = String(src.signaturePolicy || "").toLowerCase() === "required_now" ? "required_now" : "allow_later";
  return {
    ...DEFAULT_PERMIT_FORM_DEFAULTS,
    defaultIssuedBy: String(src.defaultIssuedBy || "").slice(0, 120),
    defaultIssuedTo: String(src.defaultIssuedTo || "").slice(0, 120),
    defaultAuthorisingRole: String(src.defaultAuthorisingRole || "").slice(0, 220),
    defaultValidityHours: Number.isFinite(hoursNum) ? Math.max(1, Math.min(24, Math.round(hoursNum))) : 8,
    signaturePolicy,
    requireBriefingBeforeIssue: Boolean(src.requireBriefingBeforeIssue),
    requireEvidencePhotoBeforeIssue: Boolean(src.requireEvidencePhotoBeforeIssue),
    defaultConditionsTemplate: String(src.defaultConditionsTemplate || "").slice(0, 1000),
    defaultEvidenceNotesTemplate: String(src.defaultEvidenceNotesTemplate || "").slice(0, 1000),
  };
}

function normalizeRecentPermitLocations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const location = String(row.location || "").trim().slice(0, 240);
      if (!location) return null;
      return {
        projectId: String(row.projectId || ""),
        location,
        locationObjectId: String(row.locationObjectId || ""),
        locationObjectType: String(row.locationObjectType || ""),
        at: String(row.at || new Date().toISOString()),
      };
    })
    .filter(Boolean)
    .slice(0, 60);
}

function recentLocationOptionLabel(row) {
  if (!row) return "";
  const typeLabel = drawingObjectTypeMeta(row.locationObjectType)?.label;
  const suffix = typeLabel ? ` (${typeLabel})` : "";
  return `${row.location}${suffix}`;
}
const DEFAULT_PERMIT_WORKFLOW_POLICY = {
  draft: ["ready_for_review", "issued", "closed"],
  ready_for_review: ["approved", "draft", "closed"],
  approved: ["issued", "suspended", "closed"],
  issued: ["suspended", "closed"],
  suspended: ["issued", "closed"],
  closed: ["issued"],
};
const DEFAULT_WORKFLOW_ROLE_POLICY = {
  approved: ["admin", "supervisor"],
  issued: ["admin", "supervisor"],
  suspended: ["admin", "supervisor"],
  closed: ["admin", "supervisor"],
  draft: ["admin", "supervisor"],
};
const WORKFLOW_STATES = Object.keys(DEFAULT_PERMIT_WORKFLOW_POLICY);
const WORKFLOW_ROLES = ["admin", "supervisor", "operative"];
const PLAN_UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const PLAN_UPLOAD_MIME = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const PLAN_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

function auditActionLabel(row) {
  if (!row) return "Updated";
  if (row.action === "created") return "Created permit";
  if (row.action === "deleted") return "Deleted permit";
  if (row.action === "conflict_warn_override") return "Recorded permit conflict override";
  if (row.action === "handover_submitted") return "Recorded shift handover";
  if (row.action === "handover_ack_outgoing") return "Outgoing supervisor acknowledged handover";
  if (row.action === "handover_ack_incoming") return "Incoming supervisor acknowledged handover";
  if (row.action === "status_changed") return `Status: ${row.from_status || "—"} -> ${row.to_status || "—"}`;
  return "Updated permit";
}

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgoValue(days) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(0, Number(days || 0)));
  return d.toISOString().slice(0, 10);
}

const PERMIT_VERSION_DIFF_FIELDS = [
  "status",
  "type",
  "projectId",
  "location",
  "description",
  "issuedTo",
  "issuedBy",
  "startDateTime",
  "endDateTime",
  "notes",
  "linkedRamsId",
];

function createPermitVersionEntry(previousPermit, nextPermit, actor, reason = "") {
  if (!previousPermit || typeof previousPermit !== "object") return null;
  const diffKeys = PERMIT_VERSION_DIFF_FIELDS.filter(
    (key) => JSON.stringify(previousPermit?.[key] ?? null) !== JSON.stringify(nextPermit?.[key] ?? null)
  );
  return {
    id: `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    by: String(actor || "unknown").slice(0, 120),
    reason: String(reason || "").slice(0, 220),
    diffKeys,
    snapshot: previousPermit,
  };
}

function hasMaterialPermitChanges(previousPermit, nextPermit) {
  if (!previousPermit || !nextPermit) return false;
  return PERMIT_VERSION_DIFF_FIELDS.some(
    (key) => JSON.stringify(previousPermit?.[key] ?? null) !== JSON.stringify(nextPermit?.[key] ?? null)
  );
}


// ─── Live countdown timer component ──────────────────────────────────────────
function Countdown({ expiresAt }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - new Date();
      setRemaining(diff);
    };
    calc();
    const t = setInterval(calc, 10000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (remaining === null) return null;

  if (remaining <= 0) return (
    <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:"#FCEBEB", color:"#791F1F" }}>
      EXPIRED
    </span>
  );

  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const urgent = remaining < 1800000; // 30 min
  const warning = remaining < 7200000; // 2 hours
  const approx = remaining < 120000;

  return (
    <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500,
      background: urgent ? "#FCEBEB" : warning ? "#FAEEDA" : "#EAF3DE",
      color: urgent ? "#791F1F" : warning ? "#633806" : "#27500A",
    }}>
      {approx ? "~" : ""}{hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} remaining
    </span>
  );
}

// ─── Permit form ─────────────────────────────────────────────────────────────
function PermitForm({
  permit,
  onSave,
  onClose,
  recentPermit,
  allPermits = [],
  conflictMatrix = PERMIT_CONFLICT_MATRIX,
  permitTypes = PERMIT_TYPES,
  handoverShiftHours = [6, 18],
  dependencyRules = {},
  orgPermitDefaults = DEFAULT_PERMIT_FORM_DEFAULTS,
  permitFieldOverrides = {},
  conditionalRules = [],
}) {
  const projects = load("mysafeops_projects",[]);
  const workers = load("mysafeops_workers",[]);
  const ramsDocs = load("rams_builder_docs", []);
  const permitPrefs = load(PERMIT_PREFS_KEY, {});
  const org = (() => { try { return JSON.parse(localStorage.getItem("mysafeops_org_settings")||"{}"); } catch { return {}; } })();
  const formDefaults = normalizePermitFormDefaults(orgPermitDefaults);
  const flags = isFeatureEnabled("permits_template_builder_v2");

  const defaultType = permit?.type || "hot_work";
  const [type, setType] = useState(defaultType);
  const def = permitTypes[type] || permitTypes.general;
  const fieldConfig = useMemo(
    () => resolvePermitFieldConfig(type, permitFieldOverrides),
    [type, permitFieldOverrides]
  );
  const getFieldConfig = useCallback(
    (fieldId) => fieldConfig[fieldId] || resolvePermitFieldConfig(type, {})[fieldId] || { required: false, placeholder: "", helpText: "", maxLength: 0, label: fieldId },
    [fieldConfig, type]
  );
  const isFieldRequired = useCallback((fieldId) => Boolean(getFieldConfig(fieldId)?.required), [getFieldConfig]);
  const fieldLabel = useCallback(
    (fieldId, fallback) => `${getFieldConfig(fieldId)?.label || fallback}${isFieldRequired(fieldId) ? " *" : ""}`,
    [getFieldConfig, isFieldRequired]
  );
  const typeMeta = getTypeComplianceMeta(type);
  const initChecklist = (items) => Object.fromEntries((items || []).map((item) => [item.id, false]));
  const template = getTemplateForType(defaultType, permitTypes);
  const initialChecklistItems = permit
    ? normalizeChecklistItems(defaultType, permit, checklistStringsForType(defaultType))
    : normalizeChecklistItems(defaultType, { checklistItems: template.checklistItems }, checklistStringsForType(defaultType));

  const blank = {
    id:genId(), type, projectId:"", location:"",
    locationObjectId: "",
    locationObjectType: "",
    description:"", issuedTo: formDefaults.defaultIssuedTo || "", issuedBy: formDefaults.defaultIssuedBy || org.defaultLeadEngineer || permitPrefs.issuedBy || "",
    linkedRamsId: "",
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now() + formDefaults.defaultValidityHours * 3600000).toISOString(),
    checklistItems: initialChecklistItems,
    checklist: initChecklist(initialChecklistItems),
    extraFields:{ dynamic:{} }, status:"draft",
    templateVersion: 1,
    matrixVersion: "uk-v2",
    templateId: template.templateId || `permit.${defaultType}.default`,
    legalContentOwner: "HSE / Legal Reviewer",
    createdAt: new Date().toISOString(),
    notes: formDefaults.defaultConditionsTemplate || "",
    authorisedByRole: formDefaults.defaultAuthorisingRole || "",
    briefingConfirmedAt: "",
    evidenceNotes: formDefaults.defaultEvidenceNotesTemplate || "",
    evidencePhotoUrl: "",
    evidencePhotoStoragePath: "",
    workflow: { state: "draft", history: [] },
    signatures: [],
    templateHistory: [],
    revalidationLog: [],
    integrationQueue: [],
    tags: [],
    conflictWarnOverride: null,
  };

  const [form, setForm] = useState(() => {
    if (!permit) return blank;
    const permitType = permit.type || type;
    const checklistItems = normalizeChecklistItems(permitType, permit, checklistStringsForType(permitType));
    return normalizeAdvancedPermit({
      ...permit,
      type: permitType,
      checklistItems,
      checklist: normalizeChecklistState(permit.checklist, checklistItems),
      locationObjectId: permit.locationObjectId || "",
      locationObjectType: permit.locationObjectType || "",
      templateVersion: permit.templateVersion || 1,
      matrixVersion: permit.matrixVersion || "uk-v2",
      templateId: permit.templateId || `permit.${permitType}.default`,
      legalContentOwner: permit.legalContentOwner || "HSE / Legal Reviewer",
      authorisedByRole: permit.authorisedByRole || "",
      briefingConfirmedAt: permit.briefingConfirmedAt || "",
      evidenceNotes: permit.evidenceNotes || "",
      evidencePhotoUrl: permit.evidencePhotoUrl || "",
      evidencePhotoStoragePath: permit.evidencePhotoStoragePath || "",
    }, permitType);
  });
  const [evidenceUploadBusy, setEvidenceUploadBusy] = useState(false);
  const [prefillNote, setPrefillNote] = useState("");
  const [templateEditMode, setTemplateEditMode] = useState(false);
  const [complianceProfiles, setComplianceProfiles] = useState(() => loadPermitComplianceProfiles());
  const [complianceEditMode, setComplianceEditMode] = useState(false);
  const [issuedToPick, setIssuedToPick] = useState(() => (permit ? matchWorkerPick(permit.issuedTo, workers) : ""));
  const [issuedByPick, setIssuedByPick] = useState(() => {
    if (permit) return matchWorkerPick(permit.issuedBy, workers);
    return matchWorkerPick(org.defaultLeadEngineer || "", workers);
  });
  const [allowSignLater, setAllowSignLater] = useState(() => {
    if (permit && permit.allowSignLater != null) return Boolean(permit.allowSignLater);
    return formDefaults.signaturePolicy !== "required_now";
  });
  const projectDrawingObjects = useMemo(
    () => objectsForProject(form.projectId, listProjectDrawingObjects()),
    [form.projectId]
  );
  const [locationObjectTypeFilter, setLocationObjectTypeFilter] = useState("all");
  const [recentLocations, setRecentLocations] = useState(() =>
    normalizeRecentPermitLocations(load(PERMIT_RECENT_LOCATIONS_KEY, []))
  );
  const filteredProjectDrawingObjects = useMemo(
    () =>
      projectDrawingObjects.filter((row) =>
        locationObjectTypeFilter === "all" ? true : row.type === locationObjectTypeFilter
      ),
    [projectDrawingObjects, locationObjectTypeFilter]
  );
  const selectedLocationObject = useMemo(
    () => projectDrawingObjects.find((row) => row.id === form.locationObjectId) || null,
    [projectDrawingObjects, form.locationObjectId]
  );
  const drawingObjectsForPicker = useMemo(() => {
    if (!selectedLocationObject) return filteredProjectDrawingObjects;
    if (filteredProjectDrawingObjects.some((row) => row.id === selectedLocationObject.id)) {
      return filteredProjectDrawingObjects;
    }
    return [selectedLocationObject, ...filteredProjectDrawingObjects];
  }, [filteredProjectDrawingObjects, selectedLocationObject]);
  const recentProjectLocations = useMemo(
    () =>
      recentLocations.filter((row) =>
        form.projectId ? row.projectId === form.projectId : row.projectId === ""
      ),
    [recentLocations, form.projectId]
  );
  const [signatureDialog, setSignatureDialog] = useState(null);
  const signatureCanvasRef = useRef(null);
  const signatureDrawingRef = useRef(false);
  const signaturePointerRef = useRef(null);
  const [evidenceNoteSnippets, setEvidenceNoteSnippets] = useState(() => loadSnippetList(PERMIT_EVIDENCE_NOTE_SNIPPETS_KEY));
  const [conditionSnippets, setConditionSnippets] = useState(() => loadSnippetList(PERMIT_CONDITIONS_SNIPPETS_KEY));
  const [wizardStep, setWizardStep] = useState(1);
  const baselineRef = useRef(null);
  const formSnapshotStr = useCallback(
    () =>
      JSON.stringify({
        type,
        form,
        issuedToPick,
        issuedByPick,
        allowSignLater,
        wizardStep,
      }),
    [type, form, issuedToPick, issuedByPick, allowSignLater, wizardStep]
  );
  useEffect(() => {
    baselineRef.current = formSnapshotStr();
  }, []);
  const dirty = baselineRef.current != null && formSnapshotStr() !== baselineRef.current;
  useEffect(() => {
    if (!dirty) return undefined;
    const fn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  useEffect(() => {
    savePermitComplianceProfiles(complianceProfiles);
  }, [complianceProfiles]);
  useEffect(() => {
    setLocationObjectTypeFilter("all");
  }, [form.projectId]);
  const tryClose = () => {
    if (dirty && !window.confirm("Discard unsaved permit changes?")) return;
    onClose();
  };
  const set = (k,v) => setForm((f)=>normalizeAdvancedPermit({ ...f, [k]: v }, type));
  const setExtra = (k,v) => setForm(f=>({...f,extraFields:{...f.extraFields,[k]:v}}));
  const setCheck = (id,v) => setForm(f=>({...f,checklist:{...f.checklist,[id]:v}}));
  const setDynamic = (k, v) =>
    setForm((f) =>
      normalizeAdvancedPermit(
        {
          ...f,
          extraFields: { ...(f.extraFields || {}), dynamic: { ...(f.extraFields?.dynamic || {}), [k]: v } },
        },
        type
      )
    );
  const applyQualityAutofix = (rec) => {
    const fix = rec?.autofix;
    if (!fix || typeof fix !== "object") return;
    if (fix.type === "append_notes") {
      const next = [String(form.notes || "").trim(), String(fix.text || "").trim()].filter(Boolean).join("\n");
      set("notes", next);
      return;
    }
    if (fix.type === "append_evidence") {
      const next = [String(form.evidenceNotes || "").trim(), String(fix.text || "").trim()].filter(Boolean).join("\n");
      set("evidenceNotes", next);
      return;
    }
    if (fix.type === "set_dynamic" && fix.key) {
      setDynamic(String(fix.key), fix.value == null ? "" : fix.value);
    }
  };

  useEffect(() => {
    setForm((f) => normalizeAdvancedPermit(f, type));
  }, [type]);

  const assignMeLabel = String(org.defaultLeadEngineer || permitPrefs.issuedBy || "").trim();
  const findWorkerById = useCallback((id) => workers.find((w) => w.id === id) || null, [workers]);
  const clearSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    signatureDrawingRef.current = false;
  }, []);
  const resizeSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ratio = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const cssWidth = canvas.clientWidth || 420;
    const cssHeight = canvas.clientHeight || 140;
    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    clearSignatureCanvas();
  }, [clearSignatureCanvas]);
  useEffect(() => {
    if (!signatureDialog) return;
    resizeSignatureCanvas();
    const existing = String(signatureDialog.signatureImageDataUrl || "");
    if (!existing) return;
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.clientWidth || 420, canvas.clientHeight || 140);
      signatureDrawingRef.current = true;
    };
    img.src = existing;
  }, [signatureDialog, resizeSignatureCanvas]);
  const canvasPoint = (event) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };
  const handleSignaturePointerDown = (event) => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const pt = canvasPoint(event);
    if (!ctx || !pt) return;
    event.preventDefault();
    signaturePointerRef.current = pt;
    signatureDrawingRef.current = true;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };
  const handleSignaturePointerMove = (event) => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !signaturePointerRef.current) return;
    const pt = canvasPoint(event);
    if (!pt) return;
    event.preventDefault();
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    signaturePointerRef.current = pt;
  };
  const handleSignaturePointerUp = (event) => {
    if (signaturePointerRef.current) event.preventDefault();
    signaturePointerRef.current = null;
  };
  const commitSignatureDialog = () => {
    if (!signatureDialog) return;
    const signerWorker = findWorkerById(signatureDialog.signedByWorkerId);
    if (!signerWorker) {
      window.alert("Select a worker for signature.");
      return;
    }
    const allowed = Array.isArray(signatureDialog.allowedWorkerIds) ? signatureDialog.allowedWorkerIds : [];
    if (allowed.length > 0 && !allowed.includes(signerWorker.id)) {
      window.alert("This role can only be signed by assigned worker.");
      return;
    }
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const hasDrawing = signatureDrawingRef.current;
    if (!hasDrawing) {
      window.alert("Draw signature on the pad before saving.");
      return;
    }
    const signatureImageDataUrl = canvas.toDataURL("image/png");
    setForm((f) =>
      normalizeAdvancedPermit(
        signPermitRole(
          f,
          signatureDialog.role,
          permitPersonLabel(signerWorker) || signerWorker.name,
          signatureDialog.note || "",
          signatureImageDataUrl,
          signerWorker.id
        ),
        type
      )
    );
    setSignatureDialog(null);
  };
  const signRole = (role, preferredWorkerId = "") => {
    const roleKey = String(role || "").toLowerCase();
    const allowedWorkers =
      roleKey === "issuer"
        ? selectedIssuerWorker
          ? [selectedIssuerWorker]
          : []
        : roleKey === "receiver"
          ? selectedIssuedWorker
            ? [selectedIssuedWorker]
            : []
          : workers;
    if (!allowedWorkers.length) {
      if (roleKey === "issuer" || roleKey === "receiver") {
        window.alert("For issuer/receiver signature choose an assigned worker (not custom text).");
      } else {
        window.alert("No workers available for signature.");
      }
      return;
    }
    const existing = (form.signatures || []).find((s) => s.role === role) || {};
    const fallbackWorkerId = existing.signedByWorkerId || preferredWorkerId || allowedWorkers[0]?.id || "";
    setSignatureDialog({
      role,
      note: String(existing.note || ""),
      signedByWorkerId: fallbackWorkerId,
      allowedWorkerIds: allowedWorkers.map((w) => w.id),
      signatureImageDataUrl: String(existing.signatureImageDataUrl || ""),
    });
  };

  const sha256HexForDataUrl = async (dataUrl) => {
    const parts = String(dataUrl || "").split(",");
    if (parts.length < 2) return "";
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    if (typeof crypto?.subtle?.digest === "function") {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return "";
  };

  const exportSignaturePackJson = async () => {
    const signedRows = (form.signatures || []).filter((s) => s.signedAt && s.signatureImageDataUrl);
    if (!signedRows.length) {
      window.alert("No signed signature images to export.");
      return;
    }
    const signatures = await Promise.all(
      signedRows.map(async (row, idx) => ({
        role: row.role,
        signedBy: row.signedBy || "",
        signedByWorkerId: row.signedByWorkerId || "",
        signedAt: row.signedAt || "",
        note: row.note || "",
        sha256: await sha256HexForDataUrl(row.signatureImageDataUrl),
        fileName: `${String(form.id || "permit")}_${row.role || "signature"}_${idx + 1}.png`,
      }))
    );
    const payload = {
      generatedAt: new Date().toISOString(),
      permit: {
        id: form.id || "",
        type,
        status: form.status || "draft",
      },
      signatures,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${String(form.id || "permit").slice(-12)}_signature_pack.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportSignaturePngs = () => {
    const signedRows = (form.signatures || []).filter((s) => s.signedAt && s.signatureImageDataUrl);
    if (!signedRows.length) {
      window.alert("No signed signature images to export.");
      return;
    }
    signedRows.forEach((row, idx) => {
      const a = document.createElement("a");
      a.href = row.signatureImageDataUrl;
      a.download = `${String(form.id || "permit").slice(-12)}_${row.role || "signature"}_${idx + 1}.png`;
      a.click();
    });
  };

  const rememberEvidenceNote = () => {
    saveSnippetToList(PERMIT_EVIDENCE_NOTE_SNIPPETS_KEY, form.evidenceNotes);
    setEvidenceNoteSnippets(loadSnippetList(PERMIT_EVIDENCE_NOTE_SNIPPETS_KEY));
  };
  const rememberConditionNote = () => {
    saveSnippetToList(PERMIT_CONDITIONS_SNIPPETS_KEY, form.notes);
    setConditionSnippets(loadSnippetList(PERMIT_CONDITIONS_SNIPPETS_KEY));
  };

  const rollbackTemplateVersion = () => {
    const history = Array.isArray(form.templateHistory) ? form.templateHistory : [];
    if (history.length === 0) return;
    const latest = history[0];
    setForm((f) =>
      normalizeAdvancedPermit(
        {
          ...f,
          checklistItems: latest.checklistItems || f.checklistItems,
          checklist: normalizeChecklistState(f.checklist, latest.checklistItems || f.checklistItems),
          templateVersion: latest.templateVersion || f.templateVersion,
          templateHistory: history.slice(1),
        },
        type
      )
    );
  };

  const addFieldCaptureEntry = async () => {
    const kind = window.prompt(
      "Field capture type (scan_proof, gas_test, expose_verification, sample_reading, chain_of_custody):",
      "scan_proof"
    );
    if (kind == null) return;
    const note = window.prompt("Field capture note:", "") || "";
    const entry = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: String(kind || "entry").slice(0, 40),
      note: String(note).slice(0, 400),
      at: new Date().toISOString(),
      geo: null,
    };
    if (navigator.geolocation) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            entry.geo = {
              lat: Number(pos.coords.latitude.toFixed(6)),
              lng: Number(pos.coords.longitude.toFixed(6)),
            };
            resolve();
          },
          () => resolve(),
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 }
        );
      });
    }
    setForm((f) => {
      const prev = Array.isArray(f.extraFields?.fieldCaptureEntries) ? f.extraFields.fieldCaptureEntries : [];
      return {
        ...f,
        extraFields: {
          ...(f.extraFields || {}),
          fieldCaptureEntries: [entry, ...prev].slice(0, 40),
        },
      };
    });
  };

  const updateChecklistItemText = (id, text) => {
    setForm((f) => ({
      ...f,
      checklistItems: (f.checklistItems || []).map((item) =>
        item.id === id ? { ...item, text } : item
      ),
    }));
  };

  const removeChecklistItem = (id) => {
    setForm((f) => {
      const nextItems = (f.checklistItems || []).filter((item) => item.id !== id);
      const nextChecks = { ...(f.checklist || {}) };
      delete nextChecks[id];
      return { ...f, checklistItems: nextItems, checklist: nextChecks };
    });
  };

  const addChecklistItem = () => {
    const customId = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    setForm((f) => ({
      ...f,
      checklistItems: [...(f.checklistItems || []), { id: customId, text: "", required: false }],
      checklist: { ...(f.checklist || {}), [customId]: false },
    }));
  };

  const moveChecklistItem = (id, dir) => {
    setForm((f) => {
      const list = [...(f.checklistItems || [])];
      const idx = list.findIndex((x) => x.id === id);
      if (idx < 0) return f;
      const nextIdx = dir === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= list.length) return f;
      const tmp = list[idx];
      list[idx] = list[nextIdx];
      list[nextIdx] = tmp;
      return { ...f, checklistItems: list };
    });
  };

  const importChecklistFromText = () => {
    const txt = window.prompt("Paste checklist lines (one item per line):", "") || "";
    const rows = txt.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 40);
    if (rows.length === 0) return;
    setForm((f) => {
      const current = Array.isArray(f.checklistItems) ? f.checklistItems : [];
      const merged = [
        ...current,
        ...rows.map((line) => ({ id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, text: line, required: false })),
      ];
      const nextChecks = { ...(f.checklist || {}) };
      merged.forEach((item) => {
        if (!(item.id in nextChecks)) nextChecks[item.id] = false;
      });
      return { ...f, checklistItems: merged, checklist: nextChecks };
    });
  };

  const rollbackToVersion = (entry) => {
    const snap = entry?.snapshot;
    if (!snap || typeof snap !== "object") return;
    if (!window.confirm("Rollback form to selected snapshot? Current unsaved edits will be replaced.")) return;
    const snapType = snap.type || type;
    const nextItems = normalizeChecklistItems(snapType, snap, checklistStringsForType(snapType));
    setType(snapType);
    setForm((f) =>
      normalizeAdvancedPermit(
        {
          ...f,
          ...snap,
          type: snapType,
          checklistItems: nextItems,
          checklist: normalizeChecklistState(snap.checklist, nextItems),
        },
        snapType
      )
    );
    setIssuedToPick(matchWorkerPick(snap.issuedTo || "", workers));
    setIssuedByPick(matchWorkerPick(snap.issuedBy || "", workers));
    setPrefillNote(`Rolled back to snapshot ${fmtDateTime(entry?.at)}`);
  };

  const saveCurrentAsOrgTemplate = () => {
    const nextTemplate = saveOrgTemplate(type, {
      checklistItems: trimmedChecklistItems,
    }, permitTypes);
    const snapshot = buildTemplateRollbackSnapshot(form);
    setForm((f) => ({
      ...f,
      templateId: nextTemplate.templateId,
      templateVersion: nextTemplate.templateVersion,
      matrixVersion: nextTemplate.matrixVersion || "uk-v1",
      templateHistory: [snapshot, ...(f.templateHistory || [])].slice(0, 20),
    }));
    setPrefillNote(`Saved org template v${nextTemplate.templateVersion}`);
    trackEvent("permit_template_saved", { type, templateVersion: nextTemplate.templateVersion });
  };

  const applyPrefill = (next, sourceLabel) => {
    if (!next) return;
    const nextType = next.type || type;
    setType(nextType);
    const nextItems = normalizeChecklistItems(nextType, next, checklistStringsForType(nextType));
    setForm((f) => ({
      ...normalizeAdvancedPermit(f, nextType),
      ...normalizeAdvancedPermit(next, nextType),
      type: nextType,
      checklistItems: nextItems,
      checklist: normalizeChecklistState(next.checklist, nextItems),
      extraFields: {
        ...(f.extraFields || {}),
        ...(next.extraFields || {}),
        dynamic: { ...(f.extraFields?.dynamic || {}), ...(next.extraFields?.dynamic || {}) },
      },
      templateVersion: next.templateVersion || f.templateVersion || 1,
      matrixVersion: next.matrixVersion || f.matrixVersion || "uk-v1",
    }));
    setIssuedToPick(matchWorkerPick(next.issuedTo || "", workers));
    setIssuedByPick(matchWorkerPick(next.issuedBy || "", workers));
    setPrefillNote(sourceLabel);
  };

  const saveFormPrefs = (draft) => {
    save(PERMIT_PREFS_KEY, {
      issuedBy: String(draft.issuedBy || "").trim(),
      projectId: String(draft.projectId || "").trim(),
      location: String(draft.location || "").trim(),
    });
    const nextRecent = normalizeRecentPermitLocations([
      {
        projectId: String(draft.projectId || "").trim(),
        location: String(draft.location || "").trim(),
        locationObjectId: String(draft.locationObjectId || "").trim(),
        locationObjectType: String(draft.locationObjectType || "").trim(),
        at: new Date().toISOString(),
      },
      ...recentLocations.filter((row) => {
        return !(
          row.projectId === String(draft.projectId || "").trim() &&
          row.location.toLowerCase() === String(draft.location || "").trim().toLowerCase()
        );
      }),
    ]);
    setRecentLocations(nextRecent);
    save(PERMIT_RECENT_LOCATIONS_KEY, nextRecent);
  };

  const prefillFromRecent = () => {
    const source = clonePermitForPrefill(recentPermit, type);
    if (!source) return;
    applyPrefill(source, "Prefilled from latest permit");
  };

  const onIssuedToSelect = (e) => {
    const v = e.target.value;
    if (v === "") { setIssuedToPick(""); set("issuedTo", ""); return; }
    if (v === "__me__") {
      const me = String(assignMeLabel || "").trim();
      if (me) {
        setIssuedToPick("__custom__");
        set("issuedTo", me);
      }
      return;
    }
    if (v === "__custom__") { setIssuedToPick("__custom__"); return; }
    const w = workers.find((x) => x.id === v);
    if (w) { setIssuedToPick(v); set("issuedTo", permitPersonLabel(w) || w.name); }
  };
  const onIssuedBySelect = (e) => {
    const v = e.target.value;
    if (v === "") { setIssuedByPick(""); set("issuedBy", ""); return; }
    if (v === "__me__") {
      const me = String(assignMeLabel || "").trim();
      if (me) {
        setIssuedByPick("__custom__");
        set("issuedBy", me);
      }
      return;
    }
    if (v === "__custom__") { setIssuedByPick("__custom__"); return; }
    const w = workers.find((x) => x.id === v);
    if (w) { setIssuedByPick(v); set("issuedBy", permitPersonLabel(w) || w.name); }
  };
  const selectedIssuedWorker = useMemo(() => workers.find((w) => w.id === issuedToPick) || null, [workers, issuedToPick]);
  const selectedIssuerWorker = useMemo(() => workers.find((w) => w.id === issuedByPick) || null, [workers, issuedByPick]);
  const issuedWorkerEligibility = useMemo(
    () => (selectedIssuedWorker ? evaluateWorkerPermitEligibility(selectedIssuedWorker, type) : null),
    [selectedIssuedWorker, type]
  );
  const selectedIssuedWorkerCerts = useMemo(
    () => (selectedIssuedWorker?.certifications || []).map(certificationDisplayLabel).filter(Boolean),
    [selectedIssuedWorker]
  );
  const selectedIssuerCerts = useMemo(
    () => (selectedIssuerWorker?.certifications || []).map(certificationDisplayLabel).filter(Boolean),
    [selectedIssuerWorker]
  );
  const competencySuggestions = useMemo(() => {
    const fromWorkers = workers.flatMap((w) => (w?.certifications || []).map(certificationDisplayLabel)).filter(Boolean);
    const merged = [...selectedIssuerCerts, ...fromWorkers];
    return Array.from(new Set(merged.map((x) => x.trim()).filter(Boolean))).slice(0, 50);
  }, [workers, selectedIssuerCerts]);
  const conditionalEval = useMemo(
    () =>
      evaluatePermitConditionalRules(
        { permitType: type, status: form.status || "draft", projectId: form.projectId || "" },
        conditionalRules
      ),
    [type, form.status, form.projectId, conditionalRules]
  );
  const isFieldRequiredEffective = useCallback(
    (fieldId) => {
      if (conditionalEval.required[fieldId] != null) return Boolean(conditionalEval.required[fieldId]);
      return isFieldRequired(fieldId);
    },
    [conditionalEval.required, isFieldRequired]
  );
  const isFieldVisible = useCallback(
    (fieldId) => conditionalEval.visible[fieldId] !== false,
    [conditionalEval.visible]
  );
  const fieldLabelResolved = useCallback(
    (fieldId, fallback) => `${getFieldConfig(fieldId)?.label || fallback}${isFieldRequiredEffective(fieldId) ? " *" : ""}`,
    [getFieldConfig, isFieldRequiredEffective]
  );

  const handleTypeChange = (newType) => {
    setType(newType);
    const nextTemplate = getTemplateForType(newType, permitTypes);
    const items = normalizeChecklistItems(newType, { checklistItems: nextTemplate.checklistItems }, checklistStringsForType(newType));
    setForm((f) =>
      normalizeAdvancedPermit(
        {
          ...f,
          type:newType,
          checklistItems:items,
          checklist:initChecklist(items),
          signatures: [],
        },
        newType
      )
    );
    setPrefillNote("");
    trackEvent("permit_template_selected", { permitType: newType });
  };

  const checklistItems = form.checklistItems || createDefaultChecklistItems(type, checklistStringsForType(type));
  const checkCount = checklistItems.filter((item) => !!form.checklist?.[item.id]).length;
  const totalChecks = checklistItems.length;
  const allChecked = checkCount === totalChecks;
  const trimmedChecklistItems = checklistItems
    .map((item) => ({ ...item, text: String(item.text || "").trim() }))
    .filter((item) => item.text);
  const quality = runPermitQualityGates(form, {
    required: {
      description: isFieldRequiredEffective("description"),
      location: isFieldRequiredEffective("location"),
      issuedBy: isFieldRequiredEffective("issuedBy"),
      issuedTo: isFieldRequiredEffective("issuedTo"),
      timeRange: isFieldRequiredEffective("startDateTime") || isFieldRequiredEffective("endDateTime"),
    },
  });
  const applyAllQualityAutofixes = useCallback(() => {
    const list = (quality.recommendations || []).filter((r) => r?.autofix && typeof r.autofix === "object");
    if (list.length === 0) return;
    setForm((f0) => {
      let f = f0;
      for (const rec of list) {
        const fix = rec.autofix;
        if (fix.type === "append_notes") {
          f = { ...f, notes: [String(f.notes || "").trim(), String(fix.text || "").trim()].filter(Boolean).join("\n") };
        } else if (fix.type === "append_evidence") {
          f = { ...f, evidenceNotes: [String(f.evidenceNotes || "").trim(), String(fix.text || "").trim()].filter(Boolean).join("\n") };
        } else if (fix.type === "set_dynamic" && fix.key) {
          f = normalizeAdvancedPermit(
            {
              ...f,
              extraFields: {
                ...(f.extraFields || {}),
                dynamic: { ...(f.extraFields?.dynamic || {}), [String(fix.key)]: fix.value == null ? "" : fix.value },
              },
            },
            type
          );
        }
      }
      return normalizeAdvancedPermit(f, type);
    });
  }, [quality.recommendations, type]);
  const complianceProfile = useMemo(
    () => resolvePermitComplianceProfile(type, complianceProfiles, form.complianceProfile || null),
    [type, complianceProfiles, form.complianceProfile]
  );
  const compliance = evaluatePermitCompliance(
    { ...form, type, endDateTime: form.endDateTime },
    trimmedChecklistItems,
    { profileOverride: complianceProfile }
  );
  const legalReady = compliance.legalReady;
  const dynamicSpec = getDynamicFieldSpec(type);
  const dynamicReq = evaluateDynamicRequirements(form, type);
  const advancedRules = evaluatePermitRules({ ...form, checklistItems: trimmedChecklistItems }, type);
  const workerEligibilityBlockers = issuedWorkerEligibility
    ? [...issuedWorkerEligibility.missing, ...issuedWorkerEligibility.expired.map((x) => x.label)]
    : [];
  const policyBlockers = [];
  if (formDefaults.requireBriefingBeforeIssue && !form.briefingConfirmedAt) {
    policyBlockers.push("Company policy: briefing confirmation is required before issue.");
  }
  if (formDefaults.requireEvidencePhotoBeforeIssue && !(form.evidencePhotoUrl || form.evidencePhotoStoragePath)) {
    policyBlockers.push("Company policy: evidence photo is required before issue.");
  }
  conditionalEval.blockers.forEach((b) => policyBlockers.push(b.message));
  const missingSignatureRoles = getRequiredSignatureRoles(type).filter((role) => {
    const signed = (form.signatures || []).find((s) => s.role === role);
    return !signed?.signedAt;
  });
  const effectiveMissingSignatureRoles = allowSignLater ? [] : missingSignatureRoles;
  const baseCanIssue = Boolean(quality.ok && trimmedChecklistItems.length > 0 && legalReady);
  const qualitySummary = summarizePermitQuality({
    canIssueBase: baseCanIssue,
    dynamicMissing: dynamicReq.missingRequired,
    ruleHardStops: [
      ...advancedRules.hardStops,
      ...policyBlockers,
      ...workerEligibilityBlockers.map((x) => `Worker certification missing/expired: ${x}`),
    ],
    qualityFailed: quality.failed || [],
    signatureMissing: effectiveMissingSignatureRoles,
  });
  const canIssue = qualitySummary.canIssue;
  const reviewGate = evaluatePermitActionGate(form, "approve", {});
  const permitCopilotHints = useMemo(() => {
    const hints = (quality.recommendations || []).map((r) => r.text).filter(Boolean);
    if (!form.location) hints.push("Add a precise work location before approval.");
    if (!form.issuedBy || !form.issuedTo) hints.push("Complete issuer + recipient to improve traceability.");
    if ((form.extraFields?.fieldCaptureEntries || []).length === 0) hints.push("Capture at least one field data entry for evidence quality.");
    if ((compliance.missingCriticalRegulatory || []).length > 0) {
      hints.push("Regulatory hard-stop: complete critical compliance evidence before activation.");
    }
    if (!form.linkedRamsId) hints.push("Link RAMS document to strengthen permit context.");
    if (dynamicReq.missingRequired.length > 0) hints.push(`Complete dynamic fields: ${dynamicReq.missingRequired.join(", ")}`);
    if (missingSignatureRoles.length > 0) {
      hints.push(
        allowSignLater
          ? `Signature follow-up pending: ${missingSignatureRoles.join(", ")}`
          : `Collect signatures: ${missingSignatureRoles.join(", ")}`
      );
    }
    return Array.from(new Set(hints)).slice(0, 6);
  }, [form, compliance.missingCriticalRegulatory, dynamicReq.missingRequired, missingSignatureRoles, allowSignLater, quality.recommendations]);

  const buildPermitPayload = (status) => {
    const safeItems = trimmedChecklistItems.length ? trimmedChecklistItems : createDefaultChecklistItems(type, checklistStringsForType(type));
    const safeChecklist = normalizeChecklistState(form.checklist, safeItems);
    const normalizedStatus = status === "pending_review" ? "ready_for_review" : status;
    return {
      ...normalizeAdvancedPermit(form, type),
      type,
      status: normalizedStatus,
      checklistItems: safeItems,
      checklist: safeChecklist,
      templateVersion: form.templateVersion || 1,
      matrixVersion: form.matrixVersion || "uk-v2",
      complianceProfile,
      templateId: form.templateId || `permit.${type}.default`,
      legalContentOwner: form.legalContentOwner || "HSE / Legal Reviewer",
      allowSignLater,
      complianceReviewedAt: form.complianceReviewedAt || null,
      endDateTime: form.endDateTime || form.expiryDate || "",
      workflow: {
        state: normalizedStatus,
        history: [
          { from: form.workflow?.state || form.status || "draft", to: normalizedStatus, at: new Date().toISOString(), note: "form_save" },
          ...(form.workflow?.history || []),
        ].slice(0, 120),
      },
      integrationQueue: Array.isArray(form.integrationQueue) ? form.integrationQueue : [],
    };
  };

  const simopsHits = useMemo(
    () =>
      findSimopsConflicts(
        {
          id: form.id,
          type,
          startDateTime: form.startDateTime,
          endDateTime: form.endDateTime || form.expiryDate,
          location: form.location,
          status: "active",
        },
        allPermits,
        { ignoreId: form.id }
      ),
    [allPermits, form.id, form.startDateTime, form.endDateTime, form.expiryDate, form.location, type]
  );
  const conflictEvaluation = useMemo(
    () => evaluatePermitTypeConflicts({ id: form.id, type }, simopsHits, { permitTypes, matrix: conflictMatrix }),
    [form.id, simopsHits, type, conflictMatrix, permitTypes]
  );
  const dependencyEvaluation = useMemo(
    () => evaluatePermitDependencies({ id: form.id, type }, allPermits, dependencyRules, { now: new Date() }),
    [form.id, type, allPermits, dependencyRules]
  );
  const riskScore = computePermitRiskScore(form, { simopsHits, compliance });
  const handoverRequirementForActivate = useMemo(
    () =>
      evaluatePermitHandoverRequirement(
        {
          ...form,
          status: "active",
          endDateTime: form.endDateTime || form.expiryDate || "",
        },
        new Date(),
        { derivedStatus: "active", shiftHours: handoverShiftHours }
      ),
    [form, handoverShiftHours]
  );
  const activateGate = evaluatePermitActionGate(form, "activate", {
    complianceResult: compliance,
    conflictResult: conflictEvaluation,
    warnConflictOverride: form.conflictWarnOverride,
    allowUnsignedSignatures: allowSignLater,
    handoverRequirement: handoverRequirementForActivate,
    dependencyResult: dependencyEvaluation,
  });
  const nextActorHint = buildPermitNextActorHint(form, compliance, {
    conflictResult: conflictEvaluation,
    warnConflictOverride: form.conflictWarnOverride,
    handoverRequirement: handoverRequirementForActivate,
    dependencyResult: dependencyEvaluation,
  });
  const complianceChecklistPool = useMemo(() => checklistIdsForType(type), [type]);
  const complianceEvidencePool = useMemo(() => evidenceKeysForType(type), [type]);
  const toggleComplianceChecklist = (id) => {
    setComplianceProfiles((prev) => {
      const current = resolvePermitComplianceProfile(type, prev, null);
      const setIds = new Set(current.legalRequiredChecklistIds || []);
      if (setIds.has(id)) setIds.delete(id);
      else setIds.add(id);
      return {
        ...prev,
        [type]: {
          ...current,
          legalRequiredChecklistIds: Array.from(setIds),
        },
      };
    });
  };
  const toggleComplianceEvidence = (key) => {
    setComplianceProfiles((prev) => {
      const current = resolvePermitComplianceProfile(type, prev, null);
      const setIds = new Set(current.requiredEvidenceFields || []);
      if (setIds.has(key)) setIds.delete(key);
      else setIds.add(key);
      return {
        ...prev,
        [type]: {
          ...current,
          requiredEvidenceFields: Array.from(setIds),
        },
      };
    });
  };
  const updateComplianceRefs = (rawText) => {
    const refs = String(rawText || "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    setComplianceProfiles((prev) => {
      const current = resolvePermitComplianceProfile(type, prev, null);
      return {
        ...prev,
        [type]: {
          ...current,
          legalReferences: refs,
        },
      };
    });
  };
  const resetComplianceProfileToDefault = () => {
    if (!window.confirm("Reset compliance profile for this permit type to UK baseline?")) return;
    setComplianceProfiles((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };
  const evidencePack = useMemo(
    () => buildPermitEvidencePack({ ...form, type }, compliance, trimmedChecklistItems),
    [form, type, compliance, trimmedChecklistItems]
  );
  const exportEvidencePackJson = () => {
    const payload = buildPermitEvidencePack(buildPermitPayload(form.status || "draft"), compliance, trimmedChecklistItems);
    const safe = String(form.description || def.label || "permit_evidence_pack")
      .replace(/[^\w\-\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 48);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}_${String(form.id || "").slice(-8)}_evidence_pack.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportEvidencePackCsv = () => {
    const csv = buildEvidencePackCsv(buildPermitPayload(form.status || "draft"), compliance, trimmedChecklistItems);
    const safe = String(form.description || def.label || "permit_evidence_pack")
      .replace(/[^\w\-\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 48);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}_${String(form.id || "").slice(-8)}_evidence_pack.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const step1DescriptionOk = isFieldRequiredEffective("description") ? !!String(form.description || "").trim() : true;
  const step1LocationOk = isFieldRequiredEffective("location") ? !!String(form.location || "").trim() : true;
  const step1Valid = step1DescriptionOk && step1LocationOk;
  const step2Valid = trimmedChecklistItems.length > 0 && dynamicReq.missingRequired.length === 0;
  const step3Valid = quality.ok && (allowSignLater || missingSignatureRoles.length === 0);
  const issueFixes = useMemo(() => {
    const fixes = [];
    if (isFieldRequiredEffective("description") && !String(form.description || "").trim()) fixes.push({ id: "desc", label: "Add work description", step: 1 });
    if (isFieldRequiredEffective("location") && !String(form.location || "").trim()) fixes.push({ id: "location", label: "Add work location", step: 1 });
    if (isFieldRequiredEffective("issuedTo") && !String(form.issuedTo || "").trim()) fixes.push({ id: "issuedTo", label: "Select permit receiver", step: 3 });
    if (isFieldRequiredEffective("issuedBy") && !String(form.issuedBy || "").trim()) fixes.push({ id: "issuedBy", label: "Select authorised issuer", step: 3 });
    if ((isFieldRequiredEffective("startDateTime") || isFieldRequiredEffective("endDateTime")) && (!form.startDateTime || !form.endDateTime)) fixes.push({ id: "time", label: "Set valid start/expiry times", step: 3 });
    if (formDefaults.requireBriefingBeforeIssue && !form.briefingConfirmedAt) fixes.push({ id: "briefing", label: "Confirm briefing timestamp", step: 3 });
    if (formDefaults.requireEvidencePhotoBeforeIssue && !(form.evidencePhotoUrl || form.evidencePhotoStoragePath)) fixes.push({ id: "photo", label: "Add evidence photo", step: 3 });
    if (dynamicReq.missingRequired.length > 0) fixes.push({ id: "dynamic", label: "Complete required dynamic fields", step: 2 });
    if (!allowSignLater && missingSignatureRoles.length > 0) fixes.push({ id: "signatures", label: "Collect required signatures", step: 3 });
    return fixes;
  }, [form.description, form.location, form.issuedTo, form.issuedBy, form.startDateTime, form.endDateTime, form.briefingConfirmedAt, form.evidencePhotoUrl, form.evidencePhotoStoragePath, dynamicReq.missingRequired, allowSignLater, missingSignatureRoles, formDefaults.requireBriefingBeforeIssue, formDefaults.requireEvidencePhotoBeforeIssue, isFieldRequiredEffective]);
  const stepNextEnabled =
    wizardStep === 1 ? step1Valid : wizardStep === 2 ? step2Valid : wizardStep === 3 ? step3Valid : true;
  const stepNextHint =
    wizardStep === 1 && !step1Valid
      ? "Complete required scope fields to continue."
      : wizardStep === 2 && !step2Valid
        ? "Complete required checklist/dynamic fields to continue."
        : wizardStep === 3 && !step3Valid
          ? allowSignLater
            ? "Complete quality blockers to continue."
            : "Complete quality blockers and required signatures to continue."
          : "";

  const previewDoc = wizardStep === 4 ? renderPermitDocumentHtml(buildPermitPayload(form.status || "draft")) : null;

  return (
    <PermitBuilder
      title={permit ? "Edit permit" : "Issue permit to work"}
      onClose={tryClose}
      step={wizardStep}
      previewHtml={previewDoc}
    >

        {/* permit type selector */}
        {wizardStep === 1 && !permit && (
          <div style={{ marginBottom:16 }}>
            <label style={ss.lbl}>Permit type</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:6 }}>
              {Object.entries(permitTypes).map(([k,v])=>(
                <button key={k} type="button" onClick={()=>handleTypeChange(k)} style={{
                  padding:"8px 10px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                  textAlign:"left", lineHeight:1.3, display:"flex", alignItems:"center", gap:8,
                  background: type===k ? v.bg : "var(--color-background-secondary,#f7f7f5)",
                  border: type===k ? `1.5px solid ${v.color}` : "0.5px solid var(--color-border-secondary,#ccc)",
                  color: type===k ? v.color : "var(--color-text-primary)",
                }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={type===k?v.color:"currentColor"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                    <path d={v.icon}/>
                  </svg>
                  <span style={{ fontWeight:type===k?500:400 }}>{v.label}</span>
                </button>
              ))}
            </div>
            {def?.description && <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:8, padding:"6px 10px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6 }}>{def.description}</div>}
          </div>
        )}

        {wizardStep === 1 && !permit && (
          <div style={{ marginBottom:12, display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
            <button type="button" style={{ ...ss.btn, fontSize:12 }} onClick={prefillFromRecent} disabled={!recentPermit}>
              Prefill from latest permit
            </button>
            <button
              type="button"
              style={{ ...ss.btn, fontSize:12 }}
              onClick={() => applyPrefill(
                {
                  issuedBy: org.defaultLeadEngineer || "",
                  projectId: permitPrefs.projectId || "",
                  location: permitPrefs.location || "",
                },
                "Prefilled from org + last used"
              )}
            >
              Apply smart defaults
            </button>
            {prefillNote ? <span style={{ ...ss.chip, fontSize:11 }}>{prefillNote}</span> : null}
          </div>
        )}

        <div style={{ marginBottom:12, border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px", background:"var(--color-background-secondary,#f7f7f5)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
            <div style={{ fontSize:12, fontWeight:700 }}>Permit quality panel</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ ...ss.chip, fontSize:11 }}>Progress {qualitySummary.progress}%</span>
              <span style={{ ...ss.chip, fontSize:11, background:riskScore.level === "high" ? "#FCEBEB" : riskScore.level === "medium" ? "#FAEEDA" : "#EAF3DE", color:riskScore.level === "high" ? "#791F1F" : riskScore.level === "medium" ? "#633806" : "#27500A" }}>
                Risk {riskScore.score}
              </span>
            </div>
          </div>
          {qualitySummary.blockers.length > 0 ? (
            <ul style={{ margin:"6px 0 0", paddingLeft:18, fontSize:12, color:"#791F1F" }}>
              {qualitySummary.blockers.slice(0, 4).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <div style={{ marginTop:6, fontSize:12, color:"#27500A" }}>Issue-ready. All advanced gates passed.</div>
          )}
          {Array.isArray(quality.recommendations) && quality.recommendations.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#0C447C" }}>Quality Gate AI hints</div>
                {(quality.recommendations || []).some((r) => r?.autofix) ? (
                  <button type="button" onClick={applyAllQualityAutofixes} style={{ ...ss.btn, fontSize: 10, padding: "3px 8px" }}>
                    Apply all safe autofixes
                  </button>
                ) : null}
              </div>
              <ul
                style={{
                  margin: "0",
                  paddingLeft: 18,
                  fontSize: 12,
                  color: "#0C447C",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {quality.recommendations.map((hint) => (
                  <li key={hint.id || hint.text}>
                    <span>{hint.text}</span>
                    {hint.autofix ? (
                      <button
                        type="button"
                        onClick={() => applyQualityAutofix(hint)}
                        style={{ ...ss.btn, fontSize: 10, padding: "2px 6px", marginLeft: 8 }}
                      >
                        Autofix
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Step 1 — scope */}
        {wizardStep === 1 && (
        <>
        {permit && (
          <div style={{ marginBottom:12, fontSize:13, padding:"8px 10px", background:def.bg, borderRadius:8, border:`1px solid ${def.color}`, color:def.color }}>
            <strong>Permit type:</strong> {def.label}
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          {isFieldVisible("description") ? (
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>{fieldLabelResolved("description", "Description of work")}</label>
            <textarea value={form.description||""} onChange={e=>set("description",e.target.value)} rows={2}
              placeholder={getFieldConfig("description").placeholder || "Describe the specific work to be carried out under this permit..."}
              maxLength={getFieldConfig("description").maxLength || undefined}
              style={{ ...ss.ta, minHeight:50 }} />
            {getFieldConfig("description").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("description").helpText}</div> : null}
            <div style={{ marginTop:6 }}>
              <button
                type="button"
                style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}
                onClick={() => set("description", suggestPermitDescriptionText({ ...form, type }))}
              >
                Smart suggest description
              </button>
            </div>
          </div>
          ) : null}
          {isFieldVisible("location") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("location", "Location")}</label>
            <input
              value={form.location||""}
              onChange={e=>{
                set("location",e.target.value);
                if (form.locationObjectId) {
                  set("locationObjectId", "");
                  set("locationObjectType", "");
                }
              }}
              placeholder={getFieldConfig("location").placeholder || "Where will work be carried out?"}
              maxLength={getFieldConfig("location").maxLength || undefined}
              style={ss.inp}
            />
            {form.projectId ? (
              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <select
                    value={locationObjectTypeFilter}
                    onChange={(e) => setLocationObjectTypeFilter(e.target.value)}
                    style={{ ...ss.inp, margin: 0, minWidth: 170 }}
                  >
                    <option value="all">All object types</option>
                    {PROJECT_DRAWING_OBJECT_TYPES.map((meta) => (
                      <option key={meta.id} value={meta.id}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ ...ss.chip, fontSize: 11 }}>
                    {drawingObjectsForPicker.length} object(s)
                  </span>
                </div>
                <select
                  value={form.locationObjectId || ""}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (!nextId) {
                      set("locationObjectId", "");
                      set("locationObjectType", "");
                      return;
                    }
                    const obj = projectDrawingObjects.find((row) => row.id === nextId);
                    set("locationObjectId", nextId);
                    set("locationObjectType", obj?.type || "");
                    set("location", drawingObjectLabel(obj));
                  }}
                  style={{ ...ss.inp, margin: 0 }}
                >
                  <option value="">Use free-text location</option>
                  {drawingObjectsForPicker.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {drawingObjectLabel(obj)}
                    </option>
                  ))}
                </select>
                {recentProjectLocations.length > 0 ? (
                  <select
                    value=""
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      if (!Number.isFinite(idx)) return;
                      const row = recentProjectLocations[idx];
                      if (!row) return;
                      set("location", row.location);
                      set("locationObjectId", row.locationObjectId || "");
                      set("locationObjectType", row.locationObjectType || "");
                    }}
                    style={{ ...ss.inp, margin: 0 }}
                  >
                    <option value="">Recent locations for this project</option>
                    {recentProjectLocations.slice(0, 8).map((row, idx) => (
                      <option key={`${row.projectId}_${row.location}_${idx}`} value={idx}>
                        {recentLocationOptionLabel(row)}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PROJECT_DRAWING_OBJECT_TYPES.map((meta) => (
                    <span
                      key={meta.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 999,
                        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                        background: "var(--color-background-secondary,#f7f7f5)",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: meta.shape === "square" ? 2 : "50%",
                          background: meta.color,
                          display: "inline-block",
                        }}
                      />
                      {meta.label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  style={{ ...ss.btn, width: "fit-content", fontSize: 11, padding: "3px 8px" }}
                  onClick={() => {
                    setWorkspaceNavTarget({ viewId: "project-drawings", projectId: form.projectId });
                    openWorkspaceView({ viewId: "project-drawings" });
                  }}
                >
                  Manage project drawing objects
                </button>
              </div>
            ) : null}
            {getFieldConfig("location").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("location").helpText}</div> : null}
          </div>
          ) : null}
          {isFieldVisible("linkedRamsId") ? (
          <div>
            <label style={ss.lbl}>Project</label>
            <select
              value={form.projectId||""}
              onChange={e=>{
                const nextId = e.target.value;
                set("projectId", nextId);
                set("locationObjectId", "");
                set("locationObjectType", "");
                if (!String(form.location || "").trim()) {
                  const project = projects.find((p) => p.id === nextId);
                  const projectLocation = pickProjectLocation(project);
                  if (projectLocation) set("location", projectLocation);
                }
              }}
              style={ss.inp}
            >
              <option value="">— Select project —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          ) : null}
          {isFieldVisible("issuedTo") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("linkedRamsId", "Linked RAMS")}</label>
            <select
              value={form.linkedRamsId || ""}
              onChange={(e) => {
                set("linkedRamsId", e.target.value);
                if (e.target.value) trackEvent("permit_linked_rams", { permitType: type });
              }}
              style={ss.inp}
            >
              <option value="">— None —</option>
              {ramsDocs
                .filter((d) => !form.projectId || d.projectId === form.projectId)
                .slice(0, 200)
                .map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title || "Untitled RAMS"}{doc.documentNo ? ` · ${doc.documentNo}` : ""}
                  </option>
                ))}
            </select>
            {getFieldConfig("linkedRamsId").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("linkedRamsId").helpText}</div> : null}
          </div>
          ) : null}
          {dynamicSpec.length > 0 && (
            <div style={{ gridColumn:"1/-1", marginTop:4 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>
                Dynamic fields ({def.label})
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
                {dynamicSpec.map((f) => {
                  const visible = !f.when || String(form.extraFields?.dynamic?.[f.when.key] || "") === String(f.when.equals);
                  if (!visible) return null;
                  const v = form.extraFields?.dynamic?.[f.key];
                  return (
                    <div key={f.key}>
                      <label style={ss.lbl}>{f.label}{f.required ? " *" : ""}</label>
                      {f.type === "checkbox" ? (
                        <label style={{ display:"inline-flex", alignItems:"center", gap:8, fontSize:13 }}>
                          <input type="checkbox" checked={v === true} onChange={(e) => setDynamic(f.key, e.target.checked)} />
                          Confirm
                        </label>
                      ) : f.type === "select" ? (
                        <select value={v || ""} onChange={(e) => setDynamic(f.key, e.target.value)} style={ss.inp}>
                          <option value="">— Select —</option>
                          {(f.options || []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input type={f.type || "text"} value={v || ""} onChange={(e) => setDynamic(f.key, e.target.value)} style={ss.inp} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* Step 3 — people, timing, authorisation */}
        {wizardStep === 3 && (
        <>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          {isFieldVisible("issuedTo") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("issuedTo", "Permit issued to")}</label>
            {workers.length > 0 ? (
              <>
                <select value={issuedToPick} onChange={onIssuedToSelect} style={{ ...ss.inp, marginBottom: issuedToPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {assignMeLabel ? <option value="__me__">Assign me ({assignMeLabel})</option> : null}
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {permitPersonLabel(w) || w.name}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name)</option>
                </select>
                {issuedToPick === "__custom__" && (
                  <input value={form.issuedTo || ""} onChange={(e) => set("issuedTo", e.target.value)} placeholder={getFieldConfig("issuedTo").placeholder || "Name of person receiving permit"} maxLength={getFieldConfig("issuedTo").maxLength || undefined} style={ss.inp} />
                )}
              </>
            ) : (
              <input value={form.issuedTo || ""} onChange={(e) => set("issuedTo", e.target.value)} placeholder={getFieldConfig("issuedTo").placeholder || "Name of person receiving permit"} maxLength={getFieldConfig("issuedTo").maxLength || undefined} style={ss.inp} />
            )}
            {getFieldConfig("issuedTo").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("issuedTo").helpText}</div> : null}
            {selectedIssuedWorkerCerts.length > 0 ? (
              <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:6 }}>
                {selectedIssuedWorkerCerts.slice(0, 6).map((c) => (
                  <span key={c} style={{ ...ss.chip, fontSize:11 }}>
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          ) : null}
          {issuedWorkerEligibility && (
            <div style={{ gridColumn: "1/-1", fontSize:12, padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", background: issuedWorkerEligibility.eligible ? "#EAF3DE" : "#FCEBEB", color: issuedWorkerEligibility.eligible ? "#27500A" : "#791F1F" }}>
              <strong>Worker permit eligibility:</strong>{" "}
              {issuedWorkerEligibility.eligible
                ? "Eligible for this permit type."
                : "Missing or expired mandatory certifications."}
              {!issuedWorkerEligibility.eligible && (
                <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                  {issuedWorkerEligibility.missing.map((m) => (
                    <li key={`m_${m}`}>Missing: {m}</li>
                  ))}
                  {issuedWorkerEligibility.expired.map((e) => (
                    <li key={`e_${e.label}`}>Expired: {e.label}</li>
                  ))}
                </ul>
              )}
              {issuedWorkerEligibility.expiringSoon.length > 0 && (
                <div style={{ marginTop:6, color:"#633806" }}>
                  Expiring soon: {issuedWorkerEligibility.expiringSoon.map((x) => `${x.label} (${x.days}d)`).join(", ")}
                </div>
              )}
            </div>
          )}
          {isFieldVisible("issuedBy") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("issuedBy", "Issued by (authorised person)")}</label>
            {workers.length > 0 ? (
              <>
                <select value={issuedByPick} onChange={onIssuedBySelect} style={{ ...ss.inp, marginBottom: issuedByPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {assignMeLabel ? <option value="__me__">Assign me ({assignMeLabel})</option> : null}
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {permitPersonLabel(w) || w.name}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name)</option>
                </select>
                {issuedByPick === "__custom__" && (
                  <input value={form.issuedBy || ""} onChange={(e) => set("issuedBy", e.target.value)} placeholder={getFieldConfig("issuedBy").placeholder || "Authorised person name"} maxLength={getFieldConfig("issuedBy").maxLength || undefined} style={ss.inp} />
                )}
              </>
            ) : (
              <input value={form.issuedBy || ""} onChange={(e) => set("issuedBy", e.target.value)} placeholder={getFieldConfig("issuedBy").placeholder || "Authorised person name"} maxLength={getFieldConfig("issuedBy").maxLength || undefined} style={ss.inp} />
            )}
            {getFieldConfig("issuedBy").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("issuedBy").helpText}</div> : null}
            {selectedIssuerCerts.length > 0 ? (
              <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:6 }}>
                {selectedIssuerCerts.slice(0, 6).map((c) => (
                  <span key={c} style={{ ...ss.chip, fontSize:11 }}>
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          ) : null}
          {isFieldVisible("startDateTime") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("startDateTime", "Start date / time")}</label>
            <input type="datetime-local" value={toLocalInput(form.startDateTime)} onChange={e=>set("startDateTime",new Date(e.target.value).toISOString())} style={ss.inp} />
            {getFieldConfig("startDateTime").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("startDateTime").helpText}</div> : null}
          </div>
          ) : null}
          {isFieldVisible("endDateTime") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("endDateTime", "Expiry date / time")}</label>
            <input type="datetime-local" value={toLocalInput(form.endDateTime)} onChange={e=>set("endDateTime",new Date(e.target.value).toISOString())} style={ss.inp} />
            {getFieldConfig("endDateTime").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("endDateTime").helpText}</div> : null}
          </div>
          ) : null}
          {isFieldVisible("authorisedByRole") ? (
          <div style={{ gridColumn: "1/-1" }}>
            <label style={ss.lbl}>{fieldLabelResolved("authorisedByRole", "Authorising role / competency reference")}</label>
            <input
              value={form.authorisedByRole||""}
              onChange={(e)=>set("authorisedByRole",e.target.value)}
              placeholder={getFieldConfig("authorisedByRole").placeholder || "e.g. Competent person (electrical), AP lifting"}
              maxLength={getFieldConfig("authorisedByRole").maxLength || undefined}
              style={ss.inp}
              list="permit-competency-suggestions"
            />
            {getFieldConfig("authorisedByRole").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("authorisedByRole").helpText}</div> : null}
            <datalist id="permit-competency-suggestions">
              {competencySuggestions.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
            {selectedIssuerCerts.length > 0 ? (
              <div style={{ marginTop:6 }}>
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}
                  onClick={() => set("authorisedByRole", selectedIssuerCerts.slice(0, 3).join(", "))}
                >
                  Use issuer certifications
                </button>
              </div>
            ) : null}
          </div>
          ) : null}
          {isFieldVisible("briefingConfirmedAt") ? (
          <div>
            <label style={ss.lbl}>{fieldLabelResolved("briefingConfirmedAt", "Briefing confirmed at")}</label>
            <input type="datetime-local" value={toLocalInput(form.briefingConfirmedAt)} onChange={(e)=>set("briefingConfirmedAt", e.target.value ? new Date(e.target.value).toISOString() : "")} style={ss.inp} />
            {getFieldConfig("briefingConfirmedAt").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("briefingConfirmedAt").helpText}</div> : null}
          </div>
          ) : null}
          {isFieldVisible("evidencePhotoUrl") ? (
          <div style={{ gridColumn: "1/-1" }}>
            <label style={ss.lbl}>{fieldLabelResolved("evidencePhotoUrl", "Site evidence photo URL")}</label>
            <input value={form.evidencePhotoUrl||""} onChange={(e)=>set("evidencePhotoUrl",e.target.value)} placeholder={getFieldConfig("evidencePhotoUrl").placeholder || "https://..."} maxLength={getFieldConfig("evidencePhotoUrl").maxLength || undefined} style={ss.inp} />
            {getFieldConfig("evidencePhotoUrl").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("evidencePhotoUrl").helpText}</div> : null}
            {(form.evidencePhotoUrl || form.evidencePhotoStoragePath) ? (
              <div style={{ marginTop:8 }}>
                <PermitEvidenceImage storagePath={form.evidencePhotoStoragePath} srcUrl={form.evidencePhotoUrl} />
              </div>
            ) : null}
            {supabase ? (
              <div style={{ marginTop:8 }}>
                <label style={{ ...ss.lbl, fontSize:12 }}>Or upload image (signed in; 7-day view link)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={evidenceUploadBusy}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setEvidenceUploadBusy(true);
                    try {
                      const { path, signedUrl } = await uploadPermitEvidencePhoto(f, form.id);
                      setForm((prev) => ({ ...prev, evidencePhotoStoragePath: path, evidencePhotoUrl: signedUrl }));
                    } catch (err) {
                      window.alert(err?.message || String(err));
                    } finally {
                      setEvidenceUploadBusy(false);
                    }
                  }}
                  style={{ display:"block", marginTop:4, fontSize:12 }}
                />
              </div>
            ) : null}
          </div>
          ) : null}
          {isFieldVisible("evidenceNotes") ? (
          <div style={{ gridColumn: "1/-1" }}>
            <label style={ss.lbl}>{fieldLabelResolved("evidenceNotes", "Evidence notes")}</label>
            <textarea value={form.evidenceNotes||""} onChange={(e)=>set("evidenceNotes",e.target.value)} rows={2} placeholder={getFieldConfig("evidenceNotes").placeholder || "Toolbox talk reference, barrier ID, etc."} maxLength={getFieldConfig("evidenceNotes").maxLength || undefined} style={{ ...ss.ta, minHeight:44 }} />
            {getFieldConfig("evidenceNotes").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("evidenceNotes").helpText}</div> : null}
            <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
              <button type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={rememberEvidenceNote}>
                Save for future use
              </button>
              {evidenceNoteSnippets.slice(0, 3).map((text) => (
                <button key={text} type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={() => set("evidenceNotes", text)}>
                  {text.slice(0, 46)}{text.length > 46 ? "..." : ""}
                </button>
              ))}
            </div>
          </div>
          ) : null}
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
              <label style={ss.lbl}>Field data capture (offline-first)</label>
              <button type="button" onClick={() => void addFieldCaptureEntry()} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                + Add field entry
              </button>
            </div>
            {Array.isArray(form.extraFields?.fieldCaptureEntries) && form.extraFields.fieldCaptureEntries.length > 0 ? (
              <div style={{ marginTop:6, display:"grid", gap:6 }}>
                {form.extraFields.fieldCaptureEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"6px 8px", fontSize:11 }}>
                    <strong>{entry.kind}</strong> · {fmtDateTime(entry.at)}
                    {entry.geo ? ` · ${entry.geo.lat}, ${entry.geo.lng}` : ""}
                    {entry.note ? <div style={{ color:"var(--color-text-secondary)", marginTop:2 }}>{entry.note}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>No field entries recorded yet.</div>
            )}
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
              <label style={ss.lbl}>Signature chain</label>
              <span style={{ ...ss.chip, fontSize:11 }}>
                {(form.signatures || []).filter((s) => s.signedAt).length}/{getRequiredSignatureRoles(type).length} signed
              </span>
            </div>
            <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, marginBottom:6 }}>
              <input type="checkbox" checked={allowSignLater} onChange={(e) => setAllowSignLater(e.target.checked)} />
              Allow issue now and collect missing signatures later
            </label>
            <div style={{ display:"grid", gap:6 }}>
              {getRequiredSignatureRoles(type).map((role) => {
                const row = (form.signatures || []).find((s) => s.role === role) || { role, signedBy:"", signedAt:"" };
                return (
                  <div key={role} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                    <div style={{ fontSize:12 }}>
                      <strong>{role.replace(/_/g, " ")}</strong>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                        {row.signedAt ? `${row.signedBy || "signed"} · ${fmtDateTime(row.signedAt)}` : "Not signed"}
                      </div>
                      {row.signatureImageDataUrl ? (
                        <div style={{ marginTop:6 }}>
                          <img
                            src={row.signatureImageDataUrl}
                            alt={`${role} signature`}
                            style={{ width:120, height:38, objectFit:"contain", border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:4, background:"#fff" }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button type="button" onClick={() => signRole(role)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                        {row.signedAt ? "Re-sign" : "Sign"}
                      </button>
                      {selectedIssuerWorker ? (
                        <button type="button" onClick={() => signRole(role, selectedIssuerWorker.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                          Sign as issuer
                        </button>
                      ) : null}
                      {selectedIssuedWorker ? (
                        <button type="button" onClick={() => signRole(role, selectedIssuedWorker.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                          Sign as receiver
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {signatureDialog ? (
              <div
                style={{
                  position:"fixed",
                  inset:0,
                  zIndex:80,
                  background:"rgba(0,0,0,0.45)",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  padding:16,
                }}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setSignatureDialog(null);
                }}
              >
                <div
                  style={{
                    width:"100%",
                    maxWidth:640,
                    borderRadius:10,
                    background:"var(--color-background-primary,#fff)",
                    border:"1px solid var(--color-border-tertiary,#e5e5e5)",
                    padding:12,
                    boxShadow:"0 10px 32px rgba(0,0,0,0.22)",
                  }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:8 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>
                      Signature pad · {signatureDialog.role?.replace(/_/g, " ")}
                    </div>
                    <button type="button" onClick={() => setSignatureDialog(null)} style={{ ...ss.btn, fontSize:12, padding:"3px 8px" }}>
                      Close
                    </button>
                  </div>
                  <div style={{ display:"grid", gap:8 }}>
                    <select
                      value={signatureDialog.signedByWorkerId || ""}
                      onChange={(e) => setSignatureDialog((s) => (s ? { ...s, signedByWorkerId: e.target.value } : s))}
                      style={ss.inp}
                    >
                      <option value="">Select worker for signature</option>
                      {(signatureDialog.allowedWorkerIds || [])
                        .map((id) => findWorkerById(id))
                        .filter(Boolean)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {permitPersonLabel(w) || w.name}
                          </option>
                        ))}
                    </select>
                    <input
                      value={signatureDialog.note || ""}
                      onChange={(e) => setSignatureDialog((s) => (s ? { ...s, note: e.target.value } : s))}
                      placeholder="Optional signature note"
                      style={ss.inp}
                    />
                    <div style={{ border:"1px solid var(--color-border-secondary,#cbd5e1)", borderRadius:8, background:"#fff", padding:4 }}>
                      <canvas
                        ref={signatureCanvasRef}
                        style={{ width:"100%", height:140, display:"block", touchAction:"none", cursor:"crosshair" }}
                        onPointerDown={handleSignaturePointerDown}
                        onPointerMove={handleSignaturePointerMove}
                        onPointerUp={handleSignaturePointerUp}
                        onPointerLeave={handleSignaturePointerUp}
                      />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                      <button type="button" onClick={clearSignatureCanvas} style={{ ...ss.btn, fontSize:12 }}>
                        Clear pad
                      </button>
                      <button type="button" onClick={commitSignatureDialog} style={{ ...ss.btnO, fontSize:12 }}>
                        Save signature
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {simopsHits.length > 0 && (
          <div style={{ marginBottom:12, fontSize:12, padding:"8px 10px", borderRadius:8, background:"#FCEBEB", border:"1px solid #f5c7c7", color:"#791F1F" }}>
            <strong>SIMOPS / overlap:</strong> {simopsHits.length} other permit(s) share this location with an overlapping validity window.
            <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
              {simopsHits.slice(0,6).map((p) => (
                <li key={p.id}>{(permitTypes[p.type]||permitTypes.general).label} · {fmtDateTime(p.startDateTime)} → {fmtDateTime(permitEndIso(p))}</li>
              ))}
            </ul>
          </div>
        )}
        {isFieldVisible("notes") ? (
        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>{fieldLabelResolved("notes", "Additional conditions / notes")}</label>
          <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} rows={2}
            placeholder={getFieldConfig("notes").placeholder || "Any specific conditions, restrictions or additional requirements..."}
            maxLength={getFieldConfig("notes").maxLength || undefined}
            style={{ ...ss.ta, minHeight:50 }} />
          {getFieldConfig("notes").helpText ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{getFieldConfig("notes").helpText}</div> : null}
          <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
            <button type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={rememberConditionNote}>
              Save for future use
            </button>
            {conditionSnippets.slice(0, 3).map((text) => (
              <button key={text} type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={() => set("notes", text)}>
                {text.slice(0, 46)}{text.length > 46 ? "..." : ""}
              </button>
            ))}
          </div>
        </div>
        ) : null}
        </>
        )}

        {wizardStep === 2 && (
        <>
        {/* type-specific extra fields */}
        {def?.extraFields?.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>
              {def.label} — specific information
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
              {def.extraFields.map(f=>(
                <div key={f.key}>
                  <label style={ss.lbl}>{f.label}</label>
                  <input type={f.type||"text"} value={form.extraFields?.[f.key]||""} onChange={e=>setExtra(f.key,e.target.value)} style={ss.inp} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* checklist */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>
              Pre-work checklist
            </div>
            {typeMeta?.hseUrl ? (
              <a href={typeMeta.hseUrl} target="_blank" rel="noopener noreferrer" title={typeMeta.rationale} style={{ fontSize:11, color:"#0C447C" }}>
                Why these controls (HSE)
              </a>
            ) : null}
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20,
              background:allChecked?"#EAF3DE":"#FAEEDA",
              color:allChecked?"#27500A":"#633806" }}>
              {checkCount}/{totalChecks}
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)" }}>
              Template v{form.templateVersion || 1}
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)" }}>
              Matrix {complianceProfile.matrixVersion || "uk-v2"}
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background: legalReady ? "#EAF3DE" : "#FCEBEB", color: legalReady ? "#27500A" : "#791F1F" }}>
              {legalReady ? "LegalReady" : "Legal checks missing"}
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>
              DataComplete {Math.round(compliance.dataComplete * 100)}%
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)" }}>
              Legal review by {nextLegalReviewDate(form.createdAt || new Date().toISOString())}
            </span>
            {flags && (
              <button type="button" onClick={() => setTemplateEditMode((v) => !v)} style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }}>
                {templateEditMode ? "Finish editing template" : "Edit checklist template"}
              </button>
            )}
            {flags && templateEditMode && (
              <button type="button" onClick={saveCurrentAsOrgTemplate} style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }}>
                Save as org template
              </button>
            )}
            {flags && templateEditMode && (
              <button type="button" onClick={rollbackTemplateVersion} style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }} disabled={(form.templateHistory || []).length === 0}>
                Rollback template
              </button>
            )}
            <button type="button" onClick={() => setComplianceEditMode((v) => !v)} style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }}>
              {complianceEditMode ? "Hide UK compliance profile" : "Edit UK compliance profile"}
            </button>
          </div>
          {complianceEditMode && (
            <div style={{ marginBottom:10, border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px", background:"#f8fbff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>Compliance profile for {def.label}</div>
                <button type="button" onClick={resetComplianceProfileToDefault} style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }}>
                  Reset to UK baseline
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(220px,100%),1fr))", gap:10 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Mandatory checklist IDs</div>
                  <div style={{ display:"grid", gap:4 }}>
                    {complianceChecklistPool.map((id) => (
                      <label key={id} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                        <input
                          type="checkbox"
                          checked={(complianceProfile.legalRequiredChecklistIds || []).includes(id)}
                          onChange={() => toggleComplianceChecklist(id)}
                          style={{ accentColor:"#0d9488" }}
                        />
                        {id}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Mandatory evidence fields</div>
                  <div style={{ display:"grid", gap:4 }}>
                    {complianceEvidencePool.length === 0 ? (
                      <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No extra evidence fields for this permit type.</span>
                    ) : (
                      complianceEvidencePool.map((key) => (
                        <label key={key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                          <input
                            type="checkbox"
                            checked={(complianceProfile.requiredEvidenceFields || []).includes(key)}
                            onChange={() => toggleComplianceEvidence(key)}
                            style={{ accentColor:"#0d9488" }}
                          />
                          {key}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8 }}>
                <label style={ss.lbl}>Custom legal references (one per line)</label>
                <textarea
                  rows={3}
                  value={(complianceProfile.legalReferences || []).join("\n")}
                  onChange={(e) => updateComplianceRefs(e.target.value)}
                  placeholder={"e.g.\nWAHR Reg 6 planning\nLOLER Reg 8 organisation\nPUWER Reg 4 suitability"}
                  style={{ ...ss.ta, minHeight:70 }}
                />
              </div>
            </div>
          )}
          <div style={{ height:3, background:"var(--color-border-tertiary,#e5e5e5)", borderRadius:2, marginBottom:12 }}>
            <div style={{ height:3, borderRadius:2, background:allChecked?"#1D9E75":"#0d9488", transition:"width .3s",
              width:`${totalChecks>0?(checkCount/totalChecks)*100:0}%` }} />
          </div>
          {checklistItems.map((item)=>(
            <label key={item.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", cursor:"pointer" }}>
              <input type="checkbox" checked={!!form.checklist[item.id]} onChange={e=>setCheck(item.id,e.target.checked)}
                style={{ marginTop:2, accentColor:"#0d9488", width:15, height:15, flexShrink:0 }} />
              <div style={{ display:"flex", alignItems:"center", gap:8, width:"100%" }}>
                {templateEditMode ? (
                  <div style={{ display:"flex", gap:6, width:"100%", alignItems:"center" }}>
                    <input
                      value={item.text}
                      onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                      placeholder="Checklist item"
                      style={{ ...ss.inp, margin:0 }}
                    />
                    <button type="button" onClick={() => moveChecklistItem(item.id, "up")} style={{ ...ss.btn, fontSize:11, padding:"2px 6px" }}>↑</button>
                    <button type="button" onClick={() => moveChecklistItem(item.id, "down")} style={{ ...ss.btn, fontSize:11, padding:"2px 6px" }}>↓</button>
                  </div>
                ) : (
                  <span style={{ fontSize:13, lineHeight:1.5 }}>{item.text}</span>
                )}
                {templateEditMode && !item.required && (
                  <button type="button" onClick={() => removeChecklistItem(item.id)} style={{ ...ss.btn, fontSize:11, padding:"2px 8px", color:"#A32D2D", borderColor:"#F09595" }}>
                    Remove
                  </button>
                )}
              </div>
            </label>
          ))}
          {flags && templateEditMode && (
            <div style={{ marginTop:10 }}>
              <button type="button" onClick={addChecklistItem} style={{ ...ss.btn, fontSize:12 }}>
                + Add custom checklist item
              </button>
              <button type="button" onClick={importChecklistFromText} style={{ ...ss.btn, fontSize:12, marginLeft:8 }}>
                Import lines
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {wizardStep < 4 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, paddingTop:12, borderTop:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <button type="button" style={ss.btn} disabled={wizardStep<=1} onClick={()=>setWizardStep((s)=>Math.max(1,s-1))}>Back</button>
          <div style={{ textAlign:"right" }}>
            {!stepNextEnabled && stepNextHint ? (
              <div style={{ fontSize:11, color:"#854d0e", marginBottom:4 }}>{stepNextHint}</div>
            ) : null}
            <button type="button" style={{ ...ss.btnO, opacity: stepNextEnabled ? 1 : 0.45 }} disabled={!stepNextEnabled} onClick={()=>setWizardStep((s)=>Math.min(4,s+1))}>Next</button>
          </div>
        </div>
        )}

        {wizardStep === 4 && (
        <>
        <div style={{ marginBottom:12, fontSize:12, color:"var(--color-text-secondary)" }}>
          <div style={{ fontWeight:600, marginBottom:6, color:"var(--color-text-primary)" }}>Final checks</div>
          <p style={{ margin:"0 0 8px", lineHeight:1.5 }}>{typeMeta.rationale}</p>
          <ul style={{ margin:0, paddingLeft:18 }}>
            <li>Legal readiness: {legalReady ? "OK" : "Action required"}</li>
            <li>Data completeness: {Math.round(compliance.dataComplete * 100)}%</li>
            <li>Workflow state: {form.workflow?.state || form.status || "draft"}</li>
            {complianceProfile.legalReferences?.length ? (
              <li>Legal refs: {complianceProfile.legalReferences.slice(0, 3).join(" · ")}</li>
            ) : null}
            {simopsHits.length > 0 ? <li style={{ color:"#791F1F" }}>SIMOPS: {simopsHits.length} overlapping permit(s) at this location</li> : null}
          </ul>
          {typeMeta.hseUrl ? (
            <a href={typeMeta.hseUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#0C447C", marginTop:8, display:"inline-block" }}>Open HSE guidance</a>
          ) : null}
        </div>
        {Array.isArray(form.versionHistory) && form.versionHistory.length > 0 ? (
          <div style={{ marginBottom:12, fontSize:12, background:"var(--color-background-secondary,#f7f7f5)", border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:6 }}>
              <div style={{ fontWeight:700 }}>Permit version history</div>
              <span style={ss.chip}>{form.versionHistory.length} snapshot(s)</span>
            </div>
            <div style={{ display:"grid", gap:6 }}>
              {form.versionHistory.slice(0, 4).map((entry) => (
                <div key={entry.id} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:6, padding:"6px 8px", background:"var(--color-background-primary,#fff)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                    <div>
                      <strong>{fmtDateTime(entry.at)}</strong> · {entry.by || "unknown"}
                    </div>
                    <button type="button" onClick={() => rollbackToVersion(entry)} style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }}>
                      Rollback to this
                    </button>
                  </div>
                  {entry.reason ? <div style={{ color:"var(--color-text-secondary)" }}>Why: {entry.reason}</div> : null}
                  {Array.isArray(entry.diffKeys) && entry.diffKeys.length > 0 ? (
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                      Changed: {entry.diffKeys.slice(0, 6).join(", ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ marginBottom:12, fontSize:12, background:"#f8fbff", border:"1px solid #dbeafe", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
            <div style={{ fontWeight:700, color:"#0C447C" }}>UK evidence pack validator</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={exportEvidencePackJson} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                Export JSON
              </button>
              <button type="button" onClick={exportEvidencePackCsv} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                Export CSV
              </button>
              <button type="button" onClick={() => void exportSignaturePackJson()} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                Signature pack JSON
              </button>
              <button type="button" onClick={exportSignaturePngs} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                Signature PNGs
              </button>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:evidencePack.summary.checklistOk ? "#EAF3DE" : "#FCEBEB", color:evidencePack.summary.checklistOk ? "#27500A" : "#791F1F" }}>
              Checklist {evidencePack.summary.checklistOk ? "OK" : "Missing"}
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:evidencePack.summary.evidenceOk ? "#EAF3DE" : "#FCEBEB", color:evidencePack.summary.evidenceOk ? "#27500A" : "#791F1F" }}>
              Evidence {evidencePack.summary.evidenceOk ? "OK" : "Missing"}
            </span>
            <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:evidencePack.summary.regulatoryOk ? "#EAF3DE" : "#FCEBEB", color:evidencePack.summary.regulatoryOk ? "#27500A" : "#791F1F" }}>
              Regulatory {evidencePack.summary.regulatoryOk ? "OK" : "Missing"}
            </span>
          </div>
          {!evidencePack.summary.overallPass && (
            <ul style={{ margin:"8px 0 0", paddingLeft:18 }}>
              {evidencePack.checks.evidence.filter((x) => !x.ok).slice(0, 5).map((x) => (
                <li key={x.key}>Evidence missing: {x.key}</li>
              ))}
              {evidencePack.checks.checklist.filter((x) => !x.ok).slice(0, 5).map((x) => (
                <li key={x.id}>Checklist missing: {x.id}</li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ marginBottom:12, fontSize:12, background:"#f8fafc", border:"1px solid #dbe5f1", borderRadius:8, padding:"8px 10px" }}>
          <div style={{ fontWeight:700, color:"#0C447C", marginBottom:6 }}>Role workflow gates</div>
          <div style={{ display:"grid", gap:4 }}>
            <div>
              Review gate:{" "}
              <strong style={{ color: reviewGate.allowed ? "#27500A" : "#791F1F" }}>
                {reviewGate.allowed ? "ready for approval" : "blocked"}
              </strong>
              {!reviewGate.allowed ? ` — ${reviewGate.message}` : ""}
            </div>
            <div>
              Activation gate:{" "}
              <strong style={{ color: activateGate.allowed ? "#27500A" : "#791F1F" }}>
                {activateGate.allowed ? "ready for activation" : "blocked"}
              </strong>
              {!activateGate.allowed ? ` — ${activateGate.message}` : ""}
            </div>
            {conflictEvaluation.outcome !== "allow" ? (
              <div style={{ color: conflictEvaluation.outcome === "block" ? "#791F1F" : "#633806" }}>
                Permit conflict matrix:{" "}
                <strong>{conflictEvaluation.outcome === "block" ? "blocked overlap" : "warn override required"}</strong>
              </div>
            ) : null}
            {nextActorHint ? <div style={{ color:"#334155" }}><strong>{nextActorHint}</strong></div> : null}
          </div>
        </div>
        {conflictEvaluation.outcome === "warn" ? (
          <div style={{ marginBottom:12, fontSize:12, background:"#FFFBEB", border:"1px solid #fcd34d", borderRadius:8, padding:"8px 10px" }}>
            <div style={{ fontWeight:700, color:"#854d0e", marginBottom:6 }}>Conflict override required for activation</div>
            <div style={{ display:"grid", gap:8 }}>
              <input
                style={ss.in}
                placeholder="Override reason (required)"
                value={form.conflictWarnOverride?.reason || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    conflictWarnOverride: {
                      ...(f.conflictWarnOverride || {}),
                      reason: e.target.value,
                    },
                  }))
                }
              />
              <input
                style={ss.in}
                placeholder="Approver name/role (required)"
                value={form.conflictWarnOverride?.approvedBy || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    conflictWarnOverride: {
                      ...(f.conflictWarnOverride || {}),
                      approvedBy: e.target.value,
                    },
                  }))
                }
              />
            </div>
          </div>
        ) : null}
        {isFeatureEnabled("smart_copilot_v1") && permitCopilotHints.length > 0 ? (
          <div style={{ marginBottom:12, fontSize:12, color:"#0C447C", background:"#E6F1FB", border:"1px solid #cfe3f8", borderRadius:8, padding:"8px 10px" }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Permit Copilot suggestions</div>
            <ul style={{ margin:0, paddingLeft:18 }}>
              {permitCopilotHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!canIssue && (
          <div style={{ marginTop:10, fontSize:12, color:"#633806", background:"#FAEEDA", border:"1px solid #f6d89f", borderRadius:8, padding:"8px 10px" }}>
            Complete missing items below to issue permit. Click any quick fix to jump to the right step.
            {issueFixes.length > 0 ? (
              <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
                {issueFixes.slice(0, 6).map((fix) => (
                  <button key={fix.id} type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={() => setWizardStep(fix.step)}>
                    Fix: {fix.label}
                  </button>
                ))}
              </div>
            ) : null}
            {quality.failed.length > 0 && (
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {quality.failed.map((item) => (
                  <li key={item.id}>{item.message}</li>
                ))}
              </ul>
            )}
            {compliance.hardStops.length > 0 && (
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {compliance.hardStops.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {advancedRules.hardStops.length > 0 && (
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {advancedRules.hardStops.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {dynamicReq.missingRequired.length > 0 && (
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {dynamicReq.missingRequired.map((field) => (
                  <li key={field}>Dynamic required: {field}</li>
                ))}
              </ul>
            )}
            {!allowSignLater && missingSignatureRoles.length > 0 && (
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {missingSignatureRoles.map((role) => (
                  <li key={role}>Missing signature: {role.replace(/_/g, " ")}</li>
                ))}
              </ul>
            )}
            {allowSignLater && missingSignatureRoles.length > 0 ? (
              <div style={{ marginTop:6, color:"#0C447C" }}>
                Signature follow-up pending ({missingSignatureRoles.length}). Permit can still be issued now.
              </div>
            ) : null}
          </div>
        )}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"space-between" }}>
          <button type="button" onClick={tryClose} style={ss.btn}>Cancel</button>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            <button
              type="button"
              onClick={() => {
                const draft = buildPermitPayload("draft");
                saveFormPrefs(draft);
                trackEvent("permit_saved_draft", { permitType: type });
                onSave(draft);
              }}
              style={ss.btn}
            >
              Save as draft
            </button>
            <button type="button" onClick={()=>previewPermit(buildPermitPayload(form.status || "draft"))} style={ss.btn}>Preview in new tab</button>
            <button
              type="button"
              onClick={() => {
                if (!canIssue) return;
                const pr = {
                  ...buildPermitPayload("ready_for_review"),
                  integrationQueue: [
                    queueIntegrationEvent(form, "webhook", { event: "permit_ready_for_review" }),
                    ...(form.integrationQueue || []),
                  ],
                };
                saveFormPrefs(pr);
                trackEvent("permit_submitted_review", { permitType: type });
                onSave(pr);
              }}
              style={{ ...ss.btn, opacity: canIssue ? 1 : 0.45 }}
              disabled={!canIssue}
            >
              Submit for review
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activateGate.allowed) {
                  window.alert(activateGate.message || "Cannot issue this permit.");
                  return;
                }
                const active = buildPermitPayload("active");
                const withOverride =
                  conflictEvaluation.outcome === "warn"
                    ? {
                        ...active,
                        conflictWarnOverride: {
                          ...(active.conflictWarnOverride || {}),
                          approvedAt: new Date().toISOString(),
                        },
                      }
                    : active;
                saveFormPrefs(withOverride);
                trackEvent("permit_issued", { permitType: type, legalReady });
                onSave({
                  ...withOverride,
                  integrationQueue: [
                    queueIntegrationEvent(form, "calendar", { event: "permit_expiry_reminder" }),
                    queueIntegrationEvent(form, "webhook", { event: "permit_issued" }),
                    ...(form.integrationQueue || []),
                  ],
                });
              }}
              style={{ ...ss.btnO, opacity: canIssue ? 1 : 0.6, cursor: canIssue ? "pointer" : "not-allowed" }}
              disabled={!canIssue}
              title={canIssue ? "Issue permit" : "Complete required fields and valid time range to issue"}
            >
              Issue permit
            </button>
            <button type="button" onClick={()=>exportPermitPdf(buildPermitPayload(form.status || "draft"))} style={ss.btnO}>Export PDF</button>
          </div>
        </div>
        </>
        )}
    </PermitBuilder>
  );
}

// ─── Permit card ──────────────────────────────────────────────────────────────
function PermitCard({
  permit,
  onEdit,
  onClose,
  onReopen,
  onDelete,
  onPreview,
  onPrint,
  onApprove,
  onActivate,
  onSuspend,
  onResume,
  onExtendRevalidate,
  onNotify,
  onShareAckLink,
  onAcknowledge,
  onConfirmBriefing,
  simopsConflicts = [],
  highlight,
  compact = false,
  onLoadCloudAudit,
  selectable = false,
  selected = false,
  onToggleSelect,
  incidents = [],
  onReportIncident,
  conflictMatrix = PERMIT_CONFLICT_MATRIX,
  ultraCompact = false,
  permitTypes = PERMIT_TYPES,
  handoverState = null,
  activationHandoverRequirement = null,
  activationDependencyResult = null,
  onOpenHandover,
  cardDensity = "comfort",
  onOpenMobileQuickActions,
}) {
  const def = permitTypes[permit.type] || permitTypes.general;
  const [expanded, setExpanded] = useState(false);
  const [cloudAuditRows, setCloudAuditRows] = useState([]);
  const [cloudAuditLoading, setCloudAuditLoading] = useState(false);
  const [cloudAuditError, setCloudAuditError] = useState("");
  const checklistItems = normalizeChecklistItems(permit.type || "general", permit, checklistStringsForType(permit.type || "general"));
  const checklistState = normalizeChecklistState(permit.checklist, checklistItems);
  const cardCompliance = useMemo(
    () =>
      evaluatePermitCompliance(permit, checklistItems, {
        profileOverride: permit?.complianceProfile || null,
      }),
    [permit, checklistItems]
  );
  const conflictEvaluation = useMemo(
    () => evaluatePermitTypeConflicts(permit, simopsConflicts, { permitTypes, matrix: conflictMatrix }),
    [permit, simopsConflicts, conflictMatrix, permitTypes]
  );
  const approveGate = evaluatePermitActionGate(permit, "approve", {});
  const activateGate = evaluatePermitActionGate(permit, "activate", {
    complianceResult: cardCompliance,
    conflictResult: conflictEvaluation,
    warnConflictOverride: permit.conflictWarnOverride,
    handoverRequirement: activationHandoverRequirement,
    dependencyResult: activationDependencyResult,
  });
  const nextActorHint = buildPermitNextActorHint(permit, cardCompliance, {
    conflictResult: conflictEvaluation,
    warnConflictOverride: permit.conflictWarnOverride,
    handoverRequirement: activationHandoverRequirement,
    dependencyResult: activationDependencyResult,
  });
  const checkedCount = checklistItems.filter((item) => checklistState[item.id]).length;
  const totalChecks = checklistItems.length;
  const endIso = permitEndIso(permit);
  const derived = derivePermitStatus(permit);
  const statusMeta = getPermitStatusMeta(derived);
  const workflowRail = permitWorkflowRail(derived);
  const permitRisk = computePermitRiskScore(permit, { simopsHits: simopsConflicts });
  const slaBadge = buildPermitSlaBadge(permit, derived);
  const issueDrift = diffPermitVsIssueSnapshot(permit);
  const latestHandover = latestCompletedHandover(permit?.handoverLog || []);
  const density = ["comfort", "compact", "ops"].includes(cardDensity) ? cardDensity : "comfort";
  const activeDurationMs = permit.startDateTime ? Date.now() - new Date(permit.startDateTime).getTime() : 0;
  const briefingPending = derived === "active" && !permit.briefingConfirmedAt && activeDurationMs > 20 * 60 * 1000;
  const ramsMissing = derived === "active" && !String(permit.linkedRamsId || "").trim();
  const headerFontSize = density === "ops" ? 13 : 14;
  const metaFontSize = density === "ops" ? 11 : 12;
  const showDescription = density !== "ops";
  const showWorkflowRail = density !== "ops";
  const compactActionBtnStyle = compact
    ? {
        width: "100%",
        textAlign: "center",
        minHeight: 38,
        padding: "6px 8px",
        lineHeight: 1.2,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }
    : {};
  const decisionBanner = (() => {
    if (derived === "pending_review" && !approveGate.allowed) {
      return { tone: "warn", title: "Review blocked", text: approveGate.message || "Issuer signature required before approval.", cta: "Collect signature" };
    }
    if ((derived === "approved" || derived === "closed") && !activateGate.allowed) {
      return { tone: "critical", title: "Cannot activate now", text: activateGate.message || "Activation blocked.", cta: "Resolve blockers" };
    }
    if (derived === "active" && slaBadge?.label?.toLowerCase().includes("overdue")) {
      return { tone: "critical", title: "Attention needed", text: "Permit is running beyond target window. Review closure/revalidation now.", cta: "Review permit" };
    }
    if (derived === "active" && handoverState?.required && handoverState?.missing) {
      return { tone: "warn", title: "Handover required", text: "Shift handover is missing. Capture outgoing/incoming acknowledgement now.", cta: "Record handover" };
    }
    if (briefingPending) {
      return { tone: "warn", title: "Briefing confirmation missing", text: "Permit is active but site briefing has not been confirmed yet.", cta: "Confirm briefing" };
    }
    if (ramsMissing) {
      return { tone: "info", title: "RAMS link recommended", text: "Active permit has no linked RAMS document for field traceability.", cta: "Open permit" };
    }
    if ((derived === "approved" || derived === "closed") && activateGate.allowed) {
      return { tone: "ok", title: "Ready to activate", text: "All required checks are complete and activation can proceed now.", cta: "Activate" };
    }
    if (nextActorHint) {
      return { tone: "info", title: "Next best action", text: nextActorHint, cta: "Open permit" };
    }
    return { tone: "ok", title: "Healthy state", text: "No immediate blockers detected for this permit.", cta: "Continue monitoring" };
  })();

  return (
    <div
      id={`permit-row-${permit.id}`}
      className="app-surface-card"
      style={{
        ...ss.card,
        marginBottom:10,
        borderLeft:`3px solid ${def.color}`,
        boxShadow: highlight ? "0 0 0 2px #0d9488, 0 4px 12px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
    >
      <div
        style={{
          display:"grid",
          gridTemplateColumns: compact ? (selectable ? "24px minmax(0,1fr)" : "minmax(0,1fr)") : (selectable ? "24px 36px minmax(0,1fr) auto" : "36px minmax(0,1fr) auto"),
          gap:12,
          alignItems:"flex-start",
        }}
      >
        {selectable ? (
          <div style={{ paddingTop: 4 }}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(permit.id)}
              aria-label={`Select permit ${permit.id}`}
              style={{ width:16, height:16, accentColor:"#0d9488", cursor:"pointer" }}
            />
          </div>
        ) : null}
        {/* icon */}
        <div style={{ width:36, height:36, borderRadius:8, background:def.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={def.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d={def.icon}/>
          </svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
            <span style={{ fontWeight:600, fontSize:headerFontSize, overflowWrap:"anywhere" }}>{def.label}</span>
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:statusMeta.bg, color:statusMeta.color, display:"inline-flex", alignItems:"center", gap:6 }}>
              <span aria-hidden>{statusMeta.icon}</span>
              {statusMeta.label}
            </span>
            {simopsConflicts.length > 0 && (
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"#FCEBEB", color:"#791F1F" }} title="Overlapping permits at this location">
                SIMOPS ×{simopsConflicts.length}
              </span>
            )}
            {conflictEvaluation.outcome !== "allow" && (
              <span
                style={{
                  padding:"2px 8px",
                  borderRadius:20,
                  fontSize:11,
                  fontWeight:600,
                  background: conflictEvaluation.outcome === "block" ? "#FCEBEB" : "#FFFBEB",
                  color: conflictEvaluation.outcome === "block" ? "#791F1F" : "#854d0e",
                }}
              >
                {conflictEvaluation.outcome === "block" ? "Conflict: blocked" : "Conflict: warn"}
              </span>
            )}
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background: permitRisk.level === "high" ? "#FCEBEB" : permitRisk.level === "medium" ? "#FAEEDA" : "#EAF3DE", color: permitRisk.level === "high" ? "#791F1F" : permitRisk.level === "medium" ? "#633806" : "#27500A" }}>
              Risk {permitRisk.score}
            </span>
            {slaBadge && (
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:slaBadge.bg, color:slaBadge.color }}>
                {slaBadge.label}
              </span>
            )}
            {derived === "active" && endIso && (
              <Countdown expiresAt={endIso} />
            )}
            {derived === "active" && handoverState?.required && handoverState?.missing ? (
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"#FFFBEB", color:"#854d0e", border:"1px solid #fde68a" }}>
                Handover due
              </span>
            ) : null}
            {briefingPending ? (
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"#FFFBEB", color:"#854d0e", border:"1px solid #fde68a" }}>
                Briefing pending
              </span>
            ) : null}
            {ramsMissing ? (
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"var(--permit-info-bg)", color:"var(--permit-info-fg)", border:"1px solid var(--permit-info-border)" }}>
                RAMS missing
              </span>
            ) : null}
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:6, minHeight: showWorkflowRail ? undefined : 0 }}>
            {showWorkflowRail ? workflowRail.map((node, idx) => (
              <div key={`${permit.id}-${node.step}`} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span
                  title={permitStepLabel(node.step)}
                  style={{
                    width:10,
                    height:10,
                    borderRadius:"50%",
                    background: node.current ? "#0d9488" : node.done ? "#6b7280" : "#d1d5db",
                    boxShadow: node.current ? "0 0 0 3px rgba(13,148,136,0.18)" : "none",
                  }}
                />
                {idx < workflowRail.length - 1 ? (
                  <span style={{ width:18, height:2, background: node.done ? "#94a3b8" : "#e5e7eb", display:"inline-block" }} />
                ) : null}
              </div>
            )) : null}
          </div>
          <div style={{ fontSize:metaFontSize, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap", overflowWrap:"anywhere" }}>
            {permit.location && <span style={{ overflowWrap:"anywhere" }}>{permit.location}</span>}
            {permit.issuedTo && <span style={{ overflowWrap:"anywhere" }}>To: {permit.issuedTo}</span>}
            <span style={{ overflowWrap:"anywhere" }}>Valid: {fmtDateTime(permit.startDateTime)} → {fmtDateTime(endIso)}</span>
          </div>
          {showDescription && permit.description && (
            <div style={{ fontSize:metaFontSize, color:"var(--color-text-secondary)", marginTop:4, fontStyle:"italic", overflowWrap:"anywhere" }}>
              {permit.description.slice(0,100)}{permit.description.length>100?"…":""}
            </div>
          )}
          {issueDrift.drift && issueDrift.hasSnapshot && (
            <div style={{ marginTop:8, fontSize:11, padding:"6px 8px", borderRadius:6, background:"#FFF7ED", border:"1px solid #fed7aa", color:"#9a3412", lineHeight:1.4 }}>
              <strong>Changed since activation:</strong> {issueDrift.changedFields.join(", ")}
            </div>
          )}
          {decisionBanner ? (
            <div
              style={{
                marginTop:8,
                fontSize:11,
                padding:"7px 9px",
                borderRadius:8,
                background: permitDecisionTone(decisionBanner.tone).bg,
                border: `1px solid ${permitDecisionTone(decisionBanner.tone).border}`,
                color: permitDecisionTone(decisionBanner.tone).color,
                lineHeight:1.4,
                overflowWrap:"anywhere",
                display:"flex",
                justifyContent:"space-between",
                gap:8,
                alignItems:"center",
                flexWrap:"wrap",
                transition:"all 160ms ease",
              }}
            >
              <div style={{ minWidth:0 }}>
                <strong>{decisionBanner.title}:</strong> {decisionBanner.text}
              </div>
              {(decisionBanner.tone === "warn" || decisionBanner.tone === "critical" || decisionBanner.tone === "ok") ? (
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize:11, padding:"3px 8px", minHeight:30 }}
                  onClick={() => {
                    if (decisionBanner.tone === "warn" && handoverState?.required && handoverState?.missing) return onOpenHandover?.(permit);
                    if (decisionBanner.tone === "warn" && briefingPending) return onConfirmBriefing?.(permit.id);
                    if (decisionBanner.tone === "ok" && (derived === "approved" || derived === "closed")) return onActivate?.(permit.id);
                    if (decisionBanner.tone === "critical" || decisionBanner.tone === "warn") return onEdit?.(permit);
                    return onPreview?.(permit);
                  }}
                >
                  {decisionBanner.cta}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: compact ? "grid" : "flex",
            gridTemplateColumns: compact ? "repeat(2,minmax(0,1fr))" : undefined,
            flexWrap: compact ? undefined : "wrap",
            gap:6,
            flexShrink:0,
            justifyContent: compact ? "flex-start" : "flex-end",
            gridColumn: compact ? "1 / -1" : "auto",
            width: compact ? "100%" : "auto",
          }}
        >
          {compact ? (
            <button type="button" onClick={() => onOpenMobileQuickActions?.(permit)} style={{ ...ss.btnO, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
              Quick actions
            </button>
          ) : null}
          <button onClick={()=>setExpanded(v=>!v)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
            {expanded?"▲":"▼"}
          </button>
          <button onClick={()=>onPreview(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>{ultraCompact ? "View" : "Preview"}</button>
          <button onClick={()=>onPrint(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>{ultraCompact ? "PDF" : "Export PDF"}</button>
          {onNotify ? <button onClick={()=>onNotify(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>{ultraCompact ? "Notify" : "Notify team"}</button> : null}
          {onShareAckLink ? <button onClick={()=>onShareAckLink(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>{ultraCompact ? "Read/Sign" : "Read/Sign link"}</button> : null}
          {onAcknowledge ? <button onClick={()=>onAcknowledge(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>{ultraCompact ? "Ack" : "Acknowledge"}</button> : null}
          {onReportIncident ? (
            <button onClick={() => onReportIncident(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
              {ultraCompact ? "Incident" : "Report incident"}{incidents.length ? ` (${incidents.length})` : ""}
            </button>
          ) : null}
          <button onClick={()=>onEdit(permit)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12, ...compactActionBtnStyle }}>Edit</button>
          {(permit.status==="pending_review" || permit.status==="ready_for_review") && (
            <>
              <button type="button" onClick={()=>onApprove?.(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>Approve</button>
              <button type="button" onClick={()=>onActivate?.(permit.id)} style={{ ...ss.btnO, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>{ultraCompact ? "Approve+Go" : "Approve & activate"}</button>
            </>
          )}
          {permit.status==="approved" && (
            <button type="button" onClick={()=>onActivate?.(permit.id)} style={{ ...ss.btnO, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>Activate</button>
          )}
          {derived === "active" && (
            <button type="button" onClick={() => onOpenHandover?.(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
              {ultraCompact ? "Handover" : "Shift handover"}
            </button>
          )}
          {briefingPending && onConfirmBriefing ? (
            <button type="button" onClick={() => onConfirmBriefing(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
              {ultraCompact ? "Briefing ✓" : "Confirm briefing"}
            </button>
          ) : null}
          {derived === "active" && (
            <button type="button" onClick={() => onSuspend?.(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
              Suspend
            </button>
          )}
          {permit.status === "suspended" && (
            <button type="button" onClick={() => onResume?.(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, ...compactActionBtnStyle }}>
              Resume
            </button>
          )}
          {derived === "active" && (
            <button onClick={()=>onClose(permit.id)} style={{ ...ss.btnR, padding:"4px 10px", fontSize:12, ...compactActionBtnStyle }}>Close</button>
          )}
          {(derived==="closed"||derived==="expired") && (
            <button onClick={()=>onReopen(permit.id)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12, ...compactActionBtnStyle }}>Reopen</button>
          )}
          <button onClick={()=>onDelete(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595", ...compactActionBtnStyle }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          {simopsConflicts.length > 0 && (
            <div style={{ marginBottom:12, fontSize:12, padding:"8px 10px", borderRadius:8, background:"#FCEBEB", border:"1px solid #f5c7c7", color:"#791F1F" }}>
              <strong>SIMOPS / overlap at this location:</strong>
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {simopsConflicts.slice(0, 8).map((p) => (
                  <li key={p.id}>{(permitTypes[p.type] || permitTypes.general).label} · {fmtDateTime(p.startDateTime)} → {fmtDateTime(permitEndIso(p))}</li>
                ))}
              </ul>
            </div>
          )}
          {/* checklist */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:6 }}>
              Checklist: {checkedCount}/{totalChecks} items confirmed
            </div>
            {checklistItems.map((item)=>(
              <div key={item.id} style={{ display:"flex", gap:8, fontSize:12, padding:"4px 0", borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", alignItems:"flex-start" }}>
                <div style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${checklistState[item.id]?"#1D9E75":"var(--color-border-secondary,#ccc)"}`, background:checklistState[item.id]?"#1D9E75":"transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {checklistState[item.id] && <svg width={8} height={8} viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth={1.5} fill="none"/></svg>}
                </div>
                <span style={{ color:checklistState[item.id]?"var(--color-text-primary)":"var(--color-text-secondary)" }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* extra fields */}
          {Object.entries(permit.extraFields||{}).filter(([,v])=>v).length>0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8, marginBottom:12 }}>
              {(def.extraFields||[]).filter(f=>permit.extraFields?.[f.key]).map(f=>(
                <div key={f.key} style={{ background:"var(--color-background-secondary,#f7f7f5)", padding:"6px 8px", borderRadius:6 }}>
                  <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{f.label}</div>
                  <div style={{ fontSize:12, fontWeight:500 }}>{permit.extraFields[f.key]}</div>
                </div>
              ))}
            </div>
          )}

          {permit.notes && (
            <div style={{ padding:"6px 10px", background:"#FAEEDA", borderRadius:6, fontSize:12, color:"#633806" }}>
              Conditions: {permit.notes}
            </div>
          )}
          {latestHandover ? (
            <div style={{ marginTop:10, padding:"8px 10px", borderRadius:6, background:"#EEF7FF", border:"1px solid #bfdbfe", color:"#1e3a8a", fontSize:12 }}>
              <strong>Latest handover:</strong> {fmtDateTime(latestHandover.submittedAt)} · {latestHandover.outgoingSupervisor || "Outgoing"} → {latestHandover.incomingSupervisor || "Incoming"}
            </div>
          ) : null}

          {derived === "closed" && permit.lessonsLearned && (
            <div style={{ marginTop:10, padding:"8px 10px", background:"#E8F4FC", borderRadius:6, fontSize:12, color:"#0C447C", border:"1px solid #cfe3f8" }}>
              <strong>Lessons learned:</strong> {permit.lessonsLearned}
            </div>
          )}

          <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={() => onExtendRevalidate?.(permit.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
              Extend + revalidate
            </button>
            <span style={{ ...ss.chip, fontSize:11 }}>
              Revalidations: {Array.isArray(permit.revalidationLog) ? permit.revalidationLog.length : 0}
            </span>
          </div>

          {(permit.evidencePhotoUrl || permit.evidencePhotoStoragePath) && (
            <PermitEvidenceImage storagePath={permit.evidencePhotoStoragePath} srcUrl={permit.evidencePhotoUrl} />
          )}

          {Array.isArray(permit.auditLog) && permit.auditLog.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>Change log</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                {[...permit.auditLog].slice(-12).reverse().map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    {fmtDateTime(e.at)} —{" "}
                    {e.action === "status_changed"
                      ? `Status: ${e.from || "—"} → ${e.to || "—"}`
                      : e.action === "created"
                        ? "Created"
                        : e.action === "updated"
                          ? "Updated"
                          : e.action === "conflict_warn_override"
                            ? `Conflict override (${e.approvedBy || "approver"})`
                          : e.action === "handover_submitted"
                            ? `Handover submitted (${e.outgoingSupervisor || "outgoing"} -> ${e.incomingSupervisor || "incoming"})`
                          : e.action === "handover_ack_outgoing"
                            ? `Outgoing acknowledged (${e.by || "outgoing supervisor"})`
                          : e.action === "handover_ack_incoming"
                            ? `Incoming acknowledged (${e.by || "incoming supervisor"})`
                          : e.action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(permit.notificationLog) && permit.notificationLog.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>Delivery log</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                {[...permit.notificationLog].slice(-8).reverse().map((e, i) => (
                  <li key={`${e.at || "n"}-${i}`}>
                    {fmtDateTime(e.at)} — {e.channel || "email"} · {e.status || "sent"}
                    {e.recipientCount ? ` · ${e.recipientCount} recipient(s)` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(permit.acknowledgements) && permit.acknowledgements.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>Acknowledgements</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                {[...permit.acknowledgements].slice(-10).reverse().map((e, i) => (
                  <li key={`${e.at || "ack"}-${i}`}>
                    {fmtDateTime(e.at)} — {e.by || "Unknown"}{e.note ? ` · ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incidents.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>
                Linked incidents ({incidents.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                {incidents.slice(-8).reverse().map((i) => (
                  <li key={i.id}>
                    {fmtDateTime(i.createdAt)} — {i.severity || "incident"} · {i.title || "Incident"}
                    {(i.correctiveActions || []).some((a) => a.status !== "closed") ? " · open actions" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onLoadCloudAudit && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <button
                  type="button"
                  onClick={async () => {
                    setCloudAuditLoading(true);
                    setCloudAuditError("");
                    try {
                      const rows = await onLoadCloudAudit(permit.id);
                      setCloudAuditRows(rows);
                    } catch (err) {
                      setCloudAuditError(err?.message || String(err));
                      setCloudAuditRows([]);
                    } finally {
                      setCloudAuditLoading(false);
                    }
                  }}
                  style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}
                >
                  Refresh cloud history
                </button>
                <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                  {cloudAuditRows.length ? `${cloudAuditRows.length} cloud entries` : "No cloud entries loaded"}
                </span>
              </div>
              {cloudAuditError ? (
                <div style={{ marginTop:6, fontSize:11, color:"#A32D2D" }}>{cloudAuditError}</div>
              ) : null}
              {cloudAuditLoading ? (
                <div style={{ marginTop:6, fontSize:11, color:"var(--color-text-secondary)" }}>Loading cloud history…</div>
              ) : null}
              {!cloudAuditLoading && cloudAuditRows.length > 0 ? (
                <ul style={{ margin:"6px 0 0", paddingLeft:16, lineHeight:1.5, fontSize:11, color:"var(--color-text-secondary)" }}>
                  {cloudAuditRows.map((row) => (
                    <li key={row.id}>
                      {fmtDateTime(row.occurred_at)} — {auditActionLabel(row)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function openPermitDocument(permit, { autoPrint = false } = {}) {
  const win = window.open("","_blank");
  if (!win) return;
  win.document.open();
  win.document.write(renderPermitDocumentHtml(permit));
  win.document.close();
  if (autoPrint) {
    const triggerPrint = () => {
      win.focus();
      setTimeout(() => win.print(), 180);
    };
    if (win.document.readyState === "complete") {
      triggerPrint();
    } else {
      win.onload = triggerPrint;
    }
  }
}

function previewPermit(permit) {
  openPermitDocument(permit, { autoPrint: false });
}

function exportPermitPdf(permit) {
  openPermitDocument(permit, { autoPrint: true });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PermitSystem() {
  const { role: appRole = "admin" } = useApp();
  const org = (() => {
    try {
      return JSON.parse(localStorage.getItem("mysafeops_org_settings") || "{}");
    } catch {
      return {};
    }
  })();
  const permitActorLabel = String(org.defaultLeadEngineer || "").trim() || `role:${appRole}`;
  const [permits, setPermits] = useState(()=>load("permits_v2",[]));
  const [modal, setModal] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterHandoverDue, setFilterHandoverDue] = useState(false);
  const [filterBlockedNow, setFilterBlockedNow] = useState(false);
  const [filterBriefingPending, setFilterBriefingPending] = useState(false);
  const [filterRamsMissing, setFilterRamsMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [permitThemeMode, setPermitThemeMode] = useState(() => {
    const raw = String(load(PERMIT_THEME_MODE_KEY, "auto") || "auto");
    return PERMIT_THEME_MODES.includes(raw) ? raw : "auto";
  });
  const [prefersDarkTheme, setPrefersDarkTheme] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false
  );
  const [savedViews, setSavedViews] = useState(() => load(PERMIT_SAVED_VIEWS_KEY, []));
  const [selectedPermitIds, setSelectedPermitIds] = useState({});
  const [viewMode, setViewMode] = useState("list");
  const [cardDensity, setCardDensity] = useState("comfort");
  const [listSkeleton, setListSkeleton] = useState(false);
  const [mobileQuickActionsPermitId, setMobileQuickActionsPermitId] = useState("");
  const [wallNow, setWallNow] = useState(() => new Date());
  const [wallFullscreen, setWallFullscreen] = useState(false);
  const [highlightPermitId, setHighlightPermitId] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditPermitId, setAuditPermitId] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditRows, setAuditRows] = useState([]);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditFromDate, setAuditFromDate] = useState("");
  const [auditToDate, setAuditToDate] = useState("");
  const [auditAutoRefresh, setAuditAutoRefresh] = useState(true);
  const [auditActions, setAuditActions] = useState([]);
  const [auditExportNotice, setAuditExportNotice] = useState("");
  const [auditServerExportBusy, setAuditServerExportBusy] = useState(false);
  const [incidents, setIncidents] = useState(() => listPermitIncidents());
  const [projectPlans, setProjectPlans] = useState(() => listProjectPlans());
  const [planProjectId, setPlanProjectId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [ackTokenParam, setAckTokenParam] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("permitAck") || "";
    } catch {
      return "";
    }
  });
  const [ackActorName, setAckActorName] = useState("");
  const [ackActorNote, setAckActorNote] = useState("");
  const [closePermitDialog, setClosePermitDialog] = useState(null);
  const [conflictOverrideDialog, setConflictOverrideDialog] = useState(null);
  const [handoverDialog, setHandoverDialog] = useState(null);
  const conflictOverrideResolverRef = useRef(null);
  const [conflictMatrixOverrides, setConflictMatrixOverrides] = useState(() => {
    const raw = load(PERMIT_CONFLICT_MATRIX_OVERRIDES_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  });
  const [permitTypeOverrides, setPermitTypeOverrides] = useState(() => {
    const raw = load(PERMIT_TYPE_OVERRIDES_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  });
  const [workflowPolicyOverrides, setWorkflowPolicyOverrides] = useState(() =>
    normalizeWorkflowPolicyOverrides(load(PERMIT_WORKFLOW_OVERRIDES_KEY, {}))
  );
  const [workflowRolePolicyOverrides, setWorkflowRolePolicyOverrides] = useState(() =>
    normalizeWorkflowRolePolicyOverrides(load(PERMIT_WORKFLOW_ROLE_OVERRIDES_KEY, {}))
  );
  const [dependencyRuleOverrides, setDependencyRuleOverrides] = useState(() =>
    normalizeDependencyRules(load(PERMIT_DEPENDENCY_RULE_OVERRIDES_KEY, {}))
  );
  const [permitFormDefaults, setPermitFormDefaults] = useState(() =>
    normalizePermitFormDefaults(load(PERMIT_FORM_DEFAULTS_KEY, DEFAULT_PERMIT_FORM_DEFAULTS))
  );
  const [permitFieldOverrides, setPermitFieldOverrides] = useState(() =>
    normalizePermitFieldOverrides(load(PERMIT_FORM_FIELD_OVERRIDES_KEY, {}))
  );
  const [conditionalRuleOverrides, setConditionalRuleOverrides] = useState(() =>
    normalizePermitConditionalRules(load(PERMIT_CONDITIONAL_RULES_KEY, []))
  );
  const [fieldEditorType, setFieldEditorType] = useState("_all");
  const [fieldEditorFilter, setFieldEditorFilter] = useState("");
  const [workflowEditorOpen, setWorkflowEditorOpen] = useState(false);
  const [workflowEditorText, setWorkflowEditorText] = useState(() =>
    JSON.stringify(normalizeWorkflowPolicyOverrides(load(PERMIT_WORKFLOW_OVERRIDES_KEY, {})), null, 2)
  );
  const [workflowEditorError, setWorkflowEditorError] = useState("");
  const [workflowRoleEditorOpen, setWorkflowRoleEditorOpen] = useState(false);
  const [workflowRoleEditorText, setWorkflowRoleEditorText] = useState(() =>
    JSON.stringify(normalizeWorkflowRolePolicyOverrides(load(PERMIT_WORKFLOW_ROLE_OVERRIDES_KEY, {})), null, 2)
  );
  const [workflowRoleEditorError, setWorkflowRoleEditorError] = useState("");
  const [dependencyEditorOpen, setDependencyEditorOpen] = useState(false);
  const [dependencyEditorText, setDependencyEditorText] = useState(() =>
    JSON.stringify(normalizeDependencyRules(load(PERMIT_DEPENDENCY_RULE_OVERRIDES_KEY, {})), null, 2)
  );
  const [dependencyEditorError, setDependencyEditorError] = useState("");
  const [dependencyEditorType, setDependencyEditorType] = useState("confined_space");
  const [shiftBoundaryHours, setShiftBoundaryHours] = useState(() =>
    normalizeShiftHours(load(PERMIT_SHIFT_BOUNDARY_HOURS_KEY, [6, 18]))
  );
  const [shiftBoundaryHoursDraft, setShiftBoundaryHoursDraft] = useState(() =>
    normalizeShiftHours(load(PERMIT_SHIFT_BOUNDARY_HOURS_KEY, [6, 18])).join(", ")
  );
  const [shiftBoundaryHoursError, setShiftBoundaryHoursError] = useState("");
  const [permitTypeEditorOpen, setPermitTypeEditorOpen] = useState(false);
  const [permitTypeEditorType, setPermitTypeEditorType] = useState("hot_work");
  const [permitTypeEditorDraft, setPermitTypeEditorDraft] = useState({ label: "", color: "", bg: "", description: "" });
  const [conflictMatrixEditorOpen, setConflictMatrixEditorOpen] = useState(false);
  const [conflictMatrixEditorText, setConflictMatrixEditorText] = useState(() =>
    JSON.stringify(load(PERMIT_CONFLICT_MATRIX_OVERRIDES_KEY, {}), null, 2)
  );
  const [conflictMatrixEditorError, setConflictMatrixEditorError] = useState("");
  const advancedViewsEnabled = isFeatureEnabled("permits_board_timeline");
  const liveWallEnabled = isFeatureEnabled("permits_live_wall_v1");
  const permitNotifyEnabled = isFeatureEnabled("permits_notifications_v1");
  const navHandledRef = useRef(false);
  const mirrorTimerRef = useRef(null);
  const workers = load("mysafeops_workers", []);
  const ramsDocs = load("rams_builder_docs", []);
  const ackPortalPermit = useMemo(
    () => (ackTokenParam ? permits.find((p) => String(p.ackToken || "") === String(ackTokenParam)) || null : null),
    [ackTokenParam, permits]
  );

  const isNarrow = viewportWidth < 820;
  const isTablet = viewportWidth < 1024;
  const isUltraNarrow = viewportWidth < 380;
  const effectiveConflictMatrix = useMemo(
    () => ({ ...PERMIT_CONFLICT_MATRIX, ...conflictMatrixOverrides }),
    [conflictMatrixOverrides]
  );
  const effectivePermitTypes = useMemo(
    () => mergePermitTypeOverrides(PERMIT_TYPES, permitTypeOverrides),
    [permitTypeOverrides]
  );
  const effectiveWorkflowPolicy = useMemo(
    () => mergeWorkflowPolicy(workflowPolicyOverrides),
    [workflowPolicyOverrides]
  );
  const effectiveWorkflowRolePolicy = useMemo(
    () => mergeWorkflowRolePolicy(workflowRolePolicyOverrides),
    [workflowRolePolicyOverrides]
  );
  const effectiveDependencyRules = useMemo(
    () => mergeDependencyRules(dependencyRuleOverrides),
    [dependencyRuleOverrides]
  );
  const activeFieldConfig = useMemo(
    () => resolvePermitFieldConfig(fieldEditorType === "_all" ? "general" : fieldEditorType, permitFieldOverrides),
    [fieldEditorType, permitFieldOverrides]
  );
  const permitThemeVars = useMemo(
    () => resolvePermitThemeVars(permitThemeMode, prefersDarkTheme),
    [permitThemeMode, prefersDarkTheme]
  );

  useEffect(()=>{ save("permits_v2",permits); },[permits]);
  useEffect(()=>{ save(PERMIT_SAVED_VIEWS_KEY, savedViews); },[savedViews]);
  useEffect(() => { save(PERMIT_CONFLICT_MATRIX_OVERRIDES_KEY, conflictMatrixOverrides); }, [conflictMatrixOverrides]);
  useEffect(() => { save(PERMIT_TYPE_OVERRIDES_KEY, permitTypeOverrides); }, [permitTypeOverrides]);
  useEffect(() => { save(PERMIT_WORKFLOW_OVERRIDES_KEY, workflowPolicyOverrides); }, [workflowPolicyOverrides]);
  useEffect(() => { save(PERMIT_WORKFLOW_ROLE_OVERRIDES_KEY, workflowRolePolicyOverrides); }, [workflowRolePolicyOverrides]);
  useEffect(() => { save(PERMIT_DEPENDENCY_RULE_OVERRIDES_KEY, dependencyRuleOverrides); }, [dependencyRuleOverrides]);
  useEffect(() => { save(PERMIT_FORM_DEFAULTS_KEY, permitFormDefaults); }, [permitFormDefaults]);
  useEffect(() => { save(PERMIT_FORM_FIELD_OVERRIDES_KEY, permitFieldOverrides); }, [permitFieldOverrides]);
  useEffect(() => { save(PERMIT_CONDITIONAL_RULES_KEY, conditionalRuleOverrides); }, [conditionalRuleOverrides]);
  useEffect(() => { save(PERMIT_SHIFT_BOUNDARY_HOURS_KEY, shiftBoundaryHours); }, [shiftBoundaryHours]);
  useEffect(() => { save(PERMIT_THEME_MODE_KEY, permitThemeMode); }, [permitThemeMode]);
  useEffect(() => {
    setShiftBoundaryHoursDraft(shiftBoundaryHours.join(", "));
  }, [shiftBoundaryHours]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => setPrefersDarkTheme(Boolean(event.matches));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const base = PERMIT_TYPES[permitTypeEditorType] || PERMIT_TYPES.general;
    const ov = permitTypeOverrides[permitTypeEditorType] || {};
    setPermitTypeEditorDraft({
      label: ov.label || base.label || "",
      color: ov.color || base.color || "",
      bg: ov.bg || base.bg || "",
      description: ov.description || base.description || "",
    });
  }, [permitTypeEditorType, permitTypeOverrides]);
  useEffect(() => { savePermitIncidents(incidents); }, [incidents]);
  useEffect(() => { saveProjectPlans(projectPlans); }, [projectPlans]);

  useEffect(() => {
    if (navHandledRef.current) return;
    navHandledRef.current = true;
    const t = consumeWorkspaceNavTarget();
    if (t?.viewId === "permits" && t.permitId) {
      setHighlightPermitId(t.permitId);
      setFilterStatus("");
      setFilterHandoverDue(false);
      setFilterBlockedNow(false);
      setSearch("");
      const id = t.permitId;
      requestAnimationFrame(() => {
        document.getElementById(`permit-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      const timer = setTimeout(() => setHighlightPermitId(null), 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
    mirrorTimerRef.current = setTimeout(() => {
      mirrorPermitsToSupabase(permits, getOrgId());
    }, 1500);
    return () => {
      if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
    };
  }, [permits]);

  useEffect(
    () => () => {
      if (typeof conflictOverrideResolverRef.current === "function") {
        conflictOverrideResolverRef.current(null);
      }
      conflictOverrideResolverRef.current = null;
    },
    []
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (conflictOverrideDialog) {
          e.preventDefault();
          closeConflictOverrideDialog(null);
          return;
        }
        if (handoverDialog) {
          e.preventDefault();
          setHandoverDialog(null);
          return;
        }
        if (closePermitDialog) {
          e.preventDefault();
          setClosePermitDialog(null);
        }
      }
      if (e.key === "Enter" && handoverDialog) {
        const targetTag = String(e.target?.tagName || "").toLowerCase();
        if (targetTag !== "textarea") {
          e.preventDefault();
          submitHandoverDialog();
        }
      }
      if (e.key === "Enter" && conflictOverrideDialog) {
        const targetTag = String(e.target?.tagName || "").toLowerCase();
        if (targetTag !== "textarea") {
          e.preventDefault();
          submitConflictOverrideDialog();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [conflictOverrideDialog, closePermitDialog, handoverDialog]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setListSkeleton(true);
    const t = setTimeout(() => setListSkeleton(false), 140);
    return () => clearTimeout(t);
  }, [search, filterType, filterStatus, filterHandoverDue, filterBlockedNow, filterBriefingPending, filterRamsMissing, viewMode]);

  useEffect(() => {
    const syncTokenFromUrl = () => {
      try {
        setAckTokenParam(new URLSearchParams(window.location.search).get("permitAck") || "");
      } catch {
        setAckTokenParam("");
      }
    };
    syncTokenFromUrl();
    window.addEventListener("popstate", syncTokenFromUrl);
    return () => window.removeEventListener("popstate", syncTokenFromUrl);
  }, []);

  useEffect(() => {
    if (viewMode !== "wall") return undefined;
    setWallNow(new Date());
    const t = setInterval(() => setWallNow(new Date()), 10000);
    return () => clearInterval(t);
  }, [viewMode]);

  useEffect(() => {
    const onFs = () => setWallFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const loadAuditRows = useCallback(async () => {
    if (!supabase) return;
    if (auditFromDate && auditToDate && auditFromDate > auditToDate) {
      setAuditError("From date cannot be later than To date.");
      setAuditRows([]);
      setAuditHasMore(false);
      return;
    }
    setAuditLoading(true);
    setAuditError("");
    try {
      const { rows, hasMore } = await fetchPermitAuditPage({
        orgSlug: getOrgId(),
        permitId: auditPermitId || undefined,
        page: auditPage,
        pageSize: AUDIT_PAGE_SIZE,
        fromDate: auditFromDate || undefined,
        toDate: auditToDate || undefined,
        actions: auditActions.length ? auditActions : undefined,
      });
      setAuditRows(rows);
      setAuditHasMore(hasMore);
    } catch (err) {
      setAuditError(err?.message || String(err));
      setAuditRows([]);
      setAuditHasMore(false);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPermitId, auditPage, auditFromDate, auditToDate, auditActions]);

  useEffect(() => {
    if (!auditOpen) return;
    void loadAuditRows();
  }, [auditOpen, loadAuditRows, permits]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditPermitId, auditFromDate, auditToDate, auditActions]);

  useEffect(() => {
    setAuditExportNotice("");
  }, [auditPermitId, auditFromDate, auditToDate, auditActions, auditPage]);

  useEffect(() => {
    if (!auditFromDate || !auditToDate) return;
    if (auditFromDate > auditToDate) {
      setAuditError("From date cannot be later than To date.");
    } else if (auditError === "From date cannot be later than To date.") {
      setAuditError("");
    }
  }, [auditFromDate, auditToDate, auditError]);

  useEffect(() => {
    if (!auditOpen || !auditAutoRefresh) return;
    const t = setInterval(() => {
      void loadAuditRows();
    }, 45000);
    return () => clearInterval(t);
  }, [auditOpen, auditAutoRefresh, loadAuditRows]);

  useEffect(() => {
    const processSlaQueue = () => {
      const nowTs = Date.now();
      setPermits((prev) => {
        let hasAnyChange = false;
        const next = prev.map((permit) => {
          const signals = collectSlaSignalsForPermit(permit, nowTs);
          if (signals.length === 0) return permit;
          const fired = { ...(permit.slaSignalsFired || {}) };
          const toApply = signals.filter((s) => !fired[s.key]);
          if (toApply.length === 0) return permit;
          hasAnyChange = true;
          const at = new Date(nowTs).toISOString();
          const notificationLog = [...(permit.notificationLog || [])];
          toApply.forEach((sig) => {
            fired[sig.key] = at;
            notificationLog.push({
              at,
              channel: "system",
              status: sig.status,
              recipientCount: 0,
              note: sig.note,
            });
          });
          const withSla = {
            ...permit,
            notificationLog,
            slaSignalsFired: fired,
          };
          const withLog = { ...withSla, auditLog: appendPermitAuditEntry(permit, withSla) };
          void logPermitAuditToSupabase(permit, withLog, getOrgId());
          return withLog;
        });
        return hasAnyChange ? next : prev;
      });
    };
    processSlaQueue();
    const t = setInterval(processSlaQueue, 60000);
    return () => clearInterval(t);
  }, []);

  const simopsMap = useMemo(() => buildSimopsConflictMap(permits), [permits]);
  const simopsRadarRows = useMemo(() => {
    return permits
      .map((p) => {
        const conflicts = simopsMap.get(p.id) || [];
        if (conflicts.length === 0) return null;
        const overlapTypes = Array.from(new Set(conflicts.map((c) => (effectivePermitTypes[c.type] || effectivePermitTypes.general).label)));
        const severity = conflicts.length >= 3 ? "high" : conflicts.length === 2 ? "medium" : "low";
        return {
          id: p.id,
          location: p.location || "Unknown location",
          permitLabel: (effectivePermitTypes[p.type] || effectivePermitTypes.general).label,
          overlapCount: conflicts.length,
          overlapTypes: overlapTypes.slice(0, 3),
          severity,
          windowLabel: `${fmtDateTime(p.startDateTime)} -> ${fmtDateTime(permitEndIso(p))}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.overlapCount - a.overlapCount)
      .slice(0, 10);
  }, [permits, simopsMap]);
  const permitScorecard = useMemo(() => {
    const reviewTargetMs = 4 * 60 * 60 * 1000;
    const activationTargetMs = 2 * 60 * 60 * 1000;
    const withApprovedAt = permits.filter((p) => p.approvedAt);
    const reviewedOnTime = withApprovedAt.filter((p) => {
      const start = new Date(p.createdAt || p.updatedAt || 0).getTime();
      const approved = new Date(p.approvedAt || 0).getTime();
      if (Number.isNaN(start) || Number.isNaN(approved)) return false;
      return approved - start <= reviewTargetMs;
    }).length;
    const withActivationWindow = permits.filter((p) => p.approvedAt && p.status === "active");
    const activatedOnTime = withActivationWindow.filter((p) => {
      const approved = new Date(p.approvedAt || 0).getTime();
      const activated = new Date(p.updatedAt || p.approvedAt || 0).getTime();
      if (Number.isNaN(approved) || Number.isNaN(activated)) return false;
      return activated - approved <= activationTargetMs;
    }).length;
    const nowTs = Date.now();
    const overdueQueue = permits.filter((p) => {
      const status = String(p.status || "");
      const baseTs = new Date(p.updatedAt || p.createdAt || nowTs).getTime();
      if (Number.isNaN(baseTs)) return false;
      if (status === "pending_review" || status === "ready_for_review") return nowTs > baseTs + reviewTargetMs;
      if (status === "approved") return nowTs > baseTs + activationTargetMs;
      return false;
    }).length;
    const reviewDurationsHours = withApprovedAt
      .map((p) => {
        const start = new Date(p.createdAt || p.updatedAt || 0).getTime();
        const approved = new Date(p.approvedAt || 0).getTime();
        if (Number.isNaN(start) || Number.isNaN(approved) || approved < start) return null;
        return (approved - start) / 3600000;
      })
      .filter((n) => Number.isFinite(n));
    const avgReviewHours = reviewDurationsHours.length
      ? Math.round((reviewDurationsHours.reduce((a, b) => a + b, 0) / reviewDurationsHours.length) * 10) / 10
      : null;
    return {
      reviewedOnTime,
      reviewedTotal: withApprovedAt.length,
      activatedOnTime,
      activatedTotal: withActivationWindow.length,
      overdueQueue,
      avgReviewHours,
    };
  }, [permits]);

  const savePermit = (p) => {
    setPermits((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      const normalized = normalizeAdvancedPermit(p, p.type || existing?.type || "hot_work");
      const auditLog = appendPermitAuditEntry(existing, normalized);
      let next = { ...normalized, auditLog };
      if (existing) {
        const history = Array.isArray(existing.versionHistory) ? existing.versionHistory : [];
        if (hasMaterialPermitChanges(existing, next)) {
          const reason =
            window.prompt(
              "Version note (why changed) — optional:",
              ""
            ) || "";
          const versionEntry = createPermitVersionEntry(existing, next, permitActorLabel, reason);
          if (versionEntry) {
            next = {
              ...next,
              versionHistory: [versionEntry, ...history].slice(0, 60),
              lastVersionNote: versionEntry.reason || "",
              updatedBy: permitActorLabel,
            };
          }
        } else {
          next = { ...next, versionHistory: history, updatedBy: permitActorLabel };
        }
      } else {
        next = { ...next, versionHistory: [], updatedBy: permitActorLabel };
      }
      void logPermitAuditToSupabase(existing, next, getOrgId());
      return existing ? prev.map((x) => (x.id === p.id ? next : x)) : [next, ...prev];
    });
    setModal(null);
  };

  const closePermit = (id, lessonsLearned) => {
    const target = permits.find((x) => x.id === id);
    if (!target) return;
    if (!ensureWorkflowRoleAllowed("closed", "close permit")) return;
    if (!ensureWorkflowTransitionAllowed(target, "closed", "close permit")) return;
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const ll = typeof lessonsLearned === "string" ? lessonsLearned.trim() : "";
        let next = { ...p, status: "closed", closedAt: new Date().toISOString() };
        if (ll) next = { ...next, lessonsLearned: ll };
        next = transitionPermitWorkflowWithPolicy(next, "closed", "manual_close");
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  };
  const requestClosePermit = (id) => setClosePermitDialog({ id, lessons: "" });
  const reopenPermit = (id) => {
    const target = permits.find((x) => x.id === id);
    if (!target) return;
    if (!ensureWorkflowRoleAllowed("issued", "reopen permit")) return;
    if (!ensureWorkflowTransitionAllowed(target, "issued", "reopen permit")) return;
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        let next = { ...p, status: "active", closedAt: undefined };
        next = transitionPermitWorkflowWithPolicy(next, "issued", "reopen");
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  };
  const now = new Date();
  const complianceForPermitGate = useCallback((p) => {
    const items = normalizeChecklistItems(p.type || "general", p, checklistStringsForType(p.type || "general"));
    return evaluatePermitCompliance(p, items);
  }, []);
  const conflictResultForPermitGate = useCallback((p, allPermits) => {
    const overlaps = findSimopsConflicts(
      {
        ...p,
        status: "active",
        endDateTime: p.endDateTime || p.expiryDate || "",
      },
      allPermits,
      { ignoreId: p.id }
    );
    return evaluatePermitTypeConflicts(p, overlaps, { permitTypes: effectivePermitTypes, matrix: effectiveConflictMatrix });
  }, [effectiveConflictMatrix, effectivePermitTypes]);
  const handoverStateForPermit = useCallback((p, nowRef = now) => {
    const derived = derivePermitStatus(p, nowRef);
    return evaluatePermitHandoverRequirement(p, nowRef, {
      derivedStatus: derived,
      shiftHours: shiftBoundaryHours,
    });
  }, [now, shiftBoundaryHours]);
  const handoverRequirementForActivation = useCallback((p, nowRef = now) => {
    return evaluatePermitHandoverRequirement(
      {
        ...p,
        status: "active",
        endDateTime: p.endDateTime || p.expiryDate || "",
      },
      nowRef,
      { derivedStatus: "active", shiftHours: shiftBoundaryHours }
    );
  }, [now, shiftBoundaryHours]);
  const activationGateForPermit = useCallback((p, allPermits, warnConflictOverride = p?.conflictWarnOverride || null, nowRef = now) => {
    const dependencyResult = evaluatePermitDependencies(p, allPermits, effectiveDependencyRules, { now: nowRef });
    return evaluatePermitActionGate(p, "activate", {
      complianceResult: complianceForPermitGate(p),
      conflictResult: conflictResultForPermitGate(p, allPermits),
      warnConflictOverride,
      handoverRequirement: handoverRequirementForActivation(p, nowRef),
      dependencyResult,
    });
  }, [now, complianceForPermitGate, conflictResultForPermitGate, handoverRequirementForActivation, effectiveDependencyRules]);
  const blockedNowForPermit = useCallback((p, allPermits, nowRef = now) => {
    const status = derivePermitStatus(p, nowRef);
    if (status === "pending_review" || status === "ready_for_review") {
      return !evaluatePermitActionGate(p, "approve", {}).allowed;
    }
    if (status === "approved" || status === "closed") {
      return !activationGateForPermit(p, allPermits, p?.conflictWarnOverride || null, nowRef).allowed;
    }
    return false;
  }, [now, activationGateForPermit]);
  const ensureWorkflowTransitionAllowed = useCallback((permit, targetState, actionLabel = "action") => {
    if (canPermitWorkflowTransition(permit, targetState, effectiveWorkflowPolicy)) return true;
    const from = permitCurrentWorkflowState(permit);
    window.alert(`Workflow policy blocks ${actionLabel}: ${from} -> ${targetState}. Update workflow policy overrides to allow this transition.`);
    return false;
  }, [effectiveWorkflowPolicy]);
  const ensureWorkflowRoleAllowed = useCallback((targetState, actionLabel = "action") => {
    if (isWorkflowRoleAllowed(targetState, appRole, effectiveWorkflowRolePolicy)) return true;
    const allowed = Array.isArray(effectiveWorkflowRolePolicy?.[String(targetState || "").toLowerCase()])
      ? effectiveWorkflowRolePolicy[String(targetState || "").toLowerCase()].join(", ")
      : "n/a";
    window.alert(`Role policy blocks ${actionLabel} for role "${appRole}". Allowed roles for ${targetState}: ${allowed}.`);
    return false;
  }, [appRole, effectiveWorkflowRolePolicy]);
  const requestWarnConflictOverride = useCallback((permit, conflicts = []) => {
    const base = permit?.conflictWarnOverride || {};
    return new Promise((resolve) => {
      conflictOverrideResolverRef.current = resolve;
      setConflictOverrideDialog({
        permitId: permit?.id || "",
        permitType: permit?.type || "general",
        permitLocation: permit?.location || "",
        reason: String(base.reason || ""),
        approvedBy: String(base.approvedBy || ""),
        conflicts: Array.isArray(conflicts) ? conflicts : [],
        error: "",
      });
    });
  }, []);

  const approvePermit = (id) =>
    setPermits((prev) => {
      const p = prev.find((x) => x.id === id);
      if (!p) return prev;
      if (!ensureWorkflowRoleAllowed("approved", "approve permit")) return prev;
      if (!canPermitWorkflowTransition(p, "approved", effectiveWorkflowPolicy)) {
        window.alert(`Workflow policy blocks approve: ${permitCurrentWorkflowState(p)} -> approved.`);
        return prev;
      }
      const gate = evaluatePermitActionGate(p, "approve", {});
      if (!gate.allowed) {
        window.alert(gate.message || "Cannot approve this permit.");
        return prev;
      }
      return prev.map((row) => {
        if (row.id !== id) return row;
        let next = { ...row, status: "approved", approvedAt: new Date().toISOString() };
        next = transitionPermitWorkflowWithPolicy(next, "approved", "manual_approve");
        const withLog = { ...next, auditLog: appendPermitAuditEntry(row, next) };
        void logPermitAuditToSupabase(row, withLog, getOrgId());
        return withLog;
      });
    });
  const activatePermit = async (id) => {
    const p = permits.find((x) => x.id === id);
    if (!p) return;
    if (!ensureWorkflowRoleAllowed("issued", "activate permit")) return;
    if (!ensureWorkflowTransitionAllowed(p, "issued", "activate permit")) return;
    const conflictResult = conflictResultForPermitGate(p, permits);
    let warnConflictOverride = p.conflictWarnOverride || null;
    let gate = activationGateForPermit(p, permits, warnConflictOverride, new Date());
    if (!gate.allowed && gate.code === "permit_conflict_warn") {
      warnConflictOverride = await requestWarnConflictOverride(p, gate.conflicts || []);
      if (!warnConflictOverride) return;
      gate = evaluatePermitActionGate(p, "activate", {
        complianceResult: complianceForPermitGate(p),
        conflictResult,
        warnConflictOverride,
        handoverRequirement: handoverRequirementForActivation(p, new Date()),
      });
    }
    if (!gate.allowed) {
      window.alert(gate.message || "Cannot activate this permit.");
      return;
    }
    setPermits((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        let next = { ...row, status: "active", closedAt: undefined, conflictWarnOverride: warnConflictOverride || null };
        if (!row.issueSnapshot) next = { ...next, issueSnapshot: buildIssueSnapshot(row) };
        next = transitionPermitWorkflowWithPolicy(next, "issued", "activate");
        const baseWithLog = { ...next, auditLog: appendPermitAuditEntry(row, next) };
        const withLog = warnConflictOverride
          ? {
              ...baseWithLog,
              auditLog: [
                ...(baseWithLog.auditLog || []),
                {
                  at: new Date().toISOString(),
                  action: "conflict_warn_override",
                  reason: warnConflictOverride.reason,
                  approvedBy: warnConflictOverride.approvedBy,
                },
              ].slice(-40),
            }
          : baseWithLog;
        void logPermitAuditToSupabase(row, withLog, getOrgId());
        if (warnConflictOverride) {
          const overrideAuditRow = {
            ...withLog,
            status: row.status,
            _auditAction: "conflict_warn_override",
          };
          void logPermitAuditToSupabase(row, overrideAuditRow, getOrgId());
        }
        return withLog;
      })
    );
  };
  const suspendPermit = (id) => {
    const target = permits.find((x) => x.id === id);
    if (!target) return;
    if (!ensureWorkflowRoleAllowed("suspended", "suspend permit")) return;
    if (!ensureWorkflowTransitionAllowed(target, "suspended", "suspend permit")) return;
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        let next = { ...p, status: "suspended" };
        next = transitionPermitWorkflowWithPolicy(next, "suspended", "manual_suspend");
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  };
  const resumePermit = (id) => {
    const target = permits.find((x) => x.id === id);
    if (!target) return;
    if (!ensureWorkflowRoleAllowed("issued", "resume permit")) return;
    if (!ensureWorkflowTransitionAllowed(target, "issued", "resume permit")) return;
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        let next = { ...p, status: "active" };
        next = transitionPermitWorkflowWithPolicy(next, "issued", "resume_after_suspend");
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  };
  const extendAndRevalidatePermit = (id) =>
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextEnd = window.prompt("New end date/time (ISO):", p.endDateTime || "");
        if (!nextEnd) return p;
        const baseline = buildRevalidationSnapshot(p);
        const next = { ...p, endDateTime: nextEnd, status: "active", revalidatedAt: new Date().toISOString() };
        const nextSnap = buildRevalidationSnapshot(next);
        const delta = diffRevalidationSnapshot(baseline, nextSnap);
        const withDelta = {
          ...next,
          revalidationLog: [{ at: new Date().toISOString(), delta, baseline, next: nextSnap }, ...(p.revalidationLog || [])].slice(0, 80),
        };
        const withLog = { ...withDelta, auditLog: appendPermitAuditEntry(p, withDelta) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  const deletePermit = (id) => {
    if (!confirm("Delete this permit?")) return;
    setPermits((prev) => {
      const victim = prev.find((p) => p.id === id);
      if (victim) {
        pushRecycleBinItem({
          moduleId: "permits",
          moduleLabel: "Permits",
          itemType: "permit",
          itemLabel: victim.description || victim.location || victim.id,
          sourceKey: "permits_v2",
          payload: victim,
        });
        void logPermitDeletedToSupabase(victim, getOrgId());
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const filtered = permits.filter(p=>{
    const endIso = permitEndIso(p);
    const endDate = endIso ? new Date(endIso) : null;
    if (filterType && p.type!==filterType) return false;
    if (filterStatus==="active" && (p.status!=="active" || !endDate || endDate < now)) return false;
    if (filterStatus==="expired" && !(p.status==="active" && endDate && endDate < now)) return false;
    if (filterStatus==="closed" && p.status!=="closed") return false;
    if (filterStatus==="draft" && p.status!=="draft") return false;
    if (filterStatus==="pending_review" && p.status!=="pending_review" && p.status!=="ready_for_review") return false;
    if (filterStatus==="approved" && p.status!=="approved") return false;
    if (filterStatus==="suspended" && p.status!=="suspended") return false;
    if (filterHandoverDue) {
      const hs = handoverStateForPermit(p, now);
      if (!(hs.required && hs.missing)) return false;
    }
    if (filterBlockedNow && !blockedNowForPermit(p, permits, now)) return false;
    if (filterBriefingPending) {
      const status = derivePermitStatus(p, now);
      if (status !== "active" || !p.startDateTime || p.briefingConfirmedAt) return false;
      const ageMs = now.getTime() - new Date(p.startDateTime).getTime();
      if (!(ageMs > 20 * 60 * 1000)) return false;
    }
    if (filterRamsMissing) {
      const status = derivePermitStatus(p, now);
      if (status !== "active" || String(p.linkedRamsId || "").trim()) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const typeLabel = (effectivePermitTypes[p.type] || effectivePermitTypes.general)?.label?.toLowerCase() || "";
      const hay = [p.location, p.description, p.issuedTo, p.issuedBy, p.type, typeLabel, p.id].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const mobileQuickPermit = permits.find((p) => p.id === mobileQuickActionsPermitId) || null;
  useEffect(() => {
    if (!mobileQuickActionsPermitId) return;
    if (!mobileQuickPermit) setMobileQuickActionsPermitId("");
  }, [mobileQuickActionsPermitId, mobileQuickPermit]);

  const stats = buildPermitWarRoomStats(permits, now);
  const selectedPermits = permits.filter((p) => selectedPermitIds[p.id]);
  const hasSelectedPermits = selectedPermits.length > 0;
  const selectedActivationSummary = useMemo(() => {
    let activatable = 0;
    let blocked = 0;
    let warn = 0;
    selectedPermits.forEach((p) => {
      if (!["approved", "closed"].includes(String(p.status || ""))) return;
      const gate = activationGateForPermit(p, permits, p.conflictWarnOverride, now);
      if (gate.allowed) activatable += 1;
      else if (gate.code === "permit_conflict_warn") warn += 1;
      else blocked += 1;
    });
    return { activatable, blocked, warn };
  }, [selectedPermits, permits, now, activationGateForPermit]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedPermitIds[p.id]);
  const commandCounts = useMemo(() => {
    const active = permits.filter((p) => derivePermitStatus(p, now) === "active").length;
    const review = permits.filter((p) => derivePermitStatus(p, now) === "pending_review").length;
    const approved = permits.filter((p) => derivePermitStatus(p, now) === "approved").length;
    const expired = permits.filter((p) => derivePermitStatus(p, now) === "expired").length;
    const handoverDue = permits.filter((p) => {
      const hs = handoverStateForPermit(p, now);
      return hs.required && hs.missing;
    }).length;
    const blockedNow = permits.filter((p) => blockedNowForPermit(p, permits, now)).length;
    const briefingPending = permits.filter((p) => {
      const status = derivePermitStatus(p, now);
      if (status !== "active" || !p.startDateTime || p.briefingConfirmedAt) return false;
      return now.getTime() - new Date(p.startDateTime).getTime() > 20 * 60 * 1000;
    }).length;
    const ramsMissing = permits.filter((p) => derivePermitStatus(p, now) === "active" && !String(p.linkedRamsId || "").trim()).length;
    return { active, review, approved, expired, handoverDue, blockedNow, briefingPending, ramsMissing };
  }, [permits, now, handoverStateForPermit, blockedNowForPermit]);
  const heatmapRows = permitsHeatmap(permits, effectivePermitTypes);
  const effectiveViewMode =
    viewMode === "wall"
      ? (liveWallEnabled ? "wall" : "list")
      : (advancedViewsEnabled ? viewMode : "list");
  const availableViewModes = [
    "list",
    ...(advancedViewsEnabled ? ["board", "timeline"] : []),
    ...(liveWallEnabled ? ["wall"] : []),
  ];
  const warRoomAlerts = permits
    .filter((p) => derivePermitStatus(p, now) === "expired" || (derivePermitStatus(p, now) === "active" && permitEndIso(p) && (new Date(permitEndIso(p)) - now) < 3600000))
    .slice(0, 8);
  const opsActionItems = useMemo(() => {
    const list = [];
    const push = (item) => {
      if (!item?.permitId) return;
      const key = `${item.kind}:${item.permitId}`;
      if (list.some((x) => `${x.kind}:${x.permitId}` === key)) return;
      list.push(item);
    };
    permits.forEach((p) => {
      const status = derivePermitStatus(p, now);
      const endIso = permitEndIso(p);
      const msToEnd = endIso ? new Date(endIso).getTime() - now.getTime() : null;
      if ((status === "pending_review" || status === "ready_for_review" || status === "approved" || status === "closed") && blockedNowForPermit(p, permits, now)) {
        push({
          kind: "gate_blocked",
          severity: "warning",
          permitId: p.id,
          title: "Permit blocked by gate checks",
          detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · ${p.location || "Unknown location"}`,
        });
      }
      if (status === "expired") {
        push({
          kind: "expired",
          severity: "critical",
          permitId: p.id,
          title: "Expired permit requires closure/reissue",
          detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · ${p.location || "Unknown location"}`,
        });
      } else if (status === "active" && msToEnd != null && msToEnd < 90 * 60 * 1000) {
        push({
          kind: "expiring",
          severity: msToEnd < 30 * 60 * 1000 ? "critical" : "warning",
          permitId: p.id,
          title: "Active permit expiring soon",
          detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · ${p.location || "Unknown location"}`,
        });
      } else if (status === "pending_review") {
        push({
          kind: "review",
          severity: "warning",
          permitId: p.id,
          title: "Permit awaiting review/approval",
          detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · ${p.location || "Unknown location"}`,
        });
      }
      const lastDelivery = Array.isArray(p.notificationLog) ? p.notificationLog[p.notificationLog.length - 1] : null;
      if (lastDelivery?.status === "failed") {
        push({
          kind: "delivery_failed",
          severity: "warning",
          permitId: p.id,
          title: "Notification delivery failed",
          detail: String(lastDelivery.note || "Retry email notification"),
        });
      }
      if (!String(p.issuedTo || "").trim() || !String(p.issuedBy || "").trim()) {
        if (status === "active" || status === "pending_review" || status === "approved") {
          push({
            kind: "people_missing",
            severity: "info",
            permitId: p.id,
            title: "Missing issuer/holder details",
            detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · complete people fields`,
          });
        }
      }
      if (status === "active") {
        const hasAck = Array.isArray(p.acknowledgements) && p.acknowledgements.length > 0;
        const ageMs = p.startDateTime ? now.getTime() - new Date(p.startDateTime).getTime() : 0;
        const handoverState = handoverStateForPermit(p, now);
        if (!hasAck && ageMs > 30 * 60 * 1000) {
          push({
            kind: "ack_missing",
            severity: "warning",
            permitId: p.id,
            title: "Active permit without acknowledgement",
            detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · ${p.location || "Unknown location"}`,
          });
        }
        if (handoverState.required && handoverState.missing) {
          push({
            kind: "handover_missing",
            severity: "warning",
            permitId: p.id,
            title: "Shift handover required",
            detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · ${p.location || "Unknown location"}`,
          });
        }
        if (!p.briefingConfirmedAt && ageMs > 20 * 60 * 1000) {
          push({
            kind: "briefing_missing",
            severity: "warning",
            permitId: p.id,
            title: "Site briefing confirmation missing",
            detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · confirm briefing`,
          });
        }
        if (!String(p.linkedRamsId || "").trim()) {
          push({
            kind: "rams_missing",
            severity: "info",
            permitId: p.id,
            title: "Active permit without linked RAMS",
            detail: `${(effectivePermitTypes[p.type] || effectivePermitTypes.general).label} · link RAMS document`,
          });
        }
      }
    });
    const rank = { critical: 0, warning: 1, info: 2 };
    return list
      .sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3))
      .slice(0, 14);
  }, [permits, now, effectivePermitTypes, handoverStateForPermit, blockedNowForPermit]);
  const incidentsByPermit = useMemo(() => {
    const map = new Map();
    incidents.forEach((i) => {
      if (!i?.permitId) return;
      if (!map.has(i.permitId)) map.set(i.permitId, []);
      map.get(i.permitId).push(i);
    });
    return map;
  }, [incidents]);
  const slaQueue = useMemo(() => buildPermitSlaQueue(permits, incidents, now), [permits, incidents, now]);
  const riskInsights = useMemo(() => buildPermitRiskInsights(permits, incidents, now), [permits, incidents, now]);
  const integrationAdapters = useMemo(() => buildIntegrationAdaptersStatus(), []);
  const openIncidents = useMemo(() => incidents.filter((i) => i.status !== "closed"), [incidents]);
  const deliverySummary = useMemo(() => {
    const rows = permits.flatMap((p) => p.notificationLog || []);
    const by = {};
    rows.forEach((r) => {
      const k = `${r.channel || "email"}:${r.status || "sent"}`;
      by[k] = (by[k] || 0) + 1;
    });
    return Object.entries(by).map(([k, count]) => ({ key: k, count }));
  }, [permits]);

  const loadPermitCloudAudit = useCallback(async (permitId) => {
    const { rows } = await fetchPermitAuditPage({
      orgSlug: getOrgId(),
      permitId,
      page: 1,
      pageSize: 10,
    });
    return rows;
  }, []);

  const exportAuditCsv = () => {
    if (!auditRows.length) return;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
    const header = ["occurred_at", "permit_id", "action", "from_status", "to_status", "location", "type"];
    const lines = [header.join(",")];
    auditRows.forEach((r) => {
      lines.push(
        [
          esc(r.occurred_at),
          esc(r.permit_id),
          esc(r.action),
          esc(r.from_status),
          esc(r.to_status),
          esc(r.detail?.location),
          esc(r.detail?.type),
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permit-audit-page-${auditPage}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toggleAuditAction = (action) => {
    setAuditActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const applyAuditDatePreset = (preset) => {
    if (preset === "all") {
      setAuditFromDate("");
      setAuditToDate("");
      return;
    }
    const today = todayDateInputValue();
    if (preset === "today") {
      setAuditFromDate(today);
      setAuditToDate(today);
      return;
    }
    if (preset === "7d") {
      setAuditFromDate(dateDaysAgoValue(6));
      setAuditToDate(today);
      return;
    }
    if (preset === "30d") {
      setAuditFromDate(dateDaysAgoValue(29));
      setAuditToDate(today);
    }
  };

  const focusPermit = (permitId, options = {}) => {
    if (!permitId) return;
    setFilterStatus("");
    setFilterType("");
    setFilterHandoverDue(false);
    setFilterBlockedNow(false);
    setSearch("");
    setViewMode("list");
    setHighlightPermitId(permitId);
    requestAnimationFrame(() => {
      document.getElementById(`permit-row-${permitId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    if (options.openEditor) {
      const target = permits.find((p) => p.id === permitId);
      if (target) setModal({ type: "form", data: target });
    }
    setTimeout(() => setHighlightPermitId(null), 7000);
  };
  const jumpToPermitFromAudit = (permitId) => {
    focusPermit(permitId, { openEditor: false });
  };

  const openConflictMatrixEditor = () => {
    setConflictMatrixEditorText(JSON.stringify(conflictMatrixOverrides, null, 2));
    setConflictMatrixEditorError("");
    setConflictMatrixEditorOpen(true);
  };
  const applyConflictMatrixOverridesFromEditor = () => {
    try {
      const parsed = JSON.parse(conflictMatrixEditorText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setConflictMatrixEditorError("Overrides must be a JSON object keyed by pair, e.g. hot_work+confined_space.");
        return;
      }
      const next = {};
      for (const [rawKey, rawRule] of Object.entries(parsed)) {
        if (!rawRule || typeof rawRule !== "object") continue;
        const parts = String(rawKey || "")
          .split("+")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);
        if (parts.length !== 2) continue;
        const pairKey = normalizeConflictPair(parts[0], parts[1]);
        const outcome = String(rawRule.outcome || "allow").toLowerCase();
        if (!["allow", "warn", "block"].includes(outcome)) continue;
        next[pairKey] = {
          outcome,
          reason: String(rawRule.reason || "").slice(0, 240),
        };
      }
      setConflictMatrixOverrides(next);
      setConflictMatrixEditorError("");
      setConflictMatrixEditorOpen(false);
    } catch {
      setConflictMatrixEditorError("Invalid JSON. Fix syntax and try again.");
    }
  };
  const resetConflictMatrixOverrides = () => {
    if (!window.confirm("Reset permit conflict matrix overrides for this org?")) return;
    setConflictMatrixOverrides({});
    setConflictMatrixEditorText("{}");
    setConflictMatrixEditorError("");
  };
  const savePermitTypeOverride = () => {
    const type = permitTypeEditorType;
    if (!type || !PERMIT_TYPES[type]) return;
    const base = PERMIT_TYPES[type];
    const nextOverride = {
      label: String(permitTypeEditorDraft.label || "").trim(),
      color: String(permitTypeEditorDraft.color || "").trim(),
      bg: String(permitTypeEditorDraft.bg || "").trim(),
      description: String(permitTypeEditorDraft.description || "").trim(),
    };
    const cleaned = {};
    if (nextOverride.label && nextOverride.label !== base.label) cleaned.label = nextOverride.label;
    if (nextOverride.color && nextOverride.color !== base.color) cleaned.color = nextOverride.color;
    if (nextOverride.bg && nextOverride.bg !== base.bg) cleaned.bg = nextOverride.bg;
    if (nextOverride.description && nextOverride.description !== base.description) cleaned.description = nextOverride.description;
    setPermitTypeOverrides((prev) => {
      const next = { ...prev };
      if (Object.keys(cleaned).length) next[type] = cleaned;
      else delete next[type];
      return next;
    });
  };
  const resetPermitTypeOverride = () => {
    const type = permitTypeEditorType;
    setPermitTypeOverrides((prev) => {
      if (!prev[type]) return prev;
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };
  const resetAllPermitTypeOverrides = () => {
    if (!window.confirm("Reset all permit type visual overrides for this org?")) return;
    setPermitTypeOverrides({});
  };
  const resetPermitFormDefaults = () => {
    if (!window.confirm("Reset permit form company defaults to baseline?")) return;
    setPermitFormDefaults(DEFAULT_PERMIT_FORM_DEFAULTS);
  };
  const updatePermitFieldSetting = (fieldId, patch) => {
    const typeKey = String(fieldEditorType || "_all").toLowerCase();
    const targetType = typeKey === "_all" ? "_all" : typeKey;
    setPermitFieldOverrides((prev) => {
      const next = { ...(prev || {}) };
      const currentType = { ...(next[targetType] || {}) };
      const currentField = { ...(currentType[fieldId] || {}) };
      const mergedField = { ...currentField, ...patch };
      const cleaned = {};
      if (mergedField.required != null) cleaned.required = Boolean(mergedField.required);
      if (mergedField.placeholder != null) cleaned.placeholder = String(mergedField.placeholder).slice(0, 220);
      if (mergedField.helpText != null) cleaned.helpText = String(mergedField.helpText).slice(0, 240);
      if (mergedField.maxLength != null) {
        const n = Number(mergedField.maxLength);
        if (Number.isFinite(n) && n > 0) cleaned.maxLength = Math.max(20, Math.min(5000, Math.round(n)));
      }
      const defaults = resolvePermitFieldConfig(targetType === "_all" ? "general" : targetType, {});
      const d = defaults[fieldId];
      const shouldKeep =
        cleaned.required !== d.required ||
        (cleaned.placeholder || "") !== (d.placeholder || "") ||
        (cleaned.helpText || "") !== (d.helpText || "") ||
        Number(cleaned.maxLength || 0) !== Number(d.maxLength || 0);
      if (shouldKeep) currentType[fieldId] = cleaned;
      else delete currentType[fieldId];
      if (Object.keys(currentType).length) next[targetType] = currentType;
      else delete next[targetType];
      return next;
    });
  };
  const resetFieldSettingsForType = () => {
    const targetType = String(fieldEditorType || "_all").toLowerCase();
    if (!window.confirm(`Reset field settings for ${targetType === "_all" ? "all permit types" : targetType}?`)) return;
    setPermitFieldOverrides((prev) => {
      const next = { ...(prev || {}) };
      delete next[targetType];
      return next;
    });
  };
  const resetAllFieldSettings = () => {
    if (!window.confirm("Reset all no-code field settings to defaults?")) return;
    setPermitFieldOverrides({});
  };
  const addConditionalRuleRow = () => {
    setConditionalRuleOverrides((prev) => [
      ...prev,
      {
        id: `rule_${genId()}`,
        enabled: true,
        when: { permitType: "", status: "", projectId: "" },
        whenOperator: "and",
        whenClauses: [{ field: "permitType", value: "" }],
        thenField: "description",
        action: "required",
        message: "",
      },
    ]);
  };
  const updateConditionalRuleRow = (ruleId, patch = {}) => {
    setConditionalRuleOverrides((prev) =>
      normalizePermitConditionalRules(
        prev.map((row) => (row.id === ruleId ? { ...row, ...patch, when: { ...(row.when || {}), ...(patch.when || {}) } } : row))
      )
    );
  };
  const removeConditionalRuleRow = (ruleId) => {
    setConditionalRuleOverrides((prev) => prev.filter((row) => row.id !== ruleId));
  };
  const addConditionalClause = (ruleId) => {
    updateConditionalRuleRow(ruleId, {
      whenClauses: [
        ...((conditionalRuleOverrides.find((r) => r.id === ruleId)?.whenClauses || []).slice(0, 11)),
        { field: "permitType", value: "" },
      ],
    });
  };
  const updateConditionalClause = (ruleId, idx, patch = {}) => {
    const target = conditionalRuleOverrides.find((r) => r.id === ruleId);
    const rows = Array.isArray(target?.whenClauses) ? [...target.whenClauses] : [];
    if (!rows[idx]) return;
    rows[idx] = { ...rows[idx], ...patch };
    updateConditionalRuleRow(ruleId, { whenClauses: rows });
  };
  const removeConditionalClause = (ruleId, idx) => {
    const target = conditionalRuleOverrides.find((r) => r.id === ruleId);
    const rows = Array.isArray(target?.whenClauses) ? [...target.whenClauses] : [];
    rows.splice(idx, 1);
    updateConditionalRuleRow(ruleId, { whenClauses: rows });
  };
  const moveConditionalClause = (ruleId, idx, dir) => {
    const target = conditionalRuleOverrides.find((r) => r.id === ruleId);
    const rows = Array.isArray(target?.whenClauses) ? [...target.whenClauses] : [];
    const nextIdx = dir === "up" ? idx - 1 : idx + 1;
    if (!rows[idx] || !rows[nextIdx]) return;
    const tmp = rows[idx];
    rows[idx] = rows[nextIdx];
    rows[nextIdx] = tmp;
    updateConditionalRuleRow(ruleId, { whenClauses: rows });
  };
  const resetConditionalRules = () => {
    if (!window.confirm("Reset all conditional rules for this org?")) return;
    setConditionalRuleOverrides([]);
  };
  const applyShiftBoundaryHours = () => {
    const parsed = normalizeShiftHours(
      String(shiftBoundaryHoursDraft || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    );
    if (!parsed.length) {
      setShiftBoundaryHoursError("Provide at least one hour between 0 and 23.");
      return;
    }
    setShiftBoundaryHours(parsed);
    setShiftBoundaryHoursError("");
  };
  const resetShiftBoundaryHours = () => {
    setShiftBoundaryHours([6, 18]);
    setShiftBoundaryHoursDraft("6, 18");
    setShiftBoundaryHoursError("");
  };
  const openWorkflowPolicyEditor = () => {
    setWorkflowEditorText(JSON.stringify(workflowPolicyOverrides, null, 2));
    setWorkflowEditorError("");
    setWorkflowEditorOpen(true);
  };
  const applyWorkflowPolicyOverrides = () => {
    try {
      const parsed = JSON.parse(workflowEditorText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setWorkflowEditorError("Workflow overrides must be a JSON object keyed by state.");
        return;
      }
      setWorkflowPolicyOverrides(normalizeWorkflowPolicyOverrides(parsed));
      setWorkflowEditorError("");
      setWorkflowEditorOpen(false);
    } catch {
      setWorkflowEditorError("Invalid JSON. Fix syntax and try again.");
    }
  };
  const resetWorkflowPolicyOverrides = () => {
    if (!window.confirm("Reset workflow policy overrides for this org?")) return;
    setWorkflowPolicyOverrides({});
    setWorkflowEditorText("{}");
    setWorkflowEditorError("");
  };
  const toggleWorkflowTransitionRule = (fromState, toState) => {
    const from = String(fromState || "").toLowerCase();
    const to = String(toState || "").toLowerCase();
    if (!from || !to) return;
    setWorkflowPolicyOverrides((prev) => {
      const policy = mergeWorkflowPolicy(prev);
      const current = new Set(Array.isArray(policy[from]) ? policy[from] : []);
      if (current.has(to)) current.delete(to);
      else current.add(to);
      return { ...policy, [from]: Array.from(current) };
    });
  };
  const openWorkflowRolePolicyEditor = () => {
    setWorkflowRoleEditorText(JSON.stringify(workflowRolePolicyOverrides, null, 2));
    setWorkflowRoleEditorError("");
    setWorkflowRoleEditorOpen(true);
  };
  const applyWorkflowRolePolicyOverrides = () => {
    try {
      const parsed = JSON.parse(workflowRoleEditorText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setWorkflowRoleEditorError("Role policy overrides must be a JSON object keyed by target state.");
        return;
      }
      setWorkflowRolePolicyOverrides(normalizeWorkflowRolePolicyOverrides(parsed));
      setWorkflowRoleEditorError("");
      setWorkflowRoleEditorOpen(false);
    } catch {
      setWorkflowRoleEditorError("Invalid JSON. Fix syntax and try again.");
    }
  };
  const resetWorkflowRolePolicyOverrides = () => {
    if (!window.confirm("Reset workflow role policy overrides for this org?")) return;
    setWorkflowRolePolicyOverrides({});
    setWorkflowRoleEditorText("{}");
    setWorkflowRoleEditorError("");
  };
  const toggleWorkflowRolePermission = (targetState, roleName) => {
    const target = String(targetState || "").toLowerCase();
    const role = String(roleName || "").toLowerCase();
    if (!target || !role) return;
    setWorkflowRolePolicyOverrides((prev) => {
      const policy = mergeWorkflowRolePolicy(prev);
      const current = new Set(Array.isArray(policy[target]) ? policy[target] : []);
      if (current.has(role)) current.delete(role);
      else current.add(role);
      return { ...policy, [target]: Array.from(current) };
    });
  };
  const openDependencyRuleEditor = () => {
    setDependencyEditorText(JSON.stringify(dependencyRuleOverrides, null, 2));
    setDependencyEditorError("");
    setDependencyEditorOpen(true);
  };
  const applyDependencyRuleOverrides = () => {
    try {
      const parsed = JSON.parse(dependencyEditorText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setDependencyEditorError("Dependency rules must be a JSON object keyed by permit type.");
        return;
      }
      setDependencyRuleOverrides(normalizeDependencyRules(parsed));
      setDependencyEditorError("");
      setDependencyEditorOpen(false);
    } catch {
      setDependencyEditorError("Invalid JSON. Fix syntax and try again.");
    }
  };
  const resetDependencyRuleOverrides = () => {
    if (!window.confirm("Reset permit dependency rule overrides for this org?")) return;
    setDependencyRuleOverrides({});
    setDependencyEditorText("{}");
    setDependencyEditorError("");
  };
  const addDependencyRuleRow = () => {
    setDependencyRuleOverrides((prev) => {
      const next = { ...normalizeDependencyRules(prev) };
      const key = dependencyEditorType || "confined_space";
      const rows = Array.isArray(next[key]) ? [...next[key]] : [];
      rows.push({ requiresActiveType: "loto", reason: "" });
      next[key] = rows;
      return next;
    });
  };
  const updateDependencyRuleRow = (typeKey, idx, patch) => {
    const key = String(typeKey || "").toLowerCase();
    if (!key) return;
    setDependencyRuleOverrides((prev) => {
      const next = { ...normalizeDependencyRules(prev) };
      const rows = Array.isArray(next[key]) ? [...next[key]] : [];
      if (!rows[idx]) return next;
      rows[idx] = { ...rows[idx], ...patch };
      next[key] = rows
        .map((r) => ({
          requiresActiveType: String(r.requiresActiveType || "").toLowerCase(),
          reason: String(r.reason || ""),
        }))
        .filter((r) => r.requiresActiveType);
      return next;
    });
  };
  const removeDependencyRuleRow = (typeKey, idx) => {
    const key = String(typeKey || "").toLowerCase();
    if (!key) return;
    setDependencyRuleOverrides((prev) => {
      const next = { ...normalizeDependencyRules(prev) };
      const rows = Array.isArray(next[key]) ? [...next[key]] : [];
      rows.splice(idx, 1);
      if (rows.length === 0) delete next[key];
      else next[key] = rows;
      return next;
    });
  };
  const openHandoverDialog = (permit) => {
    const p = permit || {};
    setHandoverDialog({
      permitId: p.id || "",
      whatChanged: "",
      remainingHighRisk: "",
      criticalControlsConfirmed: false,
      outgoingSupervisor: "",
      incomingSupervisor: "",
      error: "",
    });
  };
  const submitHandoverDialog = () => {
    if (!handoverDialog?.permitId) return;
    const whatChanged = String(handoverDialog.whatChanged || "").trim();
    const remainingHighRisk = String(handoverDialog.remainingHighRisk || "").trim();
    const outgoingSupervisor = String(handoverDialog.outgoingSupervisor || "").trim();
    const incomingSupervisor = String(handoverDialog.incomingSupervisor || "").trim();
    if (!whatChanged || !remainingHighRisk || !outgoingSupervisor || !incomingSupervisor || handoverDialog.criticalControlsConfirmed !== true) {
      setHandoverDialog((d) => (d ? { ...d, error: "Complete all handover prompts, supervisors, and controls confirmation." } : d));
      return;
    }
    const nowIso = new Date().toISOString();
    const entry = {
      id: `handover_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      submittedAt: nowIso,
      shiftBoundaryAt: nowIso,
      whatChanged,
      remainingHighRisk,
      criticalControlsConfirmed: true,
      outgoingSupervisor,
      incomingSupervisor,
      outgoingAcknowledgedAt: nowIso,
      incomingAcknowledgedAt: nowIso,
    };
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== handoverDialog.permitId) return p;
        const baseNext = {
          ...p,
          handoverLog: [...(Array.isArray(p.handoverLog) ? p.handoverLog : []), entry].slice(-30),
          updatedAt: nowIso,
          handoverUpdatedAt: nowIso,
        };
        const submitRow = { ...baseNext, _auditAction: "handover_submitted", handoverEntry: entry };
        const submitLog = appendPermitAuditEntry(p, submitRow);
        const outgoingRow = { ...baseNext, auditLog: submitLog, _auditAction: "handover_ack_outgoing", handoverEntry: entry };
        const outgoingLog = appendPermitAuditEntry({ ...p, auditLog: submitLog }, outgoingRow);
        const incomingRow = { ...baseNext, auditLog: outgoingLog, _auditAction: "handover_ack_incoming", handoverEntry: entry };
        const incomingLog = appendPermitAuditEntry({ ...p, auditLog: outgoingLog }, incomingRow);
        const withLog = { ...baseNext, auditLog: incomingLog };
        void logPermitAuditToSupabase(p, submitRow, getOrgId());
        void logPermitAuditToSupabase(p, outgoingRow, getOrgId());
        void logPermitAuditToSupabase(p, incomingRow, getOrgId());
        return withLog;
      })
    );
    setHandoverDialog(null);
    trackEvent("permit_shift_handover", { permitId: handoverDialog.permitId });
  };
  const closeConflictOverrideDialog = (result) => {
    const resolve = conflictOverrideResolverRef.current;
    conflictOverrideResolverRef.current = null;
    setConflictOverrideDialog(null);
    if (typeof resolve === "function") resolve(result);
  };
  const submitConflictOverrideDialog = () => {
    if (!conflictOverrideDialog) return;
    const reason = String(conflictOverrideDialog.reason || "").trim();
    const approvedBy = String(conflictOverrideDialog.approvedBy || "").trim();
    if (!reason || !approvedBy) {
      setConflictOverrideDialog((d) => (d ? { ...d, error: "Provide both override reason and approver." } : d));
      return;
    }
    closeConflictOverrideDialog({
      reason,
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
  };

  const togglePermitSelection = (permitId) => {
    setSelectedPermitIds((prev) => {
      const next = { ...prev };
      if (next[permitId]) delete next[permitId];
      else next[permitId] = true;
      return next;
    });
  };

  const clearPermitSelection = () => setSelectedPermitIds({});

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const next = { ...selectedPermitIds };
      filtered.forEach((p) => {
        delete next[p.id];
      });
      setSelectedPermitIds(next);
      return;
    }
    const next = { ...selectedPermitIds };
    filtered.forEach((p) => {
      next[p.id] = true;
    });
    setSelectedPermitIds(next);
  };

  const upsertBulkStatus = (fromStatuses, nextStatus, nextPatch = {}, workflowTargetState = "", workflowNote = "bulk_status") => {
    const fromSet = new Set(fromStatuses);
    let changed = 0;
    setPermits((prev) =>
      prev.map((p) => {
        if (!selectedPermitIds[p.id]) return p;
        if (!fromSet.has(String(p.status || ""))) return p;
        let next = {
          ...p,
          status: nextStatus,
          ...nextPatch,
        };
        if (workflowTargetState) {
          next = transitionPermitWorkflowWithPolicy(next, workflowTargetState, workflowNote);
        }
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        changed += 1;
        return withLog;
      })
    );
    clearPermitSelection();
    trackEvent("permit_bulk_status", { nextStatus, changed });
    return changed;
  };

  const bulkApproveSelected = () => {
    if (!ensureWorkflowRoleAllowed("approved", "bulk approve")) return;
    const ids = Object.keys(selectedPermitIds);
    const targets = permits.filter((p) => ids.includes(p.id) && ["pending_review", "ready_for_review"].includes(String(p.status || "")));
    for (const p of targets) {
      if (!canPermitWorkflowTransition(p, "approved", effectiveWorkflowPolicy)) {
        window.alert(`Workflow policy blocks approve for ${p.id}: ${permitCurrentWorkflowState(p)} -> approved.`);
        return;
      }
      const g = evaluatePermitActionGate(p, "approve", {});
      if (!g.allowed) {
        window.alert(g.message || "Cannot approve.");
        return;
      }
    }
    const changed = upsertBulkStatus(["pending_review", "ready_for_review"], "approved", { approvedAt: new Date().toISOString() }, "approved", "bulk_approve");
    if (changed === 0) window.alert("No selected permits are in review.");
  };

  const bulkActivateSelected = async () => {
    if (!ensureWorkflowRoleAllowed("issued", "bulk activate")) return;
    const ids = Object.keys(selectedPermitIds);
    const targets = permits.filter((p) => ids.includes(p.id) && ["approved", "closed"].includes(String(p.status || "")));
    if (targets.length === 0) {
      window.alert("No selected permits can be activated.");
      return;
    }
    const warnOverridesById = {};
    for (const p of targets) {
      if (!canPermitWorkflowTransition(p, "issued", effectiveWorkflowPolicy)) {
        window.alert(`Workflow policy blocks activation for ${p.id}: ${permitCurrentWorkflowState(p)} -> issued.`);
        return;
      }
      const conflictResult = conflictResultForPermitGate(p, permits);
      let warnConflictOverride = p.conflictWarnOverride || null;
      let g = activationGateForPermit(p, permits, warnConflictOverride, new Date());
      if (!g.allowed && g.code === "permit_conflict_warn") {
        warnConflictOverride = await requestWarnConflictOverride(p, g.conflicts || []);
        if (!warnConflictOverride) return;
        g = evaluatePermitActionGate(p, "activate", {
          complianceResult: complianceForPermitGate(p),
          conflictResult,
          warnConflictOverride,
          handoverRequirement: handoverRequirementForActivation(p, new Date()),
        });
      }
      if (!g.allowed) {
        window.alert(g.message || "Cannot activate.");
        return;
      }
      if (warnConflictOverride) warnOverridesById[p.id] = warnConflictOverride;
    }
    setPermits((prev) =>
      prev.map((p) => {
        if (!selectedPermitIds[p.id]) return p;
        if (!["approved", "closed"].includes(String(p.status || ""))) return p;
        let next = {
          ...p,
          status: "active",
          closedAt: undefined,
          conflictWarnOverride: warnOverridesById[p.id] || p.conflictWarnOverride || null,
        };
        if (!p.issueSnapshot) next = { ...next, issueSnapshot: buildIssueSnapshot(p) };
        next = transitionPermitWorkflowWithPolicy(next, "issued", "activate");
        const baseWithLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        const withLog = warnOverridesById[p.id]
          ? {
              ...baseWithLog,
              auditLog: [
                ...(baseWithLog.auditLog || []),
                {
                  at: new Date().toISOString(),
                  action: "conflict_warn_override",
                  reason: warnOverridesById[p.id].reason,
                  approvedBy: warnOverridesById[p.id].approvedBy,
                },
              ].slice(-40),
            }
          : baseWithLog;
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        if (warnOverridesById[p.id]) {
          const overrideAuditRow = { ...withLog, status: p.status, _auditAction: "conflict_warn_override" };
          void logPermitAuditToSupabase(p, overrideAuditRow, getOrgId());
        }
        return withLog;
      })
    );
    clearPermitSelection();
    trackEvent("permit_bulk_status", { nextStatus: "active", changed: targets.length });
  };

  const bulkCloseSelected = () => {
    if (!ensureWorkflowRoleAllowed("closed", "bulk close")) return;
    const ids = Object.keys(selectedPermitIds);
    const targets = permits.filter((p) => ids.includes(p.id) && ["active"].includes(String(p.status || "")));
    for (const p of targets) {
      if (!canPermitWorkflowTransition(p, "closed", effectiveWorkflowPolicy)) {
        window.alert(`Workflow policy blocks close for ${p.id}: ${permitCurrentWorkflowState(p)} -> closed.`);
        return;
      }
    }
    const changed = upsertBulkStatus(["active"], "closed", { closedAt: new Date().toISOString() }, "closed", "bulk_close");
    if (changed === 0) window.alert("No selected permits are active.");
  };

  const bulkSetIssuerSelected = () => {
    if (!hasSelectedPermits) return;
    const issuer = window.prompt("Set issued-by for selected permits:", "") || "";
    const clean = issuer.trim();
    if (!clean) return;
    setPermits((prev) =>
      prev.map((p) => {
        if (!selectedPermitIds[p.id]) return p;
        const next = { ...p, issuedBy: clean };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
    clearPermitSelection();
  };

  const bulkTagSelected = () => {
    if (!hasSelectedPermits) return;
    const tag = window.prompt("Add tag to selected permits:", "") || "";
    const clean = tag.trim();
    if (!clean) return;
    setPermits((prev) =>
      prev.map((p) => {
        if (!selectedPermitIds[p.id]) return p;
        const tags = Array.isArray(p.tags) ? p.tags : [];
        if (tags.includes(clean)) return p;
        const next = { ...p, tags: [clean, ...tags].slice(0, 20) };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
    clearPermitSelection();
  };

  const bulkDeleteSelected = () => {
    if (!hasSelectedPermits) return;
    if (!window.confirm(`Delete ${selectedPermits.length} selected permit(s)?`)) return;
    const selectedIds = new Set(Object.keys(selectedPermitIds));
    setPermits((prev) => {
      prev.forEach((p) => {
        if (!selectedIds.has(p.id)) return;
        pushRecycleBinItem({
          moduleId: "permits",
          moduleLabel: "Permits",
          itemType: "permit",
          itemLabel: p.description || p.location || p.id,
          sourceKey: "permits_v2",
          payload: p,
        });
        void logPermitDeletedToSupabase(p, getOrgId());
      });
      return prev.filter((p) => !selectedIds.has(p.id));
    });
    clearPermitSelection();
    trackEvent("permit_bulk_delete", { count: selectedPermits.length });
  };

  const bulkExportSelectedCsv = () => {
    if (!hasSelectedPermits) return;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
    const header = ["permit_id", "type", "status", "location", "issued_to", "issued_by", "start", "end"];
    const lines = [header.join(",")];
    selectedPermits.forEach((p) => {
      lines.push(
        [
          esc(p.id),
          esc((effectivePermitTypes[p.type] || effectivePermitTypes.general).label),
          esc(derivePermitStatus(p, now)),
          esc(p.location),
          esc(p.issuedTo),
          esc(p.issuedBy),
          esc(p.startDateTime),
          esc(permitEndIso(p)),
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permits-selected-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    trackEvent("permit_bulk_export_csv", { count: selectedPermits.length });
  };

  const bulkExportSitePackV2 = () => {
    if (!hasSelectedPermits) return;
    let org = {};
    try {
      org = JSON.parse(localStorage.getItem("mysafeops_org_settings") || "{}");
    } catch {
      org = {};
    }
    const workersByName = new Map(workers.map((w) => [String(w.name || "").trim().toLowerCase(), w]));
    const selectedWithContext = selectedPermits.map((permit) => {
      const linkedRams =
        permit.linkedRamsId && Array.isArray(ramsDocs) ? ramsDocs.find((d) => d.id === permit.linkedRamsId) || null : null;
      const issuedWorker = workersByName.get(String(permit.issuedTo || "").trim().toLowerCase()) || null;
      return {
        permit,
        linkedRams,
        workerSnapshot: issuedWorker
          ? {
              id: issuedWorker.id,
              name: issuedWorker.name,
              role: issuedWorker.role,
              certifications: issuedWorker.certifications || [],
            }
          : null,
      };
    });
    const payload = {
      generatedAt: new Date().toISOString(),
      org: {
        name: org?.name || "MySafeOps",
        emergencyContact: org?.emergencyContact || "",
      },
      summary: {
        permits: selectedWithContext.length,
        withLinkedRams: selectedWithContext.filter((x) => x.linkedRams).length,
        withWorkerSnapshot: selectedWithContext.filter((x) => x.workerSnapshot).length,
      },
      items: selectedWithContext,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permit-site-pack-v2-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    trackEvent("permit_site_pack_v2_export", { count: selectedWithContext.length });
  };

  const saveCurrentView = () => {
    const suggested = `View ${savedViews.length + 1}`;
    const name = window.prompt("Saved view name:", suggested);
    if (name == null) return;
    const clean = String(name).trim();
    if (!clean) return;
    const id = `view_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next = {
      id,
      name: clean.slice(0, 64),
      filterType,
      filterStatus,
      filterHandoverDue,
      filterBlockedNow,
      filterBriefingPending,
      filterRamsMissing,
      cardDensity,
      permitThemeMode,
      search,
      viewMode: availableViewModes.includes(viewMode) ? viewMode : "list",
    };
    setSavedViews((prev) => [next, ...prev.filter((v) => v.name.toLowerCase() !== next.name.toLowerCase())].slice(0, 12));
    trackEvent("permit_saved_view_created", { name: next.name });
  };

  const applySavedView = (view) => {
    if (!view) return;
    setFilterType(view.filterType || "");
    setFilterStatus(view.filterStatus || "");
    setFilterHandoverDue(Boolean(view.filterHandoverDue));
    setFilterBlockedNow(Boolean(view.filterBlockedNow));
    setFilterBriefingPending(Boolean(view.filterBriefingPending));
    setFilterRamsMissing(Boolean(view.filterRamsMissing));
    setCardDensity(["comfort", "compact", "ops"].includes(view.cardDensity) ? view.cardDensity : "comfort");
    setPermitThemeMode(PERMIT_THEME_MODES.includes(view.permitThemeMode) ? view.permitThemeMode : "auto");
    setSearch(view.search || "");
    setViewMode(availableViewModes.includes(view.viewMode) ? view.viewMode : "list");
    trackEvent("permit_saved_view_applied", { name: view.name || "view" });
  };

  const deleteSavedView = (id) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
  };

  const toggleWallFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        trackEvent("permit_wall_fullscreen", { state: "on" });
      } else {
        await document.exitFullscreen();
        trackEvent("permit_wall_fullscreen", { state: "off" });
      }
    } catch {
      // ignore fullscreen errors (browser/policy)
    }
  };

  const exportAllAuditCsv = async () => {
    setAuditLoading(true);
    setAuditError("");
    setAuditExportNotice("");
    try {
      const { rows: allRows, truncated, maxRows } = await fetchAllPermitAuditRows({
        orgSlug: getOrgId(),
        permitId: auditPermitId || undefined,
        fromDate: auditFromDate || undefined,
        toDate: auditToDate || undefined,
        actions: auditActions.length ? auditActions : undefined,
      });
      if (!allRows.length) return;
      const esc = (v) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
      const header = ["occurred_at", "permit_id", "action", "from_status", "to_status", "location", "type"];
      const lines = [header.join(",")];
      allRows.forEach((r) => {
        lines.push(
          [
            esc(r.occurred_at),
            esc(r.permit_id),
            esc(r.action),
            esc(r.from_status),
            esc(r.to_status),
            esc(r.detail?.location),
            esc(r.detail?.type),
          ].join(",")
        );
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "permit-audit-full-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (truncated) {
        setAuditExportNotice(`Export reached safety cap (${maxRows} rows). Narrow filters for a complete dataset.`);
      } else {
        setAuditExportNotice(`Exported ${allRows.length} rows.`);
      }
    } catch (err) {
      setAuditError(err?.message || String(err));
    } finally {
      setAuditLoading(false);
    }
  };

  const notifyPermitTeam = async (permit) => {
    if (!permitNotifyEnabled) return;
    const channel = String(window.prompt("Delivery channel (email/slack/teams/whatsapp):", "email") || "email")
      .trim()
      .toLowerCase();
    if (channel !== "email") {
      const queued = {
        at: new Date().toISOString(),
        channel: ["slack", "teams", "whatsapp"].includes(channel) ? channel : "email",
        status: "queued",
        recipientCount: 0,
        note: "Channel integration queued (observability + retry center).",
      };
      setPermits((prev) => prev.map((p) => (p.id === permit.id ? { ...p, notificationLog: [...(p.notificationLog || []), queued] } : p)));
      trackEvent("permit_notification_queued_channel", { permitId: permit.id, channel: queued.channel });
      window.alert(`Saved ${queued.channel} notification request to delivery log (integration queue).`);
      return;
    }
    if (!supabase) {
      window.alert("Cloud notifications require signed-in Supabase account.");
      return;
    }
    let org = {};
    try {
      org = JSON.parse(localStorage.getItem("mysafeops_org_settings") || "{}");
    } catch {
      org = {};
    }
    const autoRecipients = buildPermitEmailRecipients(permit, workers);
    let recipients = autoRecipients;
    if (recipients.length === 0) {
      const manual = window.prompt("No worker emails matched this permit. Enter recipient emails (comma-separated):", "");
      recipients = parseManualEmails(manual || "");
    } else {
      const manual = window.prompt(
        `Recipients (edit if needed, comma-separated):`,
        autoRecipients.join(", ")
      );
      if (manual == null) return;
      recipients = parseManualEmails(manual);
    }
    if (recipients.length === 0) {
      window.alert("No valid recipient emails.");
      return;
    }
    const message = window.prompt("Optional message to include in email:", "") || "";
    const linkedRams =
      permit.linkedRamsId && Array.isArray(ramsDocs)
        ? ramsDocs.find((d) => d.id === permit.linkedRamsId)
        : null;
    try {
      const res = await sendPermitNotificationEmail({
        permit,
        recipients,
        orgName: org?.name || "MySafeOps",
        message,
        ramsDoc: linkedRams || null,
      });
      const pushRes = await sendPermitNotificationWebPush({
        permit,
        orgSlug: getOrgId(),
        title: `${org?.name || "MySafeOps"} · Permit update`,
        body: `${(permit.type || "permit").replace(/_/g, " ")} at ${permit.location || "site"} status: ${permit.status || "updated"}.`,
        url: "/?tab=permits",
        tag: `permit_notify_${permit.id}`,
      }).catch(() => null);
      const entry = {
        at: new Date().toISOString(),
        channel,
        status: "sent",
        recipientCount: Number(res?.recipientCount || recipients.length),
        note: `${linkedRams ? "includes RAMS reference" : ""}${pushRes?.ok ? `${linkedRams ? " · " : ""}web push ${Number(pushRes?.sent || 0)} endpoint(s)` : ""}`.trim(),
      };
      setPermits((prev) =>
        prev.map((p) => (p.id === permit.id ? { ...p, notificationLog: [...(p.notificationLog || []), entry] } : p))
      );
      trackEvent("permit_notification_sent", {
        permitId: permit.id,
        channel,
        recipients: entry.recipientCount,
      });
      window.alert(`Email sent to ${entry.recipientCount} recipient(s).`);
    } catch (err) {
      const msg = String(err?.message || err || "Notification failed");
      setPermits((prev) =>
        prev.map((p) =>
          p.id === permit.id
            ? {
                ...p,
                notificationLog: [
                  ...(p.notificationLog || []),
                  {
                    at: new Date().toISOString(),
                    channel,
                    status: "failed",
                    recipientCount: recipients.length,
                    note: msg.slice(0, 180),
                  },
                ],
              }
            : p
        )
      );
      window.alert(msg.toLowerCase().includes("failed to send a request to the edge function")
        ? "Notification function is not deployed yet (send-permit-notification)."
        : msg);
    }
  };

  const sharePermitAckLink = (permit) => {
    if (!permit) return;
    let token = String(permit.ackToken || "");
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== permit.id) return p;
        if (!token) token = genAckToken();
        const next = token && !p.ackToken ? { ...p, ackToken: token, updatedAt: new Date().toISOString() } : p;
        if (next === p) return p;
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
    const targetToken = token || permit.ackToken;
    if (!targetToken) return;
    const url = `${window.location.origin}${window.location.pathname}?view=permits&permitAck=${encodeURIComponent(targetToken)}`;
    navigator.clipboard?.writeText(url).then(
      () => window.alert("Read/Sign link copied."),
      () => window.alert(url)
    );
  };

  const acknowledgePermit = async (permit) => {
    let actor = "";
    if (supabase) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        actor = user?.email || user?.id || "";
      } catch {
        actor = "";
      }
    }
    if (!actor) {
      let org = {};
      try {
        org = JSON.parse(localStorage.getItem("mysafeops_org_settings") || "{}");
      } catch {
        org = {};
      }
      actor = String(org.defaultLeadEngineer || "").trim();
    }
    const by = window.prompt("Acknowledge as:", actor || "");
    if (by == null) return;
    const cleanBy = String(by).trim();
    if (!cleanBy) return;
    const note = window.prompt("Optional acknowledgement note:", "") || "";
    const entry = {
      at: new Date().toISOString(),
      by: cleanBy,
      note: String(note).slice(0, 200),
    };
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== permit.id) return p;
        const next = { ...p, acknowledgements: [...(p.acknowledgements || []), entry] };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
    trackEvent("permit_acknowledged", { permitId: permit.id });
  };

  const acknowledgeFromPortalLink = () => {
    if (!ackPortalPermit) return;
    const by = String(ackActorName || "").trim();
    if (!by) {
      window.alert("Enter your name/email before signing.");
      return;
    }
    const at = new Date().toISOString();
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== ackPortalPermit.id) return p;
        const next = {
          ...p,
          acknowledgements: [
            ...(p.acknowledgements || []),
            { at, by, note: String(ackActorNote || "").trim() || "Read/Sign link confirmation" },
          ],
          notificationLog: [
            ...(p.notificationLog || []),
            { at, channel: "portal", status: "acknowledged", recipientCount: 1, note: `Read/Sign confirmation by ${by}` },
          ],
        };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
    window.alert("Acknowledgement saved.");
    setAckActorName("");
    setAckActorNote("");
  };

  const confirmPermitBriefing = (permitId) => {
    if (!permitId) return;
    const at = new Date().toISOString();
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== permitId) return p;
        const next = { ...p, briefingConfirmedAt: at, updatedAt: at };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
    trackEvent("permit_briefing_confirmed", { permitId });
  };

  const reportPermitIncident = async (permit) => {
    if (!isFeatureEnabled("permits_incident_traceability_v1")) return;
    const title = window.prompt("Incident title:", "Site incident");
    if (title == null) return;
    const severity = window.prompt(
      "Severity (near_miss, minor, major, environmental, utility_strike, confined_space, property_damage):",
      "near_miss"
    );
    if (severity == null) return;
    const summary = window.prompt("Incident summary:", "") || "";
    const mediaCsv = window.prompt("Optional media URLs (comma-separated photo/video/voice):", "") || "";
    const media = mediaCsv
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((url) => ({ type: "link", url }));
    const projectPlanList = projectPlans.filter((p) => p.projectId === permit.projectId);
    let planPin = null;
    if (projectPlanList.length > 0) {
      const chosenPlanId = window.prompt(
        `Optional plan ID for map pin (${projectPlanList.map((p) => p.id).join(", ")}):`,
        projectPlanList[0].id
      );
      if (chosenPlanId) {
        const px = Number(window.prompt("Pin X (0-100 % across plan):", "50"));
        const py = Number(window.prompt("Pin Y (0-100 % down plan):", "50"));
        if (Number.isFinite(px) && Number.isFinite(py)) {
          planPin = { planId: chosenPlanId, x: Math.max(0, Math.min(100, px)), y: Math.max(0, Math.min(100, py)) };
        }
      }
    }
    let actor = "unknown";
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        actor = user?.email || user?.id || actor;
      } catch {
        actor = "unknown";
      }
    }
    const incident = createPermitIncident({
      permit,
      linkedRamsId: permit.linkedRamsId || "",
      title,
      severity,
      summary,
      media,
      planPin,
      createdBy: actor,
    });
    setIncidents((prev) => [incident, ...prev].slice(0, 500));
    trackEvent("permit_incident_created", { permitId: permit.id, severity: incident.severity });
    window.alert("Incident logged and linked to permit.");
  };

  const addCorrectiveActionToIncident = (incidentId) => {
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident) return;
    const owner = window.prompt("Corrective action owner:", "") || "";
    const dueAt = window.prompt("Due date/time (ISO or YYYY-MM-DD):", new Date(Date.now() + 2 * 24 * 3600000).toISOString().slice(0, 10)) || "";
    const note = window.prompt("Corrective action note:", "") || "";
    const next = addCorrectiveAction(incident, { owner, dueAt, note });
    setIncidents((prev) => prev.map((x) => (x.id === incidentId ? next : x)));
    trackEvent("permit_incident_action_added", { incidentId });
  };

  const uploadProjectPlan = (projectId, file) =>
    new Promise((resolve, reject) => {
      const normalizedType = String(file?.type || "").toLowerCase();
      if (!PLAN_UPLOAD_MIME.has(normalizedType)) {
        reject(new Error("Only PNG, JPG, WEBP or PDF plans are supported."));
        return;
      }
      if (Number(file?.size || 0) > PLAN_UPLOAD_MAX_BYTES) {
        reject(new Error("Plan file is too large. Use files up to 2 MB."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rec = buildPlanOverlayRecord({
          projectId,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl: String(reader.result || ""),
          uploadedBy: "local-user",
        });
        setProjectPlans((prev) => [rec, ...prev].slice(0, 120));
        setSelectedPlanId(rec.id);
        trackEvent("permit_plan_uploaded", { projectId, mimeType: rec.mimeType });
        resolve(rec);
      };
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });

  const appendEmergencyAsset = (planId) => {
    const plan = projectPlans.find((p) => p.id === planId);
    if (!plan) return;
    const kind = window.prompt("Emergency asset kind (extinguisher, first_aid, muster, shutoff):", "muster");
    if (kind == null) return;
    const label = window.prompt("Asset label (optional):", "") || "";
    const x = Number(window.prompt("Asset X (0-100 %):", "50"));
    const y = Number(window.prompt("Asset Y (0-100 %):", "50"));
    const next = addPlanEmergencyAsset(plan, { kind, x, y, label });
    setProjectPlans((prev) => prev.map((p) => (p.id === planId ? next : p)));
    trackEvent("permit_plan_emergency_asset_added", { planId, kind: next.emergencyAssets?.[next.emergencyAssets.length - 1]?.kind || "asset" });
  };

  const appendEscapeRoute = (planId) => {
    const plan = projectPlans.find((p) => p.id === planId);
    if (!plan) return;
    const label = window.prompt("Escape route label:", "Primary route") || "";
    const startX = Number(window.prompt("Route start X (0-100 %):", "20"));
    const startY = Number(window.prompt("Route start Y (0-100 %):", "80"));
    const endX = Number(window.prompt("Route end X (0-100 %):", "80"));
    const endY = Number(window.prompt("Route end Y (0-100 %):", "20"));
    const next = addPlanEscapeRoute(plan, { startX, startY, endX, endY, label });
    setProjectPlans((prev) => prev.map((p) => (p.id === planId ? next : p)));
    trackEvent("permit_plan_escape_route_added", { planId });
  };

  const exportSlaDigest = () => {
    const digest = buildPermitDigest(permits, incidents, now);
    const payload = {
      ...digest,
      queue: slaQueue.slice(0, 80),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permit-sla-digest-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    trackEvent("permit_sla_digest_exported", { queueSize: slaQueue.length });
  };

  const exportAuditCsvViaServer = async () => {
    setAuditServerExportBusy(true);
    setAuditError("");
    setAuditExportNotice("");
    try {
      const { csv, fileName, rowCount, truncated, maxRows } = await exportPermitAuditCsvViaServer({
        orgSlug: getOrgId(),
        permitId: auditPermitId || undefined,
        fromDate: auditFromDate || undefined,
        toDate: auditToDate || undefined,
        actions: auditActions.length ? auditActions : undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "permit-audit-server-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (truncated) {
        setAuditExportNotice(`Server export done (${rowCount} rows, capped at ${maxRows}).`);
      } else {
        setAuditExportNotice(`Server export done (${rowCount} rows).`);
      }
    } catch (err) {
      const msg = String(err?.message || err || "Server export failed");
      if (msg.toLowerCase().includes("failed to send a request to the edge function")) {
        setAuditError("Server export function is not deployed yet (permit-audit-export). Deploy Supabase functions and try again.");
      } else {
        setAuditError(msg);
      }
    } finally {
      setAuditServerExportBusy(false);
    }
  };

  return (
    <div
      style={{
        ...permitThemeVars,
        fontFamily:"DM Sans,system-ui,sans-serif",
        padding:"1.25rem 0",
        fontSize:14,
        color:"var(--permit-text)",
        overflowX:"hidden",
        background:"var(--permit-surface-bg)",
        transition:"background-color 180ms ease, color 180ms ease",
      }}
    >
      {modal?.type==="form" && (
        <PermitForm
          permit={modal.data}
          recentPermit={permits[0] || null}
          allPermits={permits}
          conflictMatrix={effectiveConflictMatrix}
          permitTypes={effectivePermitTypes}
          handoverShiftHours={shiftBoundaryHours}
          dependencyRules={effectiveDependencyRules}
          orgPermitDefaults={permitFormDefaults}
          permitFieldOverrides={permitFieldOverrides}
          conditionalRules={conditionalRuleOverrides}
          onSave={savePermit}
          onClose={()=>setModal(null)}
        />
      )}

      {conflictOverrideDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConflictOverrideDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="permit-conflict-override-title"
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "var(--color-background-primary,#fff)",
              borderRadius: 10,
              border: "1px solid var(--color-border-tertiary,#e5e5e5)",
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <div id="permit-conflict-override-title" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Permit conflict override required
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              {conflictOverrideDialog.permitType ? (effectivePermitTypes[conflictOverrideDialog.permitType] || effectivePermitTypes.general).label : "Permit"}
              {conflictOverrideDialog.permitLocation ? ` · ${conflictOverrideDialog.permitLocation}` : ""}
            </div>
            {Array.isArray(conflictOverrideDialog.conflicts) && conflictOverrideDialog.conflicts.length > 0 ? (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#854d0e", background: "#FFFBEB", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 10px" }}>
                Conflicting permit(s):{" "}
                {conflictOverrideDialog.conflicts
                  .map((c) => c?.permitId)
                  .filter(Boolean)
                  .slice(0, 6)
                  .join(", ")}
              </div>
            ) : null}
            <label style={{ ...ss.lbl, marginBottom: 4 }}>Override reason</label>
            <textarea
              style={{ ...ss.inp, minHeight: 84, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              value={conflictOverrideDialog.reason}
              onChange={(e) =>
                setConflictOverrideDialog((d) => (d ? { ...d, reason: e.target.value, error: "" } : d))
              }
              placeholder="Explain how this overlap will be controlled."
            />
            <label style={{ ...ss.lbl, marginBottom: 4, marginTop: 8 }}>Approver (name/role)</label>
            <input
              style={ss.inp}
              value={conflictOverrideDialog.approvedBy}
              onChange={(e) =>
                setConflictOverrideDialog((d) => (d ? { ...d, approvedBy: e.target.value, error: "" } : d))
              }
              placeholder="e.g. Area Authority"
            />
            {conflictOverrideDialog.error ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#A32D2D" }}>{conflictOverrideDialog.error}</div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={ss.btn} onClick={() => closeConflictOverrideDialog(null)}>
                Cancel
              </button>
              <button type="button" style={ss.btnO} onClick={submitConflictOverrideDialog}>
                Confirm override
              </button>
            </div>
          </div>
        </div>
      )}

      {closePermitDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setClosePermitDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-permit-title"
            style={{
              width: "100%",
              maxWidth: 440,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "var(--color-background-primary,#fff)",
              borderRadius: 10,
              border: "1px solid var(--color-border-tertiary,#e5e5e5)",
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <div id="close-permit-title" style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
              Close permit
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              {(() => {
                const p = permits.find((x) => x.id === closePermitDialog.id);
                if (!p) return null;
                return (
                  <>
                    {(effectivePermitTypes[p.type] || effectivePermitTypes.general).label}
                    {p.location ? ` · ${p.location}` : ""}
                  </>
                );
              })()}
            </div>
            <label style={{ ...ss.lbl, marginBottom: 4 }}>Lessons learned (optional)</label>
            <textarea
              style={{ ...ss.inp, minHeight: 88, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              value={closePermitDialog.lessons}
              onChange={(e) => setClosePermitDialog((d) => (d ? { ...d, lessons: e.target.value } : d))}
              placeholder="e.g. isolate earlier, extend fire watch, improve briefing…"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={ss.btn} onClick={() => setClosePermitDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                style={ss.btnR}
                onClick={() => {
                  const id = closePermitDialog.id;
                  const lessons = closePermitDialog.lessons;
                  setClosePermitDialog(null);
                  closePermit(id, lessons);
                }}
              >
                Close permit
              </button>
            </div>
          </div>
        </div>
      )}

      {handoverDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 62,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHandoverDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-handover-title"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "88vh",
              overflowY: "auto",
              background: "var(--color-background-primary,#fff)",
              borderRadius: 10,
              border: "1px solid var(--color-border-tertiary,#e5e5e5)",
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <div id="shift-handover-title" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Shift handover continuity
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              Capture what changed, remaining high-risk work, and dual supervisor acknowledgements.
            </div>
            <label style={{ ...ss.lbl, marginBottom: 4 }}>What changed since previous shift?</label>
            <textarea
              style={{ ...ss.inp, minHeight: 70, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              value={handoverDialog.whatChanged}
              onChange={(e) => setHandoverDialog((d) => (d ? { ...d, whatChanged: e.target.value, error: "" } : d))}
            />
            <label style={{ ...ss.lbl, marginBottom: 4, marginTop: 8 }}>What remains high-risk?</label>
            <textarea
              style={{ ...ss.inp, minHeight: 70, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              value={handoverDialog.remainingHighRisk}
              onChange={(e) => setHandoverDialog((d) => (d ? { ...d, remainingHighRisk: e.target.value, error: "" } : d))}
            />
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={handoverDialog.criticalControlsConfirmed === true}
                  onChange={(e) => setHandoverDialog((d) => (d ? { ...d, criticalControlsConfirmed: e.target.checked, error: "" } : d))}
                />
                Critical controls confirmed as in place
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
              <div>
                <label style={{ ...ss.lbl, marginBottom: 4 }}>Outgoing supervisor</label>
                <input
                  style={ss.inp}
                  value={handoverDialog.outgoingSupervisor}
                  onChange={(e) => setHandoverDialog((d) => (d ? { ...d, outgoingSupervisor: e.target.value, error: "" } : d))}
                  placeholder="Name / role"
                />
              </div>
              <div>
                <label style={{ ...ss.lbl, marginBottom: 4 }}>Incoming supervisor</label>
                <input
                  style={ss.inp}
                  value={handoverDialog.incomingSupervisor}
                  onChange={(e) => setHandoverDialog((d) => (d ? { ...d, incomingSupervisor: e.target.value, error: "" } : d))}
                  placeholder="Name / role"
                />
              </div>
            </div>
            {handoverDialog.error ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#A32D2D" }}>{handoverDialog.error}</div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={ss.btn} onClick={() => setHandoverDialog(null)}>
                Cancel
              </button>
              <button type="button" style={ss.btnO} onClick={submitHandoverDialog}>
                Record handover
              </button>
            </div>
          </div>
        </div>
      )}

      {isNarrow && mobileQuickPermit ? (
        <div
          style={{
            position:"fixed",
            left:0,
            right:0,
            bottom:0,
            zIndex:65,
            background:"rgba(255,255,255,0.98)",
            borderTop:"1px solid var(--color-border-tertiary,#e5e5e5)",
            boxShadow:"0 -8px 24px rgba(15,23,42,0.16)",
            padding:"10px 10px calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, minWidth:0, overflowWrap:"anywhere" }}>
              Quick actions · {mobileQuickPermit.id}
            </div>
            <button type="button" style={{ ...ss.btn, fontSize:11, padding:"2px 8px" }} onClick={() => setMobileQuickActionsPermitId("")}>
              Close
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isUltraNarrow ? "1fr" : "repeat(2,minmax(0,1fr))", gap:8 }}>
            <button type="button" style={{ ...ss.btn, fontSize:12, minHeight:38 }} onClick={() => previewPermit(mobileQuickPermit)}>
              Preview
            </button>
            <button type="button" style={{ ...ss.btn, fontSize:12, minHeight:38 }} onClick={() => setModal({ type: "form", data: mobileQuickPermit })}>
              Edit
            </button>
            <button type="button" style={{ ...ss.btn, fontSize:12, minHeight:38 }} onClick={() => openHandoverDialog(mobileQuickPermit)}>
              Shift handover
            </button>
            {derivePermitStatus(mobileQuickPermit, now) === "active" && !mobileQuickPermit.briefingConfirmedAt && mobileQuickPermit.startDateTime && (now.getTime() - new Date(mobileQuickPermit.startDateTime).getTime() > 20 * 60 * 1000) ? (
              <button type="button" style={{ ...ss.btn, fontSize:12, minHeight:38 }} onClick={() => confirmPermitBriefing(mobileQuickPermit.id)}>
                Confirm briefing
              </button>
            ) : null}
            {(mobileQuickPermit.status === "approved" || mobileQuickPermit.status === "closed" || mobileQuickPermit.status === "pending_review" || mobileQuickPermit.status === "ready_for_review") ? (
              <button type="button" style={{ ...ss.btnO, fontSize:12, minHeight:38 }} onClick={() => void activatePermit(mobileQuickPermit.id)}>
                Activate
              </button>
            ) : (
              <button type="button" style={{ ...ss.btnR, fontSize:12, minHeight:38 }} onClick={() => requestClosePermit(mobileQuickPermit.id)}>
                Close permit
              </button>
            )}
          </div>
        </div>
      ) : null}

      <PageHero
        badgeText="PTW"
        title="Permits to work"
        lead="Fifteen permit types, SIMOPS overlap checks, and change logs. Data stays on device; signed-in users also mirror permits to your cloud workspace when configured."
        right={<button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnO}>+ Issue permit</button>}
      />

      {ackTokenParam ? (
        <div className="app-panel-surface" style={{ padding: 12, borderRadius: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0C447C" }}>Contractor Read/Sign portal</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {ackPortalPermit ? "Confirm you have read this permit before work starts." : "Permit not found for this link."}
              </div>
            </div>
            <button
              type="button"
              style={{ ...ss.btn, fontSize: 11, padding: "3px 8px" }}
              onClick={() => {
                const next = new URLSearchParams(window.location.search);
                next.delete("permitAck");
                window.history.replaceState({}, "", `${window.location.pathname}?${next.toString()}`);
                setAckTokenParam("");
              }}
            >
              Close portal
            </button>
          </div>
          {ackPortalPermit ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12 }}>
                <strong>{(effectivePermitTypes[ackPortalPermit.type] || effectivePermitTypes.general).label}</strong> · {ackPortalPermit.location || "No location"} ·{" "}
                {fmtDateTime(ackPortalPermit.startDateTime)} → {fmtDateTime(permitEndIso(ackPortalPermit))}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {ackPortalPermit.description || "No description"}
              </div>
              <label style={{ ...ss.lbl, marginBottom: 0 }}>Name / email</label>
              <input
                style={ss.inp}
                value={ackActorName}
                onChange={(e) => setAckActorName(e.target.value)}
                placeholder="e.g. subcontractor@company.com"
              />
              <label style={{ ...ss.lbl, marginBottom: 0 }}>Note (optional)</label>
              <input
                style={ss.inp}
                value={ackActorNote}
                onChange={(e) => setAckActorNote(e.target.value)}
                placeholder="Optional note"
              />
              <div>
                <button type="button" style={ss.btnO} onClick={acknowledgeFromPortalLink}>
                  Confirm read & sign
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* stat cards */}
      {permits.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginBottom:20 }}>
          {[
            { label:"In review", value:stats.pendingReview, bg:"#FAEEDA", color:"#633806", filter:"pending_review" },
            { label:"Approved", value:stats.approved, bg:"#E6F1FB", color:"#0C447C", filter:"approved" },
            { label:"Suspended", value:permits.filter((p) => p.status === "suspended").length, bg:"#FCEBEB", color:"#791F1F", filter:"suspended" },
            { label:"Active", value:stats.active, bg:"#EAF3DE", color:"#27500A", filter:"active" },
            { label:"Expiring soon", value:stats.expiringSoon, bg:"#FAEEDA", color:"#633806", filter:"active" },
            { label:"Expired", value:stats.expired, bg:"#FCEBEB", color:"#791F1F", filter:"expired" },
            { label:"Closed", value:stats.closed, bg:"var(--color-background-secondary,#f7f7f5)", color:"var(--color-text-secondary)", filter:"closed" },
          ].map(c=>(
            <div
              key={c.label}
              role="button"
              tabIndex={0}
              className="app-permit-stat-tile"
              onClick={()=>setFilterStatus(c.filter)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilterStatus(c.filter);
                }
              }}
              style={{ background:c.bg, borderRadius:8, padding:"10px 12px", cursor:"pointer" }}
            >
              <div style={{ fontSize:11, color:c.color, fontWeight:500, marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {simopsRadarRows.length > 0 && (
        <div className="app-panel-surface" style={{ padding: 10, borderRadius: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>SIMOPS live radar</div>
            <span style={{ ...ss.chip, fontSize: 11 }}>{simopsRadarRows.length} active conflict zone(s)</span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {simopsRadarRows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "minmax(0,1fr) auto",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                  background:
                    row.severity === "high"
                      ? "#fff6f6"
                      : row.severity === "medium"
                      ? "#fffaf0"
                      : "var(--color-background-primary,#fff)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {row.location} · {row.permitLabel}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    {row.windowLabel}
                  </div>
                  <div style={{ fontSize: 11, color: row.severity === "high" ? "#791F1F" : row.severity === "medium" ? "#633806" : "var(--color-text-secondary)" }}>
                    Conflicts: {row.overlapCount} · {row.overlapTypes.join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize: 11, padding: "3px 8px" }}
                  onClick={() => {
                    setHighlightPermitId(row.id);
                    setFilterStatus("");
                    requestAnimationFrame(() => {
                      document.getElementById(`permit-row-${row.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    });
                  }}
                >
                  Open permit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {permits.length > 0 && (
        <div className="app-panel-surface" style={{ padding: 12, borderRadius: 10, marginBottom: 14, background: "var(--permit-panel-bg)", border: "1px solid var(--permit-panel-border)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Permit command metrics</div>
            <span style={{ ...ss.chip, fontSize:11 }}>Live snapshot</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
            <div style={{ border: "1px solid var(--permit-panel-border)", borderRadius: 8, padding: "8px 10px", background:"var(--permit-panel-bg)" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>On-time review</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{permitScorecard.reviewedOnTime}/{permitScorecard.reviewedTotal}</div>
            </div>
            <div style={{ border: "1px solid var(--permit-panel-border)", borderRadius: 8, padding: "8px 10px", background:"var(--permit-panel-bg)" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>On-time activation</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{permitScorecard.activatedOnTime}/{permitScorecard.activatedTotal}</div>
            </div>
            <div style={{ border: "1px solid var(--permit-panel-border)", borderRadius: 8, padding: "8px 10px", background:"var(--permit-panel-bg)" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Overdue queue now</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: permitScorecard.overdueQueue > 0 ? "#791F1F" : "inherit" }}>{permitScorecard.overdueQueue}</div>
            </div>
            <div style={{ border: "1px solid var(--permit-panel-border)", borderRadius: 8, padding: "8px 10px", background:"var(--permit-panel-bg)" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Avg review time</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{permitScorecard.avgReviewHours == null ? "—" : `${permitScorecard.avgReviewHours}h`}</div>
            </div>
          </div>
        </div>
      )}

      {permits.length > 0 && (
        <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16, border:"1px solid var(--permit-panel-border)", background:"var(--permit-panel-bg)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700 }}>Ops Inbox / Action Center</div>
            <span style={{ ...ss.chip, fontSize:11 }}>{opsActionItems.length} item(s)</span>
          </div>
          {opsActionItems.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No urgent actions right now.</div>
          ) : (
            <div style={{ display:"grid", gap:8 }}>
              {opsActionItems.map((item) => {
                const tone =
                  item.severity === "critical"
                    ? permitDecisionTone("critical")
                    : item.severity === "warning"
                      ? permitDecisionTone("warn")
                      : permitDecisionTone("info");
                const targetPermit = permits.find((p) => p.id === item.permitId);
                return (
                  <div key={`${item.kind}:${item.permitId}`} style={{ border:`1px solid ${tone.border}`, background:tone.bg, borderRadius:8, padding:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"flex-start", flexWrap:"wrap" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:tone.color }}>{item.title}</div>
                        <div style={{ fontSize:11, color:tone.color, marginTop:2 }}>{item.detail}</div>
                        <div style={{ fontSize:10, color:tone.color, marginTop:4, opacity:0.9 }}>Permit: {item.permitId}</div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        <button type="button" onClick={() => focusPermit(item.permitId)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                          Go to permit
                        </button>
                        <button type="button" onClick={() => focusPermit(item.permitId, { openEditor: true })} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                          Open edit
                        </button>
                        {permitNotifyEnabled && item.kind === "delivery_failed" && targetPermit ? (
                          <button type="button" onClick={() => void notifyPermitTeam(targetPermit)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                            Retry notify
                          </button>
                        ) : null}
                        {item.kind === "ack_missing" && targetPermit ? (
                          <button type="button" onClick={() => void acknowledgePermit(targetPermit)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                            Add ack
                          </button>
                        ) : null}
                        {item.kind === "briefing_missing" && targetPermit ? (
                          <button type="button" onClick={() => confirmPermitBriefing(targetPermit.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                            Confirm briefing
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700 }}>Incident capture & traceability</div>
          <span style={{ ...ss.chip, fontSize:11 }}>{openIncidents.length} open incident(s)</span>
        </div>
        {incidents.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
            No incidents linked yet. Use <strong>Report incident</strong> on any permit card.
          </div>
        ) : (
          <div style={{ display:"grid", gap:8 }}>
            {incidents.slice(0, 8).map((inc) => (
              <div key={inc.id} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700 }}>{inc.title || "Incident"}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                      {inc.severity} · permit {inc.permitId} · {fmtDateTime(inc.createdAt)}
                    </div>
                    {inc.summary ? <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>{inc.summary}</div> : null}
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    <span style={{ ...ss.chip, fontSize:11 }}>
                      {(inc.correctiveActions || []).filter((a) => a.status !== "closed").length} open action(s)
                    </span>
                    <button type="button" onClick={() => addCorrectiveActionToIncident(inc.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                      Add corrective action
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700 }}>Project plan overlay & safety map</div>
          <span style={{ ...ss.chip, fontSize:11 }}>{projectPlans.length} plan(s)</span>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <select value={planProjectId} onChange={(e) => setPlanProjectId(e.target.value)} style={{ ...ss.inp, minWidth:220 }}>
            <option value="">Select project</option>
            {load("mysafeops_projects", []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="file"
            accept={PLAN_UPLOAD_ACCEPT}
            disabled={!planProjectId}
            title={planProjectId ? "Upload plan file" : "Select a project first"}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!planProjectId) {
                window.alert("Select a project first, then upload a plan.");
                return;
              }
              try {
                await uploadProjectPlan(planProjectId, f);
              } catch (err) {
                window.alert(err?.message || String(err));
              }
            }}
          />
          <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} style={{ ...ss.inp, minWidth:220 }}>
            <option value="">Select uploaded plan</option>
            {projectPlans
              .filter((p) => !planProjectId || p.projectId === planProjectId)
              .slice(0, 80)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
          <button
            type="button"
            disabled={!selectedPlanId}
            onClick={() => appendEmergencyAsset(selectedPlanId)}
            style={{ ...ss.btn, fontSize:12, opacity: selectedPlanId ? 1 : 0.45 }}
          >
            Add emergency asset
          </button>
          <button
            type="button"
            disabled={!selectedPlanId}
            onClick={() => appendEscapeRoute(selectedPlanId)}
            style={{ ...ss.btn, fontSize:12, opacity: selectedPlanId ? 1 : 0.45 }}
          >
            Add escape route
          </button>
        </div>
        {(() => {
          const plan = projectPlans.find((p) => p.id === selectedPlanId);
          if (!plan) return <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Upload JPG/PDF plan and select it to preview.</div>;
          const planPins = incidents.filter((i) => i.planPin?.planId === plan.id);
          if (String(plan.mimeType || "").toLowerCase().includes("pdf")) {
            return (
              <div style={{ fontSize:12 }}>
                <a href={plan.dataUrl} target="_blank" rel="noreferrer">Open PDF plan</a>
                <div style={{ color:"var(--color-text-secondary)", marginTop:4 }}>
                  {planPins.length} pinned incident(s) · {(plan.escapeRoutes || []).length} route(s) · {(plan.emergencyAssets || []).length} emergency asset(s).
                </div>
              </div>
            );
          }
          return (
            <div style={{ position:"relative", border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:8, background:"var(--color-background-secondary,#f7f7f5)" }}>
              <img src={plan.dataUrl} alt={plan.name} style={{ width:"100%", maxHeight:360, objectFit:"contain", borderRadius:6 }} />
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position:"absolute", inset:8, width:"calc(100% - 16px)", height:"calc(100% - 16px)", pointerEvents:"none" }}
              >
                {(plan.escapeRoutes || []).map((r) => (
                  <g key={r.id}>
                    <line x1={r.startX} y1={r.startY} x2={r.endX} y2={r.endY} stroke="#0C447C" strokeWidth="0.9" strokeDasharray="1.5 1.2" />
                    <circle cx={r.endX} cy={r.endY} r="1.2" fill="#0C447C" />
                  </g>
                ))}
              </svg>
              {(plan.emergencyAssets || []).map((a) => (
                <div
                  key={a.id}
                  title={`${a.kind}${a.label ? ` · ${a.label}` : ""}`}
                  style={{
                    position:"absolute",
                    left:`${a.x}%`,
                    top:`${a.y}%`,
                    transform:"translate(-50%,-50%)",
                    width:12,
                    height:12,
                    borderRadius:3,
                    background:"#14532d",
                    border:"2px solid #fff",
                    boxShadow:"0 0 0 1px #14532d",
                  }}
                />
              ))}
              {planPins.map((inc) => (
                <div
                  key={inc.id}
                  title={`${inc.title || "Incident"} (${inc.severity || "incident"})`}
                  style={{
                    position:"absolute",
                    left:`${inc.planPin?.x || 0}%`,
                    top:`${inc.planPin?.y || 0}%`,
                    transform:"translate(-50%,-50%)",
                    width:14,
                    height:14,
                    borderRadius:"50%",
                    background:"#A32D2D",
                    border:"2px solid #fff",
                    boxShadow:"0 0 0 1px #A32D2D",
                  }}
                />
              ))}
              <div style={{ position:"absolute", right:12, bottom:12, fontSize:10, background:"rgba(255,255,255,0.9)", border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:6, padding:"4px 6px" }}>
                <div>Red dot: incident</div>
                <div>Green square: emergency asset</div>
                <div>Blue dashed: escape route</div>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap:12, marginBottom:16 }}>
        <div className="app-panel-surface" style={{ padding:10, borderRadius:10 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700 }}>Automation & SLA</div>
            <button type="button" onClick={exportSlaDigest} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>Export digest</button>
          </div>
          {slaQueue.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No SLA alerts right now.</div>
          ) : (
            slaQueue.slice(0, 8).map((row) => (
              <div key={row.id} style={{ fontSize:12, padding:"6px 0", borderBottom:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
                <strong>{row.title}</strong>
                <div style={{ color:"var(--color-text-secondary)" }}>{row.detail}</div>
              </div>
            ))
          )}
        </div>
        <div className="app-panel-surface" style={{ padding:10, borderRadius:10 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Risk analytics & intelligence</div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.5 }}>
            Median close time: <strong>{riskInsights.medianClosedHours}h</strong><br />
            Avg close time: <strong>{riskInsights.avgClosedHours}h</strong><br />
            Re-open events: <strong>{riskInsights.reopenCount}</strong><br />
            Incident density: <strong>{riskInsights.incidentDensity}</strong>
          </div>
          <div style={{ marginTop:8, fontSize:11 }}>
            {(riskInsights.hotspots || []).slice(0, 4).map((h) => (
              <div key={h.type} style={{ display:"flex", justifyContent:"space-between", gap:8, borderBottom:"1px solid var(--color-border-tertiary,#e5e5e5)", padding:"4px 0" }}>
                <span>{h.type}</span>
                <span>{Math.round((h.expiredRate || 0) * 100)}% expired</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Delivery observability</div>
            {deliverySummary.length === 0 ? (
              <div style={{ color:"var(--color-text-secondary)" }}>No delivery events yet.</div>
            ) : (
              deliverySummary.slice(0, 8).map((row) => (
                <div key={row.key} style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                  <span>{row.key}</span>
                  <span>{row.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:12, background:"var(--permit-panel-bg)", border:"1px solid var(--permit-panel-border)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, fontWeight:700 }}>Permit appearance theme</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <select value={permitThemeMode} onChange={(e) => setPermitThemeMode(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto", minWidth: 140 }}>
              <option value="auto">Theme: Auto</option>
              <option value="light">Theme: Light</option>
              <option value="dark">Theme: Dark</option>
            </select>
            <span style={{ fontSize:11, color:"var(--permit-text-muted)" }}>
              {permitThemeMode === "auto" ? `Using ${prefersDarkTheme ? "dark" : "light"} by system` : `Using ${permitThemeMode}`}
            </span>
          </div>
        </div>
      </div>

      {/* filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search location, worker, issuer, type…" style={{ ...ss.inp, flex:1, width: isNarrow ? "100%" : "auto", minWidth: isNarrow ? "100%" : 140 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto" }}>
          <option value="">All permit types</option>
          {Object.entries(effectivePermitTypes).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto" }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="closed">Closed</option>
          <option value="draft">Draft</option>
          <option value="pending_review">In review</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={cardDensity} onChange={(e) => setCardDensity(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto" }}>
          <option value="comfort">Density: Comfort</option>
          <option value="compact">Density: Compact</option>
          <option value="ops">Density: Ops</option>
        </select>
        <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, padding:"8px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, background:"var(--permit-panel-bg)", minHeight:38 }}>
          <input type="checkbox" checked={filterHandoverDue} onChange={(e) => setFilterHandoverDue(e.target.checked)} />
          Handover due only
        </label>
        <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, padding:"8px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, background:"var(--permit-panel-bg)", minHeight:38 }}>
          <input type="checkbox" checked={filterBlockedNow} onChange={(e) => setFilterBlockedNow(e.target.checked)} />
          Blocked now only
        </label>
        <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, padding:"8px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, background:"var(--permit-panel-bg)", minHeight:38 }}>
          <input type="checkbox" checked={filterBriefingPending} onChange={(e) => setFilterBriefingPending(e.target.checked)} />
          Briefing pending only
        </label>
        <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, padding:"8px 10px", border:"0.5px solid var(--color-border-secondary,#ccc)", borderRadius:6, background:"var(--permit-panel-bg)", minHeight:38 }}>
          <input type="checkbox" checked={filterRamsMissing} onChange={(e) => setFilterRamsMissing(e.target.checked)} />
          Missing RAMS only
        </label>
        {(search||filterType||filterStatus||filterHandoverDue||filterBlockedNow||filterBriefingPending||filterRamsMissing)&&<button type="button" onClick={()=>{setSearch("");setFilterType("");setFilterStatus("");setFilterHandoverDue(false);setFilterBlockedNow(false);setFilterBriefingPending(false);setFilterRamsMissing(false);}} style={{ ...ss.btn, fontSize:12, width: isNarrow ? "100%" : "auto" }}>Clear</button>}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16, border:"1px solid var(--permit-panel-border)", background:"var(--permit-panel-bg)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, fontWeight:700 }}>Command strip</div>
          <button
            type="button"
            onClick={() => { setSearch(""); setFilterType(""); setFilterStatus(""); setFilterHandoverDue(false); setFilterBlockedNow(false); setFilterBriefingPending(false); setFilterRamsMissing(false); }}
            style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}
          >
            Reset quick filters
          </button>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button type="button" onClick={() => setFilterStatus("active")} style={{ ...ss.btn, ...quickCountBadgeStyle("ok"), fontSize:12 }}>
            Active: {commandCounts.active}
          </button>
          <button type="button" onClick={() => setFilterStatus("pending_review")} style={{ ...ss.btn, ...quickCountBadgeStyle("warn"), fontSize:12 }}>
            In review: {commandCounts.review}
          </button>
          <button type="button" onClick={() => setFilterStatus("approved")} style={{ ...ss.btn, ...quickCountBadgeStyle("neutral"), fontSize:12 }}>
            Approved: {commandCounts.approved}
          </button>
          <button type="button" onClick={() => setFilterStatus("expired")} style={{ ...ss.btn, ...quickCountBadgeStyle("critical"), fontSize:12 }}>
            Expired: {commandCounts.expired}
          </button>
          <button
            type="button"
            onClick={() => setFilterHandoverDue((v) => !v)}
            style={{ ...ss.btn, ...quickCountBadgeStyle("warn"), fontSize:12, padding:"4px 10px", borderRadius:20, borderStyle:"dashed", opacity: filterHandoverDue ? 1 : 0.82 }}
          >
            Handover due: {commandCounts.handoverDue}
          </button>
          <button
            type="button"
            onClick={() => setFilterBlockedNow((v) => !v)}
            style={{ ...ss.btn, ...quickCountBadgeStyle("critical"), fontSize:12, padding:"4px 10px", borderRadius:20, borderStyle:"dashed", opacity: filterBlockedNow ? 1 : 0.82 }}
          >
            Blocked now: {commandCounts.blockedNow}
          </button>
          <button
            type="button"
            onClick={() => setFilterBriefingPending((v) => !v)}
            style={{ ...ss.btn, ...quickCountBadgeStyle("warn"), fontSize:12, padding:"4px 10px", borderRadius:20, borderStyle:"dashed", opacity: filterBriefingPending ? 1 : 0.82 }}
          >
            Briefing pending: {commandCounts.briefingPending}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterStatus("active");
              setFilterType("");
              setSearch("");
              setFilterRamsMissing((v) => !v);
            }}
            style={{ ...ss.btn, ...quickCountBadgeStyle("neutral"), fontSize:12, padding:"4px 10px", borderRadius:20, borderStyle:"dashed", opacity: filterRamsMissing ? 1 : 0.9 }}
          >
            Active without RAMS: {commandCounts.ramsMissing}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <button type="button" onClick={saveCurrentView} style={{ ...ss.btn, fontSize:12 }}>
          Save current view
        </button>
        {savedViews.length === 0 ? (
          <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No saved views yet.</span>
        ) : (
          savedViews.map((v) => (
            <div key={v.id} style={{ display:"inline-flex", alignItems:"center", gap:4, maxWidth: isNarrow ? "100%" : 280 }}>
              <button type="button" onClick={() => applySavedView(v)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px", overflowWrap:"anywhere" }}>
                {v.name}
              </button>
              <button type="button" onClick={() => deleteSavedView(v.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 6px", color:"#A32D2D", borderColor:"#F09595" }} aria-label={`Delete view ${v.name}`}>
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Conditional rules builder v2 (visual IF/AND/OR)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Build conditions visually using multiple IF clauses with ALL/ANY logic, then apply required/optional/show/hide/block.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={addConditionalRuleRow} style={{ ...ss.btnO, fontSize:12 }}>
              + Add rule
            </button>
            <button type="button" onClick={resetConditionalRules} style={{ ...ss.btn, fontSize:12 }}>
              Reset all
            </button>
          </div>
        </div>
        {conditionalRuleOverrides.length === 0 ? (
          <div style={{ marginTop:10, fontSize:12, color:"var(--color-text-secondary)" }}>
            No rules yet. Add first IF/THEN rule to automate permit form behavior.
          </div>
        ) : (
          <div style={{ marginTop:10, display:"grid", gap:8 }}>
            {conditionalRuleOverrides.map((rule) => (
              <div key={rule.id} style={{ border:"1px solid var(--permit-panel-border)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ display:"grid", gap:8 }}>
                  <div style={{ display:"grid", gap:8 }}>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                      <label style={{ ...ss.lbl, marginBottom:0 }}>IF logic</label>
                      <select
                        value={rule.whenOperator || "and"}
                        onChange={(e) => updateConditionalRuleRow(rule.id, { whenOperator: e.target.value })}
                        style={{ ...ss.inp, width: 140 }}
                      >
                        <option value="and">ALL (AND)</option>
                        <option value="or">ANY (OR)</option>
                      </select>
                      <button type="button" onClick={() => addConditionalClause(rule.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                        + Add IF clause
                      </button>
                      <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, minHeight:38 }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled !== false}
                          onChange={(e) => updateConditionalRuleRow(rule.id, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                    </div>
                    {(Array.isArray(rule.whenClauses) ? rule.whenClauses : []).map((clause, idx) => (
                      <div key={`${rule.id}_clause_${idx}`} style={{ display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "minmax(0,150px) minmax(0,1fr) auto", gap:8, alignItems:"center" }}>
                        <select
                          value={clause.field || "permitType"}
                          onChange={(e) => updateConditionalClause(rule.id, idx, { field: e.target.value, value: "" })}
                          style={ss.inp}
                        >
                          <option value="permitType">Permit type</option>
                          <option value="status">Status</option>
                          <option value="projectId">Project</option>
                        </select>
                        {clause.field === "permitType" ? (
                          <select
                            value={clause.value || ""}
                            onChange={(e) => updateConditionalClause(rule.id, idx, { value: e.target.value })}
                            style={ss.inp}
                          >
                            <option value="">Any permit type</option>
                            {Object.entries(effectivePermitTypes).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        ) : clause.field === "status" ? (
                          <select
                            value={clause.value || ""}
                            onChange={(e) => updateConditionalClause(rule.id, idx, { value: e.target.value })}
                            style={ss.inp}
                          >
                            <option value="">Any status</option>
                            {WORKFLOW_STATES.map((state) => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={clause.value || ""}
                            onChange={(e) => updateConditionalClause(rule.id, idx, { value: e.target.value })}
                            style={ss.inp}
                          >
                            <option value="">Any project</option>
                            {load("mysafeops_projects", []).slice(0, 300).map((p) => (
                              <option key={p.id} value={p.id}>{p.name || p.id}</option>
                            ))}
                          </select>
                        )}
                        <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                          <button type="button" onClick={() => moveConditionalClause(rule.id, idx, "up")} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} disabled={idx === 0}>↑</button>
                          <button type="button" onClick={() => moveConditionalClause(rule.id, idx, "down")} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} disabled={idx === (rule.whenClauses || []).length - 1}>↓</button>
                          <button type="button" onClick={() => removeConditionalClause(rule.id, idx)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px", color:"#A32D2D", borderColor:"#F09595" }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "repeat(3,minmax(0,1fr))", gap:8 }}>
                    <div>
                      <label style={{ ...ss.lbl, marginBottom:4 }}>THEN action</label>
                      <select value={rule.action || "required"} onChange={(e) => updateConditionalRuleRow(rule.id, { action: e.target.value })} style={ss.inp}>
                        <option value="required">Set required</option>
                        <option value="optional">Set optional</option>
                        <option value="show">Show field</option>
                        <option value="hide">Hide field</option>
                        <option value="block">Block issue</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...ss.lbl, marginBottom:4 }}>THEN field</label>
                      <select value={rule.thenField || ""} onChange={(e) => updateConditionalRuleRow(rule.id, { thenField: e.target.value })} style={ss.inp}>
                        {PERMIT_FIELD_CATALOG.map((field) => (
                          <option key={field.id} value={field.id}>{field.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...ss.lbl, marginBottom:4 }}>Block message (optional)</label>
                      <input
                        value={rule.message || ""}
                        onChange={(e) => updateConditionalRuleRow(rule.id, { message: e.target.value })}
                        placeholder="Shown when action = block"
                        style={ss.inp}
                      />
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                      Rule ID: {rule.id}
                    </span>
                    <button type="button" onClick={() => removeConditionalRuleRow(rule.id)} style={{ ...ss.btn, fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>
                      Remove rule
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>No-code form fields editor (MVP)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Configure required/optional, helper text, placeholder, and max length for permit fields without JSON.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={resetFieldSettingsForType} style={{ ...ss.btn, fontSize:12 }}>
              Reset selected
            </button>
            <button type="button" onClick={resetAllFieldSettings} style={{ ...ss.btn, fontSize:12 }}>
              Reset all
            </button>
          </div>
        </div>
        <div style={{ marginTop:10, display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "minmax(0,220px) minmax(0,1fr)", gap:8 }}>
          <div style={{ display:"grid", gap:8, alignContent:"start" }}>
            <div>
              <label style={ss.lbl}>Target permit type</label>
              <select value={fieldEditorType} onChange={(e) => setFieldEditorType(e.target.value)} style={ss.inp}>
                <option value="_all">All permit types (baseline)</option>
                {Object.entries(effectivePermitTypes).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={ss.lbl}>Filter fields</label>
              <input
                value={fieldEditorFilter}
                onChange={(e) => setFieldEditorFilter(e.target.value)}
                placeholder="Search by label, id, section..."
                style={ss.inp}
              />
            </div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Active overrides: {Object.keys(permitFieldOverrides[String(fieldEditorType || "_all").toLowerCase()] || {}).length}
            </div>
          </div>
          <div style={{ display:"grid", gap:8 }}>
            {PERMIT_FIELD_CATALOG
              .filter((field) => {
                const q = String(fieldEditorFilter || "").trim().toLowerCase();
                if (!q) return true;
                return (
                  field.id.toLowerCase().includes(q) ||
                  field.section.toLowerCase().includes(q) ||
                  field.label.toLowerCase().includes(q)
                );
              })
              .map((field) => {
                const cfg = activeFieldConfig[field.id] || field;
                return (
                  <div key={field.id} style={{ border:"1px solid var(--permit-panel-border)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700 }}>{field.label}</div>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{field.section} · {field.id} · {field.type}</div>
                      </div>
                      <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(cfg.required)}
                          onChange={(e) => updatePermitFieldSetting(field.id, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:isUltraNarrow ? "1fr" : "repeat(2,minmax(0,1fr))", gap:8 }}>
                      <div>
                        <label style={{ ...ss.lbl, marginBottom:4 }}>Placeholder</label>
                        <input
                          value={cfg.placeholder || ""}
                          onChange={(e) => updatePermitFieldSetting(field.id, { placeholder: e.target.value })}
                          style={ss.inp}
                        />
                      </div>
                      <div>
                        <label style={{ ...ss.lbl, marginBottom:4 }}>Max length</label>
                        <input
                          type="number"
                          min={20}
                          max={5000}
                          value={cfg.maxLength || ""}
                          onChange={(e) => updatePermitFieldSetting(field.id, { maxLength: Number(e.target.value || 0) })}
                          style={ss.inp}
                        />
                      </div>
                      <div style={{ gridColumn:"1/-1" }}>
                        <label style={{ ...ss.lbl, marginBottom:4 }}>Helper text</label>
                        <input
                          value={cfg.helpText || ""}
                          onChange={(e) => updatePermitFieldSetting(field.id, { helpText: e.target.value })}
                          style={ss.inp}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Permit form company defaults</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Baseline defaults for new permits: people, text templates, signature policy, and required evidence toggles.
            </div>
          </div>
          <button type="button" onClick={resetPermitFormDefaults} style={{ ...ss.btn, fontSize:12 }}>
            Reset defaults
          </button>
        </div>
        <div style={{ marginTop:10, display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "repeat(2,minmax(0,1fr))", gap:8 }}>
          <div>
            <label style={ss.lbl}>Default issued by</label>
            <input
              value={permitFormDefaults.defaultIssuedBy}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, defaultIssuedBy: e.target.value }))}
              placeholder="e.g. John Smith — Site manager"
              style={ss.inp}
            />
          </div>
          <div>
            <label style={ss.lbl}>Default issued to</label>
            <input
              value={permitFormDefaults.defaultIssuedTo}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, defaultIssuedTo: e.target.value }))}
              placeholder="e.g. Internal maintenance team"
              style={ss.inp}
            />
          </div>
          <div>
            <label style={ss.lbl}>Default authorising role / competency</label>
            <input
              value={permitFormDefaults.defaultAuthorisingRole}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, defaultAuthorisingRole: e.target.value }))}
              placeholder="e.g. AP electrical, lifting supervisor"
              style={ss.inp}
            />
          </div>
          <div>
            <label style={ss.lbl}>Default validity (hours)</label>
            <input
              type="number"
              min={1}
              max={24}
              value={permitFormDefaults.defaultValidityHours}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, defaultValidityHours: Number(e.target.value || 8) }))}
              style={ss.inp}
            />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Default signature policy</label>
            <select
              value={permitFormDefaults.signaturePolicy}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, signaturePolicy: e.target.value === "required_now" ? "required_now" : "allow_later" }))}
              style={ss.inp}
            >
              <option value="allow_later">Allow issue and collect signatures later</option>
              <option value="required_now">Require signatures before issue</option>
            </select>
          </div>
          <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12 }}>
            <input
              type="checkbox"
              checked={permitFormDefaults.requireBriefingBeforeIssue}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, requireBriefingBeforeIssue: e.target.checked }))}
            />
            Require briefing timestamp before issue
          </label>
          <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12 }}>
            <input
              type="checkbox"
              checked={permitFormDefaults.requireEvidencePhotoBeforeIssue}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, requireEvidencePhotoBeforeIssue: e.target.checked }))}
            />
            Require evidence photo before issue
          </label>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Default additional conditions template</label>
            <textarea
              value={permitFormDefaults.defaultConditionsTemplate}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, defaultConditionsTemplate: e.target.value }))}
              style={{ ...ss.ta, minHeight:64 }}
              placeholder="Standard restrictions and controls used by your company..."
            />
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Default evidence notes template</label>
            <textarea
              value={permitFormDefaults.defaultEvidenceNotesTemplate}
              onChange={(e) => setPermitFormDefaults((d) => ({ ...d, defaultEvidenceNotesTemplate: e.target.value }))}
              style={{ ...ss.ta, minHeight:64 }}
              placeholder="Standard evidence wording for toolbox/barriers/LOTO references..."
            />
          </div>
        </div>
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Permit conflict matrix (org overrides)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Baseline rules + your org overrides. Active overrides: {Object.keys(conflictMatrixOverrides || {}).length}.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={openConflictMatrixEditor} style={{ ...ss.btn, fontSize:12 }}>
              Edit overrides (JSON)
            </button>
            <button type="button" onClick={resetConflictMatrixOverrides} style={{ ...ss.btn, fontSize:12 }}>
              Reset overrides
            </button>
          </div>
        </div>
        {conflictMatrixEditorOpen ? (
          <div style={{ marginTop:10 }}>
            <label style={{ ...ss.lbl, marginBottom:4 }}>Overrides JSON (key: typeA+typeB)</label>
            <textarea
              style={{ ...ss.ta, minHeight:140 }}
              value={conflictMatrixEditorText}
              onChange={(e) => {
                setConflictMatrixEditorText(e.target.value);
                setConflictMatrixEditorError("");
              }}
              spellCheck={false}
            />
            {conflictMatrixEditorError ? (
              <div style={{ marginTop:6, fontSize:12, color:"#A32D2D" }}>{conflictMatrixEditorError}</div>
            ) : null}
            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <button type="button" onClick={() => setConflictMatrixEditorOpen(false)} style={{ ...ss.btn, fontSize:12 }}>
                Cancel
              </button>
              <button type="button" onClick={applyConflictMatrixOverridesFromEditor} style={{ ...ss.btnO, fontSize:12 }}>
                Apply overrides
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Permit type appearance (org overrides)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Override label, colors, and description per permit type. Active overrides: {Object.keys(permitTypeOverrides || {}).length}.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={() => setPermitTypeEditorOpen((v) => !v)} style={{ ...ss.btn, fontSize:12 }}>
              {permitTypeEditorOpen ? "Hide editor" : "Edit overrides"}
            </button>
            <button type="button" onClick={resetAllPermitTypeOverrides} style={{ ...ss.btn, fontSize:12 }}>
              Reset all
            </button>
          </div>
        </div>
        {permitTypeEditorOpen ? (
          <div style={{ marginTop:10, display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "repeat(2,minmax(0,1fr))", gap:8 }}>
            <div style={{ display:"grid", gap:8, alignContent:"start" }}>
              <label style={ss.lbl}>Permit type</label>
              <select value={permitTypeEditorType} onChange={(e) => setPermitTypeEditorType(e.target.value)} style={ss.inp}>
                {Object.entries(effectivePermitTypes).map(([k,v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <label style={ss.lbl}>Display label</label>
              <input value={permitTypeEditorDraft.label} onChange={(e) => setPermitTypeEditorDraft((d) => ({ ...d, label: e.target.value }))} style={ss.inp} />
              <label style={ss.lbl}>Description</label>
              <textarea value={permitTypeEditorDraft.description} onChange={(e) => setPermitTypeEditorDraft((d) => ({ ...d, description: e.target.value }))} style={{ ...ss.ta, minHeight:70 }} />
              <div style={{ display:"grid", gridTemplateColumns: isUltraNarrow ? "1fr" : "repeat(2,minmax(0,1fr))", gap:8 }}>
                <div>
                  <label style={ss.lbl}>Text color</label>
                  <input value={permitTypeEditorDraft.color} onChange={(e) => setPermitTypeEditorDraft((d) => ({ ...d, color: e.target.value }))} placeholder="#9A3412" style={ss.inp} />
                </div>
                <div>
                  <label style={ss.lbl}>Background color</label>
                  <input value={permitTypeEditorDraft.bg} onChange={(e) => setPermitTypeEditorDraft((d) => ({ ...d, bg: e.target.value }))} placeholder="#FFEDD5" style={ss.inp} />
                </div>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button type="button" onClick={savePermitTypeOverride} style={{ ...ss.btnO, fontSize:12 }}>Save override</button>
                <button type="button" onClick={resetPermitTypeOverride} style={{ ...ss.btn, fontSize:12 }}>Reset type</button>
              </div>
            </div>
            <div className="app-panel-surface" style={{ padding:10, borderRadius:10, border:"1px solid #e5e7eb" }}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>Preview</div>
              <div style={{ display:"inline-flex", alignItems:"center", padding:"4px 10px", borderRadius:999, fontSize:12, fontWeight:700, color: permitTypeEditorDraft.color || "#9A3412", background: permitTypeEditorDraft.bg || "#FFEDD5" }}>
                {permitTypeEditorDraft.label || "Permit label"}
              </div>
              <div style={{ marginTop:8, fontSize:12, color:"var(--color-text-secondary)", whiteSpace:"pre-wrap" }}>
                {permitTypeEditorDraft.description || "No description set."}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Shift handover settings (org)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Shift boundaries used to flag active permits with missing handover acknowledgements.
            </div>
          </div>
          <span style={{ ...ss.chip, fontSize:11 }}>
            Current: {shiftBoundaryHours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")}
          </span>
        </div>
        <div style={{ marginTop:10, display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "minmax(0,1fr) auto", gap:8, alignItems:"end" }}>
          <div>
            <label style={{ ...ss.lbl, marginBottom:4 }}>Boundary hours (0-23, comma separated)</label>
            <input
              value={shiftBoundaryHoursDraft}
              onChange={(e) => {
                setShiftBoundaryHoursDraft(e.target.value);
                setShiftBoundaryHoursError("");
              }}
              placeholder="e.g. 6, 18"
              style={ss.inp}
            />
            {shiftBoundaryHoursError ? (
              <div style={{ marginTop:6, fontSize:12, color:"#A32D2D" }}>{shiftBoundaryHoursError}</div>
            ) : null}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={applyShiftBoundaryHours} style={{ ...ss.btnO, fontSize:12 }}>
              Apply
            </button>
            <button type="button" onClick={resetShiftBoundaryHours} style={{ ...ss.btn, fontSize:12 }}>
              Reset default
            </button>
          </div>
        </div>
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Workflow policy designer (org overrides)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Control which status transitions are allowed. Overrides: {Object.keys(workflowPolicyOverrides || {}).length}.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={openWorkflowPolicyEditor} style={{ ...ss.btn, fontSize:12 }}>
              {workflowEditorOpen ? "Hide JSON editor" : "Advanced JSON"}
            </button>
            <button type="button" onClick={resetWorkflowPolicyOverrides} style={{ ...ss.btn, fontSize:12 }}>
              Reset overrides
            </button>
          </div>
        </div>
        <div style={{ marginTop:10, display:"grid", gap:8 }}>
          {WORKFLOW_STATES.map((from) => (
            <div key={`wf-${from}`} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:6 }}>
                {from} -&gt; allowed next states
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {WORKFLOW_STATES.map((to) => {
                  const enabled = (effectiveWorkflowPolicy[from] || []).includes(to);
                  return (
                    <button
                      key={`wf-${from}-${to}`}
                      type="button"
                      onClick={() => toggleWorkflowTransitionRule(from, to)}
                      style={{
                        ...ss.btn,
                        fontSize:11,
                        padding:"3px 8px",
                        borderColor: enabled ? "var(--color-accent,#0d9488)" : undefined,
                        background: enabled ? "var(--color-accent-muted,#ccfbf1)" : undefined,
                        color: enabled ? "#0f766e" : undefined,
                      }}
                    >
                      {to}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {workflowEditorOpen ? (
          <div style={{ marginTop:10 }}>
            <label style={{ ...ss.lbl, marginBottom:4 }}>Workflow overrides JSON (state -&gt; allowed next states[])</label>
            <textarea
              style={{ ...ss.ta, minHeight:160 }}
              value={workflowEditorText}
              onChange={(e) => {
                setWorkflowEditorText(e.target.value);
                setWorkflowEditorError("");
              }}
              spellCheck={false}
            />
            {workflowEditorError ? (
              <div style={{ marginTop:6, fontSize:12, color:"#A32D2D" }}>{workflowEditorError}</div>
            ) : null}
            <div style={{ marginTop:8, fontSize:11, color:"var(--color-text-secondary)" }}>
              Example: {`{"approved":["issued","closed"],"suspended":["issued","closed"]}`}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <button type="button" onClick={() => setWorkflowEditorOpen(false)} style={{ ...ss.btn, fontSize:12 }}>
                Cancel
              </button>
              <button type="button" onClick={applyWorkflowPolicyOverrides} style={{ ...ss.btnO, fontSize:12 }}>
                Apply overrides
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Workflow role policy (org overrides)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Control which roles can execute each target transition. Current role: <strong>{appRole}</strong>.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={openWorkflowRolePolicyEditor} style={{ ...ss.btn, fontSize:12 }}>
              {workflowRoleEditorOpen ? "Hide JSON editor" : "Advanced JSON"}
            </button>
            <button type="button" onClick={resetWorkflowRolePolicyOverrides} style={{ ...ss.btn, fontSize:12 }}>
              Reset overrides
            </button>
          </div>
        </div>
        <div style={{ marginTop:10, display:"grid", gap:8 }}>
          {WORKFLOW_STATES.map((target) => (
            <div key={`role-${target}`} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:6 }}>{target} - allowed roles</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {WORKFLOW_ROLES.map((roleName) => {
                  const enabled = (effectiveWorkflowRolePolicy[target] || []).includes(roleName);
                  return (
                    <label key={`role-${target}-${roleName}`} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12 }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleWorkflowRolePermission(target, roleName)}
                      />
                      {roleName}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {workflowRoleEditorOpen ? (
          <div style={{ marginTop:10 }}>
            <label style={{ ...ss.lbl, marginBottom:4 }}>Role policy JSON (target state -&gt; allowed roles[])</label>
            <textarea
              style={{ ...ss.ta, minHeight:130 }}
              value={workflowRoleEditorText}
              onChange={(e) => {
                setWorkflowRoleEditorText(e.target.value);
                setWorkflowRoleEditorError("");
              }}
              spellCheck={false}
            />
            {workflowRoleEditorError ? <div style={{ marginTop:6, fontSize:12, color:"#A32D2D" }}>{workflowRoleEditorError}</div> : null}
            <div style={{ marginTop:8, fontSize:11, color:"var(--color-text-secondary)" }}>
              Example: {`{"approved":["admin","supervisor"],"issued":["admin","supervisor"],"closed":["admin"]}`}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <button type="button" onClick={() => setWorkflowRoleEditorOpen(false)} style={{ ...ss.btn, fontSize:12 }}>Cancel</button>
              <button type="button" onClick={applyWorkflowRolePolicyOverrides} style={{ ...ss.btnO, fontSize:12 }}>Apply overrides</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Permit dependency rules (org overrides)</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Require active dependency permits before activation for selected permit types.
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={openDependencyRuleEditor} style={{ ...ss.btn, fontSize:12 }}>
              {dependencyEditorOpen ? "Hide JSON editor" : "Advanced JSON"}
            </button>
            <button type="button" onClick={resetDependencyRuleOverrides} style={{ ...ss.btn, fontSize:12 }}>
              Reset overrides
            </button>
          </div>
        </div>
        <div style={{ marginTop:10, display:"grid", gap:8 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <label style={ss.lbl}>Permit type</label>
            <select value={dependencyEditorType} onChange={(e) => setDependencyEditorType(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto", minWidth:180 }}>
              {Object.entries(effectivePermitTypes).map(([k, v]) => (
                <option key={`dep-type-${k}`} value={k}>{v.label}</option>
              ))}
            </select>
            <button type="button" onClick={addDependencyRuleRow} style={{ ...ss.btn, fontSize:12 }}>
              + Add dependency
            </button>
          </div>
          {(dependencyRuleOverrides[dependencyEditorType] || []).length === 0 ? (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No dependency rules for this permit type.</div>
          ) : (
            (dependencyRuleOverrides[dependencyEditorType] || []).map((row, idx) => (
              <div key={`dep-row-${dependencyEditorType}-${idx}`} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px", display:"grid", gap:8 }}>
                <div style={{ display:"grid", gridTemplateColumns:isNarrow ? "1fr" : "minmax(0,220px) minmax(0,1fr) auto", gap:8, alignItems:"end" }}>
                  <div>
                    <label style={ss.lbl}>Requires active type</label>
                    <select
                      value={row.requiresActiveType || ""}
                      onChange={(e) => updateDependencyRuleRow(dependencyEditorType, idx, { requiresActiveType: e.target.value })}
                      style={ss.inp}
                    >
                      {Object.entries(effectivePermitTypes)
                        .filter(([k]) => k !== dependencyEditorType)
                        .map(([k, v]) => <option key={`dep-req-${dependencyEditorType}-${k}`} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={ss.lbl}>Reason (shown on gate block)</label>
                    <input
                      value={row.reason || ""}
                      onChange={(e) => updateDependencyRuleRow(dependencyEditorType, idx, { reason: e.target.value })}
                      style={ss.inp}
                      placeholder="Explain why dependency is required"
                    />
                  </div>
                  <button type="button" onClick={() => removeDependencyRuleRow(dependencyEditorType, idx)} style={{ ...ss.btn, fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {dependencyEditorOpen ? (
          <div style={{ marginTop:10 }}>
            <label style={{ ...ss.lbl, marginBottom:4 }}>Dependency rules JSON (permit type -&gt; dependencies[])</label>
            <textarea
              style={{ ...ss.ta, minHeight:140 }}
              value={dependencyEditorText}
              onChange={(e) => {
                setDependencyEditorText(e.target.value);
                setDependencyEditorError("");
              }}
              spellCheck={false}
            />
            {dependencyEditorError ? <div style={{ marginTop:6, fontSize:12, color:"#A32D2D" }}>{dependencyEditorError}</div> : null}
            <div style={{ marginTop:8, fontSize:11, color:"var(--color-text-secondary)" }}>
              Example: {`{"confined_space":[{"requiresActiveType":"loto","reason":"Confined space entry requires active LOTOTO isolation permit."}]}`}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <button type="button" onClick={() => setDependencyEditorOpen(false)} style={{ ...ss.btn, fontSize:12 }}>Cancel</button>
              <button type="button" onClick={applyDependencyRuleOverrides} style={{ ...ss.btnO, fontSize:12 }}>Apply overrides</button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="app-panel-surface"
        style={{
          padding:10,
          borderRadius:10,
          marginBottom:16,
          position: isNarrow ? "static" : "sticky",
          bottom: isNarrow ? undefined : 8,
          zIndex: 12,
          boxShadow: hasSelectedPermits ? "0 8px 24px rgba(15,23,42,0.14)" : "none",
          border: hasSelectedPermits ? "1px solid var(--permit-info-border)" : undefined,
          background: hasSelectedPermits ? "var(--permit-panel-bg)" : undefined,
        }}
      >
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", minWidth:0, width: isNarrow ? "100%" : "auto" }}>
            <button type="button" onClick={toggleSelectAllFiltered} style={{ ...ss.btn, fontSize:12 }}>
              {allFilteredSelected ? "Unselect filtered" : "Select filtered"}
            </button>
            <button type="button" onClick={clearPermitSelection} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Clear selection
            </button>
            <span style={{ ...ss.chip, fontSize:11 }}>{selectedPermits.length} selected</span>
            {hasSelectedPermits ? (
              <span style={{ fontSize:11, color:"var(--color-text-secondary)", overflowWrap:"anywhere", width: isUltraNarrow ? "100%" : "auto" }}>
                Activate ready: {selectedActivationSummary.activatable}
                {selectedActivationSummary.warn > 0 ? ` · warn override: ${selectedActivationSummary.warn}` : ""}
                {selectedActivationSummary.blocked > 0 ? ` · blocked: ${selectedActivationSummary.blocked}` : ""}
              </span>
            ) : null}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isUltraNarrow ? "1fr" : isNarrow ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,max-content))",
              gap: 8,
              width: isNarrow ? "100%" : "auto",
            }}
          >
            <button type="button" onClick={bulkApproveSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Approve selected" : "Bulk approve"}
            </button>
            <button type="button" onClick={() => void bulkActivateSelected()} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Activate selected" : "Bulk activate"}
            </button>
            <button type="button" onClick={bulkCloseSelected} disabled={!hasSelectedPermits} style={{ ...ss.btnR, fontSize:12, minHeight:38, padding:"6px 10px", opacity: hasSelectedPermits ? 1 : 0.45, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Close selected" : "Bulk close"}
            </button>
            <button type="button" onClick={bulkSetIssuerSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Set issuer" : "Bulk set issuer"}
            </button>
            <button type="button" onClick={bulkTagSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Add tag" : "Bulk add tag"}
            </button>
            <button type="button" onClick={bulkExportSelectedCsv} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Export CSV" : "Export selected CSV"}
            </button>
            <button type="button" onClick={bulkExportSitePackV2} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Site pack" : "Site pack v2"}
            </button>
            <button type="button" onClick={bulkDeleteSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, color:"#A32D2D", borderColor:"#F09595", opacity: hasSelectedPermits ? 1 : 0.45, minHeight: 38, width: isNarrow ? "100%" : "auto", whiteSpace:"normal", lineHeight:1.2 }}>
              {isUltraNarrow ? "Delete" : "Delete selected"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {availableViewModes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setViewMode(mode);
              trackEvent("permit_view_changed", { mode });
            }}
            style={{
              ...ss.btn,
              fontSize:12,
              background: viewMode === mode ? "var(--color-background-secondary,#f7f7f5)" : "var(--color-background-primary,#fff)",
              borderColor: viewMode === mode ? "var(--color-accent,#0d9488)" : "var(--color-border-secondary,#ccc)",
            }}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
        {effectiveViewMode === "wall" ? (
          <button
            type="button"
            onClick={() => void toggleWallFullscreen()}
            style={{ ...ss.btn, fontSize:12 }}
          >
            {wallFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        ) : null}
      </div>

      <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:6, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, fontWeight:600 }}>Integration adapters (AI/Automation readiness)</div>
          <span style={{ ...ss.chip, fontSize:11 }}>Hybrid mode</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8 }}>
          {integrationAdapters.map((row) => (
            <div key={row.channel} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"6px 8px", fontSize:12 }}>
              <strong>{row.channel}</strong>
              <div style={{ color:"var(--color-text-secondary)", marginTop:2 }}>{row.enabled ? "enabled" : "placeholder"}</div>
              <div style={{ color:"var(--color-text-secondary)", marginTop:2 }}>{row.note}</div>
            </div>
          ))}
        </div>
      </div>

      {supabase && (
        <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
            <div style={{ fontSize:12, fontWeight:600 }}>Cloud permit audit trail</div>
            <button type="button" onClick={() => setAuditOpen((v) => !v)} style={{ ...ss.btn, fontSize:12 }}>
              {auditOpen ? "Hide audit" : "Show audit"}
            </button>
          </div>

          {auditOpen && (
            <>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10, marginBottom:10 }}>
                <select
                  value={auditPermitId}
                  onChange={(e) => setAuditPermitId(e.target.value)}
                  style={{ ...ss.inp, width: isNarrow ? "100%" : "auto", flex: isNarrow ? undefined : 1, minWidth: isNarrow ? "100%" : 220 }}
                >
                  <option value="">All permits</option>
                  {permits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} - {(effectivePermitTypes[p.type] || effectivePermitTypes.general).label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void loadAuditRows()} style={{ ...ss.btn, fontSize:12 }}>
                  Refresh
                </button>
                <button type="button" onClick={exportAuditCsv} disabled={!auditRows.length || auditLoading} style={{ ...ss.btn, fontSize:12, opacity: auditRows.length && !auditLoading ? 1 : 0.5 }}>
                  Export current page CSV
                </button>
                <button type="button" onClick={() => void exportAllAuditCsv()} disabled={auditLoading} style={{ ...ss.btn, fontSize:12, opacity: auditLoading ? 0.6 : 1 }}>
                  Export full CSV
                </button>
                <button
                  type="button"
                  onClick={() => void exportAuditCsvViaServer()}
                  disabled={auditServerExportBusy}
                  style={{ ...ss.btn, fontSize:12, opacity: auditServerExportBusy ? 0.6 : 1 }}
                >
                  {auditServerExportBusy ? "Exporting via server…" : "Export via server"}
                </button>
                <label style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:"var(--color-text-secondary)" }}>
                  <input type="checkbox" checked={auditAutoRefresh} onChange={(e) => setAuditAutoRefresh(e.target.checked)} />
                  Auto-refresh
                </label>
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                {AUDIT_ACTION_OPTIONS.map((action) => {
                  const on = auditActions.includes(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => toggleAuditAction(action)}
                      style={{
                        ...ss.btn,
                        fontSize:11,
                        padding:"3px 8px",
                        background: on ? "var(--color-background-secondary,#f7f7f5)" : "var(--color-background-primary,#fff)",
                        borderColor: on ? "var(--color-accent,#0d9488)" : "var(--color-border-secondary,#ccc)",
                      }}
                    >
                      {action}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAuditActions([])}
                  style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}
                  disabled={auditActions.length === 0}
                >
                  Clear actions
                </button>
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                {[
                  { id: "today", label: "Today" },
                  { id: "7d", label: "Last 7d" },
                  { id: "30d", label: "Last 30d" },
                  { id: "all", label: "All time" },
                ].map((p) => (
                  <button key={p.id} type="button" onClick={() => applyAuditDatePreset(p.id)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                <div style={{ minWidth: isNarrow ? "100%" : 170 }}>
                  <label style={{ ...ss.lbl, fontSize:11 }}>From date</label>
                  <input
                    type="date"
                    value={auditFromDate}
                    onChange={(e) => setAuditFromDate(e.target.value)}
                    style={{ ...ss.inp, width:"100%" }}
                  />
                </div>
                <div style={{ minWidth: isNarrow ? "100%" : 170 }}>
                  <label style={{ ...ss.lbl, fontSize:11 }}>To date</label>
                  <input
                    type="date"
                    value={auditToDate}
                    onChange={(e) => setAuditToDate(e.target.value)}
                    style={{ ...ss.inp, width:"100%" }}
                  />
                </div>
                {(auditFromDate || auditToDate) ? (
                  <button type="button" onClick={() => { setAuditFromDate(""); setAuditToDate(""); }} style={{ ...ss.btn, fontSize:12, alignSelf:"flex-end" }}>
                    Clear dates
                  </button>
                ) : null}
              </div>

              {auditError ? (
                <div style={{ fontSize:12, color:"#A32D2D", marginBottom:8 }}>Audit error: {auditError}</div>
              ) : null}
              {auditExportNotice ? (
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>{auditExportNotice}</div>
              ) : null}

              {isNarrow ? (
                <div style={{ display:"grid", gap:8 }}>
                  {auditLoading ? (
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Loading audit…</div>
                  ) : auditRows.length === 0 ? (
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No cloud audit rows yet.</div>
                  ) : (
                    auditRows.map((row) => (
                      <div key={row.id} style={{ border:"1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:8 }}>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{fmtDateTime(row.occurred_at)}</div>
                        <div style={{ fontSize:12, fontWeight:600, marginTop:2 }}>{auditActionLabel(row)}</div>
                        <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>
                          Permit:{" "}
                          <button
                            type="button"
                            onClick={() => jumpToPermitFromAudit(row.permit_id)}
                            style={{ padding:"1px 6px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-secondary,#f7f7f5)", fontSize:11, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}
                          >
                            {row.permit_id}
                          </button>
                          {row.detail?.location ? ` · ${row.detail.location}` : ""}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", minWidth:760, borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign:"left", padding:"6px 8px" }}>When</th>
                        <th style={{ textAlign:"left", padding:"6px 8px" }}>Permit</th>
                        <th style={{ textAlign:"left", padding:"6px 8px" }}>Action</th>
                        <th style={{ textAlign:"left", padding:"6px 8px" }}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLoading ? (
                        <tr><td colSpan={4} style={{ padding:"8px 8px", color:"var(--color-text-secondary)" }}>Loading audit…</td></tr>
                      ) : auditRows.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding:"8px 8px", color:"var(--color-text-secondary)" }}>No cloud audit rows yet.</td></tr>
                      ) : (
                        auditRows.map((row) => (
                          <tr key={row.id} style={{ borderTop:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
                            <td style={{ padding:"6px 8px", whiteSpace:"nowrap" }}>{fmtDateTime(row.occurred_at)}</td>
                            <td style={{ padding:"6px 8px", fontFamily:"monospace", fontSize:11 }}>
                              <button
                                type="button"
                                onClick={() => jumpToPermitFromAudit(row.permit_id)}
                                style={{ padding:"1px 6px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-secondary,#f7f7f5)", fontSize:11, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}
                              >
                                {row.permit_id}
                              </button>
                            </td>
                            <td style={{ padding:"6px 8px" }}>{auditActionLabel(row)}</td>
                            <td style={{ padding:"6px 8px" }}>{row.detail?.location || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:10 }}>
                <button
                  type="button"
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                  style={{ ...ss.btn, fontSize:12, opacity: auditPage <= 1 ? 0.45 : 1 }}
                >
                  Previous
                </button>
                <span style={{ fontSize:12, color:"var(--color-text-secondary)", alignSelf:"center" }}>Page {auditPage}</span>
                <button
                  type="button"
                  onClick={() => setAuditPage((p) => p + 1)}
                  disabled={!auditHasMore}
                  style={{ ...ss.btn, fontSize:12, opacity: auditHasMore ? 1 : 0.45 }}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {advancedViewsEnabled && permits.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns: isTablet ? "1fr" : "2fr 1fr", gap:12, marginBottom:16 }}>
          <div className="app-panel-surface" style={{ padding:10, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Permit risk heatmap (type × status)</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left", padding:"6px 8px" }}>Type</th>
                    <th style={{ textAlign:"right", padding:"6px 8px" }}>Draft</th>
                    <th style={{ textAlign:"right", padding:"6px 8px" }}>Review</th>
                    <th style={{ textAlign:"right", padding:"6px 8px" }}>Approved</th>
                    <th style={{ textAlign:"right", padding:"6px 8px" }}>Active</th>
                    <th style={{ textAlign:"right", padding:"6px 8px" }}>Expired</th>
                    <th style={{ textAlign:"right", padding:"6px 8px" }}>Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapRows.filter((r) => r.total > 0).map((row) => (
                    <tr key={row.type} style={{ borderTop:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
                      <td style={{ padding:"6px 8px" }}>{row.label}</td>
                      <td style={{ padding:"6px 8px", textAlign:"right" }}>{row.draft}</td>
                      <td style={{ padding:"6px 8px", textAlign:"right" }}>{row.pending_review}</td>
                      <td style={{ padding:"6px 8px", textAlign:"right" }}>{row.approved}</td>
                      <td style={{ padding:"6px 8px", textAlign:"right" }}>{row.active}</td>
                      <td style={{ padding:"6px 8px", textAlign:"right", color: row.expired ? "#A32D2D" : "inherit" }}>{row.expired}</td>
                      <td style={{ padding:"6px 8px", textAlign:"right" }}>{row.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="app-panel-surface" style={{ padding:10, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>War room alerts</div>
            {warRoomAlerts.length === 0 ? (
              <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No urgent alerts.</div>
            ) : (
              warRoomAlerts.map((p) => (
                <div key={p.id} style={{ fontSize:12, padding:"6px 0", borderBottom:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <strong>{(effectivePermitTypes[p.type] || effectivePermitTypes.general).label}</strong> · {p.location || "Unknown location"}
                  <div style={{ color:"#A32D2D" }}>{derivePermitStatus(p, now) === "expired" ? "Expired" : "Expires within 1 hour"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {permits.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, background:"var(--permit-panel-bg)" }}>
          <div style={{ fontSize:28, lineHeight:1, marginBottom:10 }}>[]</div>
          <p style={{ color:"var(--color-text-primary)", fontSize:14, fontWeight:600, margin:"0 0 6px" }}>No permits yet</p>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>Create your first permit to start review, activation, and compliance workflows.</p>
          <button type="button" onClick={()=>setModal({type:"form"})} style={ss.btnO}>+ Issue first permit</button>
        </div>
      ) : listSkeleton && permits.length > 0 ? (
        <div style={{ display:"grid", gap:10, marginBottom:12 }}>
          {[0, 1, 2].map((i) => (
            <div key={`permit-skeleton-${i}`} className="app-surface-card" style={{ ...ss.card, height: i === 0 ? 104 : 90, borderRadius:10, background:"linear-gradient(90deg,#f8fafc 25%,#f1f5f9 37%,#f8fafc 63%)", backgroundSize:"400% 100%", animation:"permitSkeletonPulse 1.2s ease infinite" }} />
          ))}
          <style>{`@keyframes permitSkeletonPulse{0%{background-position:100% 0}100%{background-position:0 0}}`}</style>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, background:"var(--permit-panel-bg)" }}>
          <p style={{ color:"var(--color-text-primary)", fontSize:14, fontWeight:600, margin:"0 0 6px" }}>No results for current filters</p>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, margin:"0 0 10px" }}>Try clearing status/type filters or adjusting search text.</p>
          <button type="button" onClick={()=>{setSearch("");setFilterType("");setFilterStatus("");setFilterHandoverDue(false);setFilterBlockedNow(false);}} style={{ ...ss.btn, fontSize:12 }}>
            Clear filters
          </button>
        </div>
      ) : effectiveViewMode === "wall" ? (
        <PermitLiveWall
          permits={filtered}
          now={wallNow}
          isNarrow={isNarrow}
          stats={stats}
          simopsMap={simopsMap}
          isFullscreen={wallFullscreen}
          onToggleFullscreen={() => void toggleWallFullscreen()}
          onOpen={(permit) => setModal({ type:"form", data: permit })}
          onPreview={previewPermit}
          onPrint={exportPermitPdf}
        />
      ) : effectiveViewMode === "board" ? (
        <PermitBoardView
          compact={isNarrow}
          columns={[
            { id: "draft", label: "Draft" },
            { id: "pending_review", label: "In review" },
            { id: "approved", label: "Approved" },
            { id: "active", label: "Active" },
            { id: "expired", label: "Expired" },
            { id: "closed", label: "Closed" },
          ]}
          permitsByColumn={{
            draft: filtered.filter((p) => derivePermitStatus(p, now) === "draft"),
            pending_review: filtered.filter((p) => derivePermitStatus(p, now) === "pending_review"),
            approved: filtered.filter((p) => derivePermitStatus(p, now) === "approved"),
            active: filtered.filter((p) => derivePermitStatus(p, now) === "active"),
            expired: filtered.filter((p) => derivePermitStatus(p, now) === "expired"),
            closed: filtered.filter((p) => derivePermitStatus(p, now) === "closed"),
          }}
          renderPermit={(p) => (
            <PermitCard key={p.id} permit={p}
              simopsConflicts={simopsMap.get(p.id) || []}
              conflictMatrix={effectiveConflictMatrix}
              permitTypes={effectivePermitTypes}
              handoverState={handoverStateForPermit(p, now)}
              activationHandoverRequirement={handoverRequirementForActivation(p, now)}
              activationDependencyResult={evaluatePermitDependencies(p, permits, effectiveDependencyRules, { now })}
              onOpenHandover={openHandoverDialog}
              cardDensity={cardDensity}
              onOpenMobileQuickActions={setMobileQuickActionsPermitId}
              ultraCompact={isUltraNarrow}
              highlight={highlightPermitId === p.id}
              compact={isNarrow}
              selectable={true}
              selected={!!selectedPermitIds[p.id]}
              onToggleSelect={togglePermitSelection}
              onNotify={permitNotifyEnabled ? notifyPermitTeam : undefined}
              onShareAckLink={sharePermitAckLink}
              onAcknowledge={acknowledgePermit}
              onConfirmBriefing={confirmPermitBriefing}
              incidents={incidentsByPermit.get(p.id) || []}
              onReportIncident={reportPermitIncident}
              onLoadCloudAudit={loadPermitCloudAudit}
              onEdit={(x)=>setModal({type:"form",data:x})}
              onClose={requestClosePermit}
              onReopen={reopenPermit}
              onDelete={deletePermit}
              onPreview={previewPermit}
              onPrint={exportPermitPdf}
              onApprove={approvePermit}
              onActivate={activatePermit}
              onSuspend={suspendPermit}
              onResume={resumePermit}
              onExtendRevalidate={extendAndRevalidatePermit}
            />
          )}
        />
      ) : effectiveViewMode === "timeline" ? (
        <PermitTimelineView
          permits={[...filtered].sort((a, b) => new Date(a.startDateTime || 0) - new Date(b.startDateTime || 0))}
          renderRow={(permit) => {
            const sim = simopsMap.get(permit.id) || [];
            return (
            <div
              id={`permit-row-${permit.id}`}
              key={permit.id}
              style={{
                display:"grid",
                gridTemplateColumns: isNarrow ? "1fr" : "170px 1fr auto",
                gap:8,
                alignItems:"center",
                padding:"8px 0",
                borderBottom:"1px solid var(--color-border-tertiary,#e5e5e5)",
                boxShadow: highlightPermitId === permit.id ? "inset 0 0 0 2px #0d9488" : undefined,
                borderRadius: highlightPermitId === permit.id ? 6 : 0,
              }}
            >
              <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                {fmtDateTime(permit.startDateTime)} → {fmtDateTime(permitEndIso(permit))}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{(effectivePermitTypes[permit.type] || effectivePermitTypes.general).label}</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{permit.location || "—"}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                {sim.length > 0 ? (
                  <span style={{ padding:"2px 6px", borderRadius:12, fontSize:10, fontWeight:600, background:"#FCEBEB", color:"#791F1F" }}>SIMOPS ×{sim.length}</span>
                ) : null}
                <span style={{ ...ss.chip, fontSize:11 }}>{derivePermitStatus(permit, now)}</span>
                <button type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={() => previewPermit(permit)}>Preview</button>
                <button type="button" style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }} onClick={() => setModal({type:"form",data:permit})}>Edit</button>
              </div>
            </div>
            );
          }}
        />
      ) : (
        filtered.map(p=>(
          <PermitCard key={p.id} permit={p}
            simopsConflicts={simopsMap.get(p.id) || []}
            conflictMatrix={effectiveConflictMatrix}
            permitTypes={effectivePermitTypes}
            handoverState={handoverStateForPermit(p, now)}
            activationHandoverRequirement={handoverRequirementForActivation(p, now)}
            activationDependencyResult={evaluatePermitDependencies(p, permits, effectiveDependencyRules, { now })}
            onOpenHandover={openHandoverDialog}
            cardDensity={cardDensity}
            onOpenMobileQuickActions={setMobileQuickActionsPermitId}
            ultraCompact={isUltraNarrow}
            highlight={highlightPermitId === p.id}
            compact={isNarrow}
            selectable={true}
            selected={!!selectedPermitIds[p.id]}
            onToggleSelect={togglePermitSelection}
            onNotify={permitNotifyEnabled ? notifyPermitTeam : undefined}
            onShareAckLink={sharePermitAckLink}
            onAcknowledge={acknowledgePermit}
            onConfirmBriefing={confirmPermitBriefing}
            incidents={incidentsByPermit.get(p.id) || []}
            onReportIncident={reportPermitIncident}
            onLoadCloudAudit={loadPermitCloudAudit}
            onEdit={p=>setModal({type:"form",data:p})}
            onClose={requestClosePermit} onReopen={reopenPermit}
            onDelete={deletePermit}
            onPreview={previewPermit}
            onPrint={exportPermitPdf}
            onApprove={approvePermit}
            onActivate={activatePermit}
            onSuspend={suspendPermit}
            onResume={resumePermit}
            onExtendRevalidate={extendAndRevalidatePermit}
          />
        ))
      )}
    </div>
  );
}
