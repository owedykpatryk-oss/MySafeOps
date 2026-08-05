import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { isAnthropicConfigured, checkAnthropicProxyReady } from "../../utils/anthropicClient";
import { useD1OrgArraySync } from "../../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../../utils/useRegisterListPaging";
import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { pushAudit } from "../../utils/auditLog";
import { ms } from "../../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import PageHero from "../../components/PageHero";
import { D1ModuleSyncBanner } from "../../components/D1ModuleSyncBanner";
import {
  ACCESS_LIMITATION_TYPES,
  blankSurveyReport,
  GROUND_SURFACE_OPTIONS,
  LIMITATION_RULES,
  METHODS_AFFECTED,
  PAS128_QUALITY_LEVELS,
  PAS128_METHODS,
  RAIN_DURING_SURVEY,
  SURVEY_TYPES,
  UTILITY_RECORDS_GAPS,
  UTILITY_RECORDS_OUTCOMES,
  UTILITY_RECORDS_PRESETS,
  UTILITY_RECORDS_SOURCES,
  WEATHER_PHENOMENA,
  DBYD_ENQUIRY_PROVIDERS,
  DBYD_ENQUIRY_STATUS,
  UNDERTAKER_CATEGORIES,
  UNDERTAKER_RESPONSE_STATUS,
  GI_METHOD_OPTIONS,
  UTILITY_TYPE_OPTIONS,
  UTILITY_CONFIDENCE_LEVELS,
  UTILITY_SOURCE_OPTIONS,
  UTILITY_DETECT_STATUS,
  PRINT_OUTLINE_OPTIONS,
  DELIVERABLE_FORMAT_OPTIONS,
  RECORD_REF_STATUS_OPTIONS,
  EQUIPMENT_CALIBRATION_STATUS,
  SURVEY_PHOTO_CATEGORIES,
} from "./surveyReportConstants";
import { listSurveyTypesForOrg } from "../../utils/utilityMappingFocus";
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg";
import { listUtilityMappingClients, getUtilityMappingClient, utilityMappingClientLogoUrl } from "../../utils/utilityMappingClients";
import { formatUtilityMappingRef, utilityMappingJobYearYY, parseUtilityMappingRef } from "../../utils/utilityMappingDocRefs";
import { applyUtilityMappingProjectJobToDoc } from "../../utils/utilityMappingProjectJob";
import { siteContextBadgeLabel, inheritSiteContextOntoDoc } from "../../utils/inheritSiteContext";
import { stripSurveyFormForSessionDraft, mergeSurveyDraftPhotos } from "../../utils/surveyEditorDraft";
import { stripGeoPhotosForD1, stripSurveyReportsForD1 } from "../../utils/d1SyncPayload";
import { buildOrgShareUrlWithRef } from "../../utils/safeOrgWebsite";
import {
  computeUtilityMappingDigRisk,
  buildUtilityMappingDrawingSheets,
} from "../../utils/utilityMappingPremiumPages";
import {
  downloadUtilityMappingClientPack,
  downloadUtilityMappingClientPackPdf,
  downloadUtilityMappingA3BoardPack,
  buildUtilityMappingClientMailto,
} from "../../utils/utilityMappingClientPack";
import { getOrgSettings } from "../../utils/orgSettingsStorage";

function umFieldsFromRef(ref) {
  const p = parseUtilityMappingRef(ref);
  if (!p) return {};
  return {
    umJobNumber: p.jobNumber,
    umClientCode: p.clientCode === "XXX" ? "" : p.clientCode,
  };
}
import { getQaChecklistGroupsForSurveyType, getQaChecklistProgress, getQaGroupProgress, patchQaGroup, mergeStandardsCited, applyMobilisationQaPrefill, SURVEY_PUBLIC_STANDARDS } from "./surveyQaPack";
import {
  buildLimitationsFromKeys,
  nextSurveyRef,
  normalizeSurveyReport,
  surveyReportQuality,
  toggleArray,
  finalizeReportRevision,
  buildDuplicateReportPayload,
  compareSurveyReports,
  buildPas128SummaryStats,
  surveyPhotoCategoryCoverage,
} from "./surveyReportHelpers";
import { evaluateSurveyFinalGate, evaluateSurveyExportGate } from "../../utils/surveyCompletenessGates";
import { defaultProjectIdForCreate, ensureProjectLinked } from "../../utils/projectRequiredGate";
import {
  applyGeneratedNarratives,
  attachSitePlanSnapshots,
  batchCreateDraftReports,
  buildExecutiveSummaryDraft,
  buildRecommendationsDraft,
  buildSurveyTypeDefaults,
  fetchWeatherIntoReport,
  fetchGeologyIntoSurveyReport,
  generateAiSurveyDraft,
  mergeSitePlanIntoReport,
  pickRamsForProject,
  prefillReportFromProject,
  projectsMissingReports,
  pullScopeFromRams,
  runSmartFillAll,
  applyPas128CompletePack,
  smartFillNextSteps,
  suggestLimitationKeys,
  listPermitsForSurveyProject,
  applyLinkedPermitToReport,
} from "./surveyReportSmart";
import SurveyBlockersPanel from "./SurveyBlockersPanel";
import SurveyHandoverModal from "./SurveyHandoverModal";
import { resolveSurveyFixTarget, scheduleSurveyFixScroll } from "./surveyFixNav";
import SurveyPas128Dashboard from "./SurveyPas128Dashboard";
import { applySurveyAutofix } from "./surveyAutofix";
import { runSurveyIssuePackPrep } from "./surveyIssuePack";
import { autoSyncGprIntoSurvey } from "./surveyGprBridge";
import { getSpecialistFindingsConfig } from "./surveySpecialistFindings";
import { applyPas128MethodToReport, pas128MethodAppliesToSurveyType } from "./pas128MethodPresets";
import { buildPas128Foreword } from "./pas128ReportBoilerplate";
import { buildFindingsDraft } from "./pas128FindingsBuilder";
import { applyTrialHolesToUtilities, seedTfrCadNotesFromRecords } from "./surveyGeologyUpgrades";
import Pas128WorkflowStrip from "./Pas128WorkflowStrip";
import { listProjectPlans, plansForProject } from "../permits/permitPlanOverlayRegistry";
import { consumeWorkspaceNavTarget, openWorkspaceView, setWorkspaceNavTarget } from "../../utils/workspaceNavContext";
import { pushRecycleBinItem } from "../../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../../utils/d1ArrayMerge";
import { countGeoPhotosForReport, importGeoPhotosIntoReport as mergeGeoPhotos, geoPhotosToUtilitiesTable, geoPhotosToGiLocationsTable } from "../../utils/geoPhotoIntegrations";
import { readCadFile, mergeCadAnalysisIntoReport, applyCadLayerMappings, seedUtilitiesTableFromCad } from "../../utils/surveyDxfAnalyzer";
import CadImportPanel from "./CadImportPanel";
import EmptyState from "../../components/EmptyState";
import RegisterListPagingFooter from "../../components/RegisterListPagingFooter";
import PrintPreviewFrame from "../../components/PrintPreviewFrame";
import ModuleOverlay from "../../components/ModuleOverlay";
import ConfirmDialog from "../../components/ConfirmDialog";
import SurveyEditorStepNav from "./SurveyEditorStepNav";
import SurveySimpleStepNav from "./SurveySimpleStepNav";
import { adjacentSimpleStep, simpleStepForTab } from "./surveySimpleEditorNav";
import { getSurveySimpleModePref, setSurveySimpleModePref } from "../../utils/surveyOrgTemplates";
import { catalogDefaultDeliverables } from "../../utils/surveyContentCatalog";
import SurveyEditorHero from "./SurveyEditorHero";
import SurveyListStatsBar from "./SurveyListStatsBar";
import SurveyRevisionTimeline from "./SurveyRevisionTimeline";
import SurveyLivePreviewDock from "./SurveyLivePreviewDock";
import SurveyHandoverStrip from "./SurveyHandoverStrip";
import SurveyKeyboardHints from "./SurveyKeyboardHints";
import SurveyListRow from "./SurveyListRow";
import SurveyPremiumFieldsEditor from "./SurveyPremiumFieldsEditor";
import { useSurveyPreviewHtml } from "./useSurveyPreviewHtml";
import { enrichSurveyListRows, surveyListGroupMeta } from "./surveyReportListRows";
import { surveyListFilterCounts } from "./surveyListFilterCounts";
import { burstSurveyCelebration } from "../../utils/surveyCelebration";
import {
  groupSurveyReportsByProject,
  adjacentSurveyTab,
} from "./surveyReportEditorNav";
import {
  filterSurveyReportsSearch,
  sortSurveyReports,
  summarizeSurveyReportList,
} from "./surveyReportListUtils";
import {
  batchAppendFinalSurveysToRams,
  batchAssignSurveysToProject,
  persistSurveyAppendixToRams,
  persistRamsSyncFromSurvey,
} from "../../utils/documentPropagation";

const STORAGE_KEY = "survey_reports";
const SURVEY_DRAFT_KEY = "mysafeops_survey_report_editor_draft";
const SURVEY_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ss = {
  ...ms,
  ta: {
    width: "100%",
    padding: "10px 12px",
    border: "0.5px solid var(--color-border-secondary,#ccc)",
    borderRadius: 6,
    fontSize: 16,
    background: "var(--color-background-primary,#fff)",
    color: "var(--color-text-primary)",
    fontFamily: "DM Sans,sans-serif",
    boxSizing: "border-box",
    resize: "vertical",
    lineHeight: 1.5,
  },
  sectionHead: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "18px 0 10px",
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
    gap: 8,
  },
  checkLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    cursor: "pointer",
    lineHeight: 1.4,
  },
  tabRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 16,
    borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
    paddingBottom: 10,
  },
  tab: (active) => ({
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    background: active ? "#ccfbf1" : "transparent",
    color: active ? "#115e59" : "var(--color-text-secondary)",
    fontFamily: "DM Sans,sans-serif",
  }),
};

function openSurveyReportFromNav(t, { projs, existing, geo, rams, setModal }) {
  if (t?.reportId) {
    const report = existing.find((r) => r.id === t.reportId);
    if (report) {
      setModal({ type: "edit", isNew: false, data: report });
      return true;
    }
  }
  const ref = nextSurveyRef(existing);
  const umFields = umFieldsFromRef(ref);
  if (t?.projectId && t?.action === "editWithGeoPhotos") {
    const p = projs.find((x) => x.id === t.projectId);
    const report = existing.find((r) => r.projectId === t.projectId);
    if (report) {
      setModal({
        type: "edit",
        isNew: false,
        data: mergeGeoPhotos(report, geo, { replaceFindingsBlock: true }),
      });
      return true;
    }
    if (p) {
      const ramsDoc = pickRamsForProject(rams, p.id);
      const base = blankSurveyReport({
        ref,
        ...umFields,
        title: `Survey report — ${p.name || ref}`,
        projectId: p.id,
      });
      setModal({
        type: "edit",
        isNew: true,
        data: mergeGeoPhotos(prefillReportFromProject(base, p, ramsDoc), geo, { replaceFindingsBlock: true }),
      });
      return true;
    }
  }
  if (t?.projectId && t?.action !== "createReport") {
    const existingForProject = existing.find((r) => r.projectId === t.projectId);
    if (existingForProject) {
      setModal({ type: "edit", isNew: false, data: existingForProject });
      return true;
    }
  }
  if (t?.projectId) {
    const p = projs.find((x) => x.id === t.projectId);
    if (p) {
      const ramsDoc = pickRamsForProject(rams, p.id);
      const base = blankSurveyReport({
        ref,
        ...umFields,
        title: `Survey report — ${p.name || ref}`,
        projectId: p.id,
      });
      setModal({
        type: "edit",
        isNew: true,
        data: prefillReportFromProject(base, p, ramsDoc),
      });
      return true;
    }
  }
  if (t?.action === "createReport") {
    const pid = defaultProjectIdForCreate(projs);
    if (!pid && !projs.length) {
      setWorkspaceNavTarget({ viewId: "projects", action: "createProject" });
      openWorkspaceView({ viewId: "projects" });
      return true;
    }
    const base = blankSurveyReport({
      ref,
      ...umFields,
      title: pid ? `Survey report — ${projs.find((x) => x.id === pid)?.name || ref}` : `Survey report ${ref}`,
      projectId: pid || "",
    });
    setModal({
      type: "edit",
      isNew: true,
      data: pid ? prefillReportFromProject(base, projs.find((x) => x.id === pid), pickRamsForProject(rams, pid)) : base,
    });
    return true;
  }
  return false;
}

function RowTableEditor({ rows, columns, onChange, emptyLabel, addLabel }) {
  const updateRow = (idx, key, value) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const addRow = () => {
    const base = { id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` };
    columns.forEach((c) => {
      base[c.key] = c.defaultValue ?? "";
    });
    onChange([...(rows || []), base]);
  };
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div>
      {(rows || []).length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {(rows || []).map((row, idx) => (
            <div
              key={row.id || idx}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: 10,
                border: "0.5px solid #e5e7eb",
                borderRadius: 8,
                alignItems: "flex-end",
              }}
            >
              {columns.map((col) => (
                <div key={col.key} style={{ flex: "1 1 140px", minWidth: 120 }}>
                  <label style={{ ...ss.lbl, fontSize: 10 }}>{col.label}</label>
                  {col.options ? (
                    <select
                      style={ss.inp}
                      value={row[col.key] || ""}
                      onChange={(e) => updateRow(idx, col.key, e.target.value)}
                    >
                      <option value="">—</option>
                      {col.options.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={ss.inp}
                      type={col.type || "text"}
                      value={row[col.key] || ""}
                      onChange={(e) => updateRow(idx, col.key, e.target.value)}
                      placeholder={col.placeholder || ""}
                    />
                  )}
                </div>
              ))}
              <button type="button" style={{ ...ss.btn, fontSize: 11, color: "#A32D2D" }} onClick={() => removeRow(idx)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" style={{ ...ss.btn, fontSize: 11 }} onClick={addRow}>
        {addLabel}
      </button>
    </div>
  );
}

function CheckboxGrid({ options, selected, onToggle }) {
  return (
    <div style={ss.checkGrid}>
      {options.map((o) => (
        <label key={o.key} style={ss.checkLabel}>
          <input
            type="checkbox"
            checked={(selected || []).includes(o.key)}
            onChange={() => onToggle(o.key)}
            style={{ marginTop: 3, accentColor: "#0d9488", flexShrink: 0 }}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function SmartAssistPanel({ form, projects, ramsDocs, projectPlans, geoPhotos = [], permits = [], gprReports = [], onApply, linkedRams, onGoToTab, simpleMode = false }) {
  const [open, setOpen] = useState(!simpleMode);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [useAiOnFill, setUseAiOnFill] = useState(false);
  const [proxyReady, setProxyReady] = useState(null);

  const project = projects.find((p) => p.id === form.projectId);
  const hasCoords = Boolean(project?.lat && project?.lng);
  const clientAiConfigured = isAnthropicConfigured();
  const hasAi = clientAiConfigured && proxyReady !== false;

  useEffect(() => {
    if (!clientAiConfigured) {
      setProxyReady(null);
      return undefined;
    }
    let cancelled = false;
    checkAnthropicProxyReady().then((ok) => {
      if (!cancelled) setProxyReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [clientAiConfigured]);
  const plansWithMarkup = useMemo(
    () =>
      (projectPlans || []).filter((p) => {
        const routes = (p.escapeRoutes || []).length;
        const zones = (p.zoneBlocks || []).length;
        const assets = (p.emergencyAssets || []).length;
        return routes + zones + assets > 0;
      }),
    [projectPlans]
  );

  const nextSteps = useMemo(
    () => smartFillNextSteps(form, { project, projectPlans: plansWithMarkup, geoPhotos }),
    [form, project, plansWithMarkup, geoPhotos]
  );
  const geoReportCount = useMemo(
    () => (form.projectId ? countGeoPhotosForReport(geoPhotos, form.projectId) : 0),
    [geoPhotos, form.projectId]
  );

  const run = useCallback(
    async (label, fn) => {
      setBusy(label);
      setMsg("");
      try {
        const next = await fn();
        onApply(next);
        setMsg(`${label} — done`);
      } catch (e) {
        setMsg(e?.message || `${label} failed`);
      } finally {
        setBusy("");
      }
    },
    [onApply]
  );

  const assistBtn = (label, disabled, onClick, primary = false) => (
    <button
      type="button"
      style={{
        ...(primary ? ss.btnP : ss.btn),
        fontSize: 11,
        padding: "6px 10px",
        opacity: disabled ? 0.55 : 1,
        borderColor: busy === label ? "#0d9488" : undefined,
      }}
      disabled={Boolean(busy) || disabled}
      onClick={() => run(label, onClick)}
    >
      {busy === label ? "…" : label}
    </button>
  );

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 14px",
        borderRadius: 8,
        border: "0.5px solid #99f6e4",
        background: "linear-gradient(180deg, #f0fdfa 0%, #fafcff 100%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: open ? 10 : 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f766e" }}>Smart assist</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            {simpleMode
              ? "Fill what we can from the project — weather, templates and findings. Advanced tools stay collapsed."
              : "One-click fill, site plan import, weather, templates and optional AI polish."}
          </div>
        </div>
        <button type="button" style={{ ...ss.btn, fontSize: 11, padding: "4px 8px" }} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
            {assistBtn(
              "Fill what I can",
              !project && !form.surveyType,
              async () =>
                runSmartFillAll(form, {
                  project,
                  ramsDocs,
                  projectPlans: plansWithMarkup,
                  linkedRams,
                  useAi: useAiOnFill,
                  geoPhotos,
                  permits,
                }),
              true
            )}
            <button
              type="button"
              style={{
                ...ss.btn,
                fontSize: 11,
                padding: "6px 10px",
                opacity: busy || (!project && !form.surveyType) ? 0.55 : 1,
                borderColor: "#0d9488",
                color: "#0f766e",
                background: "#ecfdf5",
                fontWeight: 600,
              }}
              disabled={Boolean(busy) || (!project && !form.surveyType)}
              onClick={() =>
                run("Prepare issue pack", async () => {
                  const { report, summary } = await runSurveyIssuePackPrep(form, {
                    project,
                    ramsDocs,
                    projectPlans: plansWithMarkup,
                    linkedRams,
                    useAi: useAiOnFill,
                    geoPhotos,
                    permits,
                    gprReports,
                  });
                  // Defer so run()'s default "done" message is replaced with pack status.
                  queueMicrotask(() => {
                    setMsg(
                      summary.canMarkFinal
                        ? `Issue pack ready (${summary.qualityScore}%) — Mark final, then download handover ZIP.`
                        : `Issue pack prepared (${summary.qualityScore}%) — ${summary.criticalBlockers || summary.blockersRemaining} item(s) still block final.`
                    );
                  });
                  return report;
                })
              }
            >
              {busy === "Prepare issue pack" ? "…" : "Prepare issue pack"}
            </button>
            {!simpleMode &&
              assistBtn(
                "PAS128 complete pack",
                !pas128MethodAppliesToSurveyType(form.surveyType),
                async () =>
                  applyPas128CompletePack(form, {
                    project,
                    ramsDocs,
                    projectPlans: plansWithMarkup,
                    linkedRams,
                    useAi: useAiOnFill,
                    geoPhotos,
                    permits,
                  }),
                false
              )}
            {hasAi && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                <input type="checkbox" checked={useAiOnFill} onChange={(e) => setUseAiOnFill(e.target.checked)} />
                Include AI polish
              </label>
            )}
            {form.smartFillAt && (
              <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                Last auto-fill: {new Date(form.smartFillAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            {simpleMode ? (
              <button type="button" style={{ ...ss.btn, fontSize: 11, padding: "4px 10px" }} onClick={() => setAdvancedOpen((v) => !v)}>
                {advancedOpen ? "Hide advanced tools" : "Advanced tools"}
              </button>
            ) : null}
          </div>
          {nextSteps.length > 0 && (
            <div style={{ marginTop: 4, marginBottom: 8, fontSize: 11 }}>
              <span style={{ color: "var(--color-text-secondary)", marginRight: 6 }}>Next:</span>
              {nextSteps.slice(0, 4).map((step) => (
                <button
                  key={step.id}
                  type="button"
                  style={{
                    ...ss.btn,
                    fontSize: 10,
                    padding: "3px 8px",
                    marginRight: 4,
                    marginBottom: 4,
                  }}
                  onClick={() => onGoToTab?.(step.tab, { id: step.id, label: step.label })}
                >
                  {step.label}
                </button>
              ))}
            </div>
          )}
          {(simpleMode ? advancedOpen : true) ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {simpleMode &&
              assistBtn(
                "PAS128 complete pack",
                !pas128MethodAppliesToSurveyType(form.surveyType),
                async () =>
                  applyPas128CompletePack(form, {
                    project,
                    ramsDocs,
                    projectPlans: plansWithMarkup,
                    linkedRams,
                    useAi: useAiOnFill,
                    geoPhotos,
                    permits,
                  }),
                false
              )}
            {assistBtn("Prefill project + RAMS", !project, async () => {
              const rams = pickRamsForProject(ramsDocs, form.projectId) || linkedRams;
              return prefillReportFromProject(form, project, rams);
            })}
            {assistBtn("Fetch weather", !project || !form.surveyDate || !hasCoords, async () =>
              fetchWeatherIntoReport(form, project)
            )}
            {assistBtn("Fetch BGS geology", !project || !(hasCoords || project?.postcode), async () =>
              fetchGeologyIntoSurveyReport(form, project, { overwrite: Boolean(form.geology?.formation) })
            )}
            {project && !hasCoords && project?.postcode ? (
              <span style={{ fontSize: 11, color: "#b45309" }}>
                No map pin — BGS will use postcode centroid (less accurate).
              </span>
            ) : null}
            {assistBtn("Import site plan", !plansWithMarkup.length, async () => {
              let next = mergeSitePlanIntoReport(form, plansWithMarkup);
              next = await attachSitePlanSnapshots(next, plansWithMarkup);
              return next;
            })}
            {assistBtn("Capture plan images", !plansWithMarkup.length, async () =>
              attachSitePlanSnapshots(form, plansWithMarkup)
            )}
            {assistBtn("Apply type template", !form.surveyType, async () => {
              const defaults = buildSurveyTypeDefaults(form.surveyType, form.pas128Ql);
              if (!defaults) throw new Error("No template for this survey type.");
              return {
                ...form,
                sections: {
                  ...form.sections,
                  scope: form.sections.scope?.trim() ? form.sections.scope : defaults.scope,
                  methodology: form.sections.methodology?.trim() ? form.sections.methodology : defaults.methodology,
                  equipmentUsed: form.sections.equipmentUsed?.trim() ? form.sections.equipmentUsed : defaults.equipmentUsed,
                },
              };
            })}
            {assistBtn("Suggest limitations", false, async () => {
              const keys = suggestLimitationKeys(form);
              return {
                ...form,
                limitationKeys: keys,
                limitationsText: buildLimitationsFromKeys(keys, form.limitationsText),
              };
            })}
            {assistBtn("Generate narratives", false, async () => applyGeneratedNarratives(form))}
            {assistBtn("Import geo-photos", !form.projectId || geoReportCount === 0, async () =>
              mergeGeoPhotos(form, geoPhotos, { replaceFindingsBlock: true, mergeUtilitiesTable: true })
            )}
            {assistBtn("Utilities from geo-photos", !form.projectId || geoReportCount === 0, async () => ({
              ...form,
              utilitiesTable: geoPhotosToUtilitiesTable(geoPhotos, form.projectId, {
                existingRows: form.utilitiesTable,
                pas128Ql: form.pas128Ql,
              }),
              updatedAt: new Date().toISOString(),
            }))}
            {geoReportCount > 0 && (
              <button
                type="button"
                style={{ ...ss.btn, fontSize: 11, padding: "6px 10px" }}
                onClick={() => {
                  setWorkspaceNavTarget({ viewId: "geo-photos", projectId: form.projectId, action: "capture" });
                  openWorkspaceView({ viewId: "geo-photos" });
                }}
              >
                + Capture geo-photo
              </button>
            )}
            {assistBtn("Draft executive summary", false, async () => {
              const text = buildExecutiveSummaryDraft(form, {
                linkedRamsTitle: linkedRams?.title || linkedRams?.documentTitle || "",
              });
              if (!text) throw new Error("Add survey type, date and site first.");
              return {
                ...form,
                sections: {
                  ...form.sections,
                  executiveSummary: form.sections.executiveSummary?.trim() ? form.sections.executiveSummary : text,
                },
              };
            })}
            {assistBtn("Draft recommendations", false, async () => {
              const text = buildRecommendationsDraft(form);
              return {
                ...form,
                sections: {
                  ...form.sections,
                  recommendations: form.sections.recommendations?.trim() ? form.sections.recommendations : text,
                },
              };
            })}
            {assistBtn("AI polish sections", !hasAi, async () => {
              const draft = await generateAiSurveyDraft(form);
              return {
                ...form,
                sections: {
                  ...form.sections,
                  executiveSummary: draft.executiveSummary || form.sections.executiveSummary,
                  scope: draft.scope || form.sections.scope,
                  findings: draft.findings || form.sections.findings,
                  recommendations: draft.recommendations || form.sections.recommendations,
                },
              };
            })}
          </div>
          ) : null}
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8 }}>
            {!project && "Select a project to enable prefill and weather fetch. "}
            {project && !hasCoords && "Project has no map coordinates — set location on the project for weather. "}
            {project && !plansWithMarkup.length && "No marked site plans on this project yet (Workers → site plan). "}
            {!hasAi && clientAiConfigured && proxyReady === false && (
              <span style={{ fontSize: 11, color: "#A32D2D" }}>
                AI proxy is not ready on the server — check Vercel env (ANTHROPIC_API_KEY, AI_PROXY_SHARED_SECRET, VITE_AI_PROXY_SECRET).{" "}
              </span>
            )}
            {!hasAi && !clientAiConfigured && "AI polish needs Anthropic key or proxy in settings. "}
            {msg && (
              <span style={{ color: msg.includes("failed") || msg.includes("required") ? "#A32D2D" : "#0d9488" }}>{msg}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportEditor({
  report,
  projects,
  ramsDocs,
  projectPlans,
  geoPhotos = [],
  gprReports = [],
  permits = [],
  reports = [],
  isNew,
  onSave,
  onClose,
  onPrint,
  onOpenReport,
}) {
  const { pushToast } = useToast();
  const [form, setForm] = useState(() => normalizeSurveyReport({ ...report }));
  const [tab, setTab] = useState("details");
  const [simpleMode, setSimpleMode] = useState(() => getSurveySimpleModePref());
  const activeSimpleStep = useMemo(() => simpleStepForTab(tab), [tab]);
  // One panel at a time — even in Simple mode (sub-pills switch within the step)
  const showTab = useCallback((tabId) => tab === tabId, [tab]);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cadBusy, setCadBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [packProgress, setPackProgress] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef(null);
  const [livePreviewOpen, setLivePreviewOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches
  );
  const autoFillRan = useRef(false);
  const draftPromptRan = useRef(false);
  const lastDraftJsonRef = useRef("");

  useEffect(() => {
    if (draftPromptRan.current) return;
    draftPromptRan.current = true;
    try {
      const raw = sessionStorage.getItem(SURVEY_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.form?.id || draft.form.id !== report.id) return;
      const age = Date.now() - (draft.savedAt || 0);
      if (age < 0 || age > SURVEY_DRAFT_MAX_AGE_MS) {
        sessionStorage.removeItem(SURVEY_DRAFT_KEY);
        return;
      }
      const when = draft.savedAt
        ? new Date(draft.savedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
        : "recently";
      setConfirmDialog({
        title: "Restore unsaved draft?",
        message: `Changes from ${when} were found for this report.`,
        confirmLabel: "Restore",
        cancelLabel: "Discard",
        onConfirm: () => {
          setForm((live) => normalizeSurveyReport(mergeSurveyDraftPhotos(draft.form, live)));
          setConfirmDialog(null);
        },
        onCancel: () => {
          sessionStorage.removeItem(SURVEY_DRAFT_KEY);
          setConfirmDialog(null);
        },
      });
    } catch {
      /* ignore */
    }
  }, [report.id]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const payload = JSON.stringify({
          form: stripSurveyFormForSessionDraft(form),
          savedAt: Date.now(),
          reportId: form.id,
        });
        if (payload === lastDraftJsonRef.current) return;
        lastDraftJsonRef.current = payload;
        sessionStorage.setItem(SURVEY_DRAFT_KEY, payload);
      } catch {
        /* quota */
      }
    }, 2200);
    return () => clearTimeout(t);
  }, [form]);

  const projectPlansForForm = useMemo(
    () => (form.projectId ? plansForProject(form.projectId, projectPlans) : []),
    [form.projectId, projectPlans]
  );

  useEffect(() => {
    if (!isNew || autoFillRan.current || !report.projectId) return;
    autoFillRan.current = true;
    const project = projects.find((p) => p.id === report.projectId);
    if (!project) return;
    const linked = ramsDocs.find((d) => d.id === report.linkedRamsId);
    runSmartFillAll({ ...report }, {
      project,
      ramsDocs,
      projectPlans: plansForProject(report.projectId, projectPlans),
      linkedRams: linked,
      useAi: false,
      permits,
    })
      .then((next) => setForm({ ...next, updatedAt: new Date().toISOString() }))
      .catch(() => {});
  }, [isNew, report, projects, ramsDocs, projectPlans, permits]);

  const deferredFormProject = useMemo(
    () => projects.find((p) => p.id === form.projectId),
    [projects, form.projectId]
  );
  const formProject = deferredFormProject;
  const previewActive = livePreviewOpen || tab === "preview";
  const { html: previewHtml, pending: previewPending } = useSurveyPreviewHtml(form, {
    active: previewActive,
    ramsDocs,
    project: deferredFormProject,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, updatedAt: new Date().toISOString() }));
  const onSurveyTypeChange = (surveyType) => {
    setForm((f) => {
      const next = {
        ...f,
        surveyType,
        standardsCited: mergeStandardsCited(f.standardsCited, surveyType),
        updatedAt: new Date().toISOString(),
      };
      if (surveyType && !(f.deliverables || []).length) {
        const dels = catalogDefaultDeliverables(surveyType);
        if (dels?.length) next.deliverables = dels;
      }
      if (surveyType && !Object.values(f.qaChecklist || {}).some(Boolean)) {
        next.qaChecklist = applyMobilisationQaPrefill(f.qaChecklist, surveyType);
      }
      return next;
    });
  };
  const setSection = (k, v) =>
    setForm((f) => ({
      ...f,
      sections: { ...f.sections, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setWeather = (k, v) =>
    setForm((f) => ({
      ...f,
      weather: { ...f.weather, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setRecords = (k, v) =>
    setForm((f) => ({
      ...f,
      utilityRecords: { ...f.utilityRecords, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setDocControl = (k, v) =>
    setForm((f) => ({
      ...f,
      documentControl: { ...f.documentControl, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setProgramme = (k, v) =>
    setForm((f) => ({
      ...f,
      surveyProgramme: { ...f.surveyProgramme, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setControl = (k, v) =>
    setForm((f) => ({
      ...f,
      controlAccuracy: { ...f.controlAccuracy, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setQa = (k, v) =>
    setForm((f) => ({
      ...f,
      qaChecklist: { ...f.qaChecklist, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setQaGroup = (groupId, checked) =>
    setForm((f) => ({
      ...f,
      qaChecklist: patchQaGroup(f.qaChecklist, groupId, f.surveyType, checked),
      updatedAt: new Date().toISOString(),
    }));
  const toggleStandardCited = (key) =>
    setForm((f) => ({
      ...f,
      standardsCited: toggleArray(f.standardsCited || [], key),
      updatedAt: new Date().toISOString(),
    }));
  const setUavCompliance = (k, v) =>
    setForm((f) => ({
      ...f,
      uavCompliance: { ...f.uavCompliance, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setHse = (k, v) =>
    setForm((f) => ({
      ...f,
      hseRefs: { ...f.hseRefs, [k]: v },
      updatedAt: new Date().toISOString(),
    }));
  const setSig = (k, v) =>
    setForm((f) => ({
      ...f,
      signatures: { ...f.signatures, [k]: v },
      updatedAt: new Date().toISOString(),
    }));

  const toggleLimitation = (key) => {
    setForm((f) => ({
      ...f,
      limitationKeys: toggleArray(f.limitationKeys, key),
      updatedAt: new Date().toISOString(),
    }));
  };

  const applyRecordsPreset = (presetKey) => {
    const p = UTILITY_RECORDS_PRESETS[presetKey];
    if (!p) return;
    setForm((f) => ({
      ...f,
      utilityRecords: {
        ...f.utilityRecords,
        sourcesConsulted: [...p.sources],
        outcomes: [...p.outcomes],
        informationGaps: [...p.gaps],
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const onProjectChange = (projectId) => {
    const p = projects.find((x) => x.id === projectId);
    setForm((f) => {
      let next = {
        ...f,
        projectId,
        projectName: p?.name || "",
        client: p?.client || p?.site || f.client,
        siteAddress: p?.address || f.siteAddress,
        updatedAt: new Date().toISOString(),
      };
      if (p) {
        const rams = pickRamsForProject(ramsDocs, projectId);
        next = inheritSiteContextOntoDoc(next, p, rams);
        next = applyUtilityMappingProjectJobToDoc(next, p, "SR");
      }
      return next;
    });
  };

  const syncScopeFromRams = () => {
    const rams = linkedRams || pickRamsForProject(ramsDocs, form.projectId);
    if (!rams) {
      pushToast({ type: "warn", title: "No RAMS linked", message: "Link a RAMS document first, or create one from the project hub." });
      return;
    }
    try {
      const next = pullScopeFromRams(form, rams);
      setForm({ ...next, updatedAt: new Date().toISOString() });
      pushToast({ type: "success", title: "Scope synced", message: "Pulled scope from linked RAMS." });
    } catch (e) {
      pushToast({ type: "error", title: "Sync failed", message: e?.message || "Could not pull scope from RAMS." });
    }
  };

  const pushSurveyPackToRams = () => {
    if (!form.surveyType) {
      pushToast({ type: "warn", title: "No survey type", message: "Select a survey type before pushing to RAMS." });
      return;
    }
    const allRams = load("rams_builder_docs", []);
    try {
      persistRamsSyncFromSurvey(form, allRams);
      pushToast({
        type: "success",
        title: "Pushed to RAMS",
        message: "Survey pack (method, permits, certs, hold points) merged into the linked RAMS document.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "Push failed", message: e?.message || "Could not push survey pack to RAMS." });
    }
  };

  const appendSummaryToRams = () => {
    if (form.status !== "final") {
      pushToast({ type: "warn", title: "Not final", message: "Mark the report final before appending findings to RAMS handover notes." });
      return;
    }
    const allRams = load("rams_builder_docs", []);
    try {
      persistSurveyAppendixToRams(form, allRams);
      pushToast({
        type: "success",
        title: "Appended to RAMS",
        message: "Survey summary added to RAMS handover notes — open RAMS to review the client handover appendix.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "Append failed", message: e?.message || "Could not append to RAMS." });
    }
  };

  const onRamsLink = (ramsId) => {
    const doc = ramsDocs.find((d) => d.id === ramsId);
    setForm((f) => {
      const next = {
        ...f,
        linkedRamsId: ramsId,
        updatedAt: new Date().toISOString(),
      };
      if (doc) {
        if (doc.surveyWorkType && !f.surveyType) next.surveyType = doc.surveyWorkType;
        if (doc.surveyDeliverables && !f.sections?.scope) {
          next.sections = { ...f.sections, scope: doc.surveyDeliverables };
        }
        if (doc.surveyMethodStatement && !f.sections?.methodology) {
          next.sections = { ...next.sections, methodology: doc.surveyMethodStatement };
        }
        if (doc.projectName && !f.projectName) next.projectName = doc.projectName;
      }
      return next;
    });
  };

  const addPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({
        ...f,
        photos: [...(f.photos || []), { id: `ph_${Date.now()}`, dataUrl: reader.result, caption: "", category: "field_work" }],
        updatedAt: new Date().toISOString(),
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCadUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCadBusy(true);
    try {
      const analysis = await readCadFile(file);
      const gapLabels = (form.utilityRecords?.informationGaps || [])
        .map((k) => UTILITY_RECORDS_GAPS.find((g) => g.key === k)?.label)
        .filter(Boolean);
      const next = mergeCadAnalysisIntoReport(form, analysis, {
        whatWasNotFound: form.utilityRecords?.whatWasNotFound,
        recordsGapLabels: gapLabels,
      });
      setForm({ ...next, updatedAt: new Date().toISOString() });
      pushAudit({ action: "survey_report_cad_import", entity: "survey_report", detail: file.name });
    } catch (err) {
      pushToast({ type: "error", title: "CAD import failed", message: err?.message || "Could not read CAD file." });
    } finally {
      setCadBusy(false);
      e.target.value = "";
    }
  };

  const handleCadLayerMappings = (layerMappings) => {
    if (!form.cadImport?.layerBreakdown?.length) return;
    const gapLabels = (form.utilityRecords?.informationGaps || [])
      .map((k) => UTILITY_RECORDS_GAPS.find((g) => g.key === k)?.label)
      .filter(Boolean);
    const nextCad = applyCadLayerMappings(form.cadImport, layerMappings, {
      whatWasNotFound: form.utilityRecords?.whatWasNotFound,
      recordsGaps: gapLabels,
    });
    let findings = String(form.sections?.findings || "").trim();
    const marker = "=== CAD utility length summary";
    if (findings.includes(marker)) {
      findings = findings.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n===|$)`, "m"), nextCad.narrative).trim();
    }
    setForm((f) => {
      const withCad = {
        ...f,
        cadImport: nextCad,
        sections: { ...f.sections, findings },
        updatedAt: new Date().toISOString(),
      };
      const seeded = seedUtilitiesTableFromCad(withCad, { replaceCadRows: true });
      if (!seeded) return withCad;
      const { _cadSeedMeta, ...clean } = seeded;
      return clean;
    });
  };

  const handleSeedUtilitiesFromCad = () => {
    const seeded = seedUtilitiesTableFromCad(form, { replaceCadRows: true });
    if (!seeded) {
      pushToast({ type: "warn", title: "CAD → utilities", message: "Upload a DXF with classified layers first." });
      return;
    }
    const meta = seeded._cadSeedMeta || {};
    const { _cadSeedMeta, ...clean } = seeded;
    setForm(clean);
    pushToast({
      type: "success",
      title: "Utilities seeded from CAD",
      message: `${meta.added || 0} row(s) refreshed into the schedule.`,
    });
  };

  const linkedRams = ramsDocs.find((d) => d.id === form.linkedRamsId);
  const geoPhotoCount = useMemo(
    () => (form.projectId ? countGeoPhotosForReport(geoPhotos, form.projectId) : 0),
    [geoPhotos, form.projectId]
  );
  const pas128Stats = useMemo(() => buildPas128SummaryStats(form), [form]);
  const editorQuality = useMemo(() => surveyReportQuality(form), [form]);
  const isGiReport = form.surveyType === "site_investigation_campaign";
  const qaProgress = useMemo(() => getQaChecklistProgress(form.qaChecklist, form.surveyType), [form.qaChecklist, form.surveyType]);
  const qaChecklistGroups = useMemo(() => getQaChecklistGroupsForSurveyType(form.surveyType), [form.surveyType]);
  const qaGroupProgress = useMemo(() => getQaGroupProgress(form.qaChecklist, form.surveyType), [form.qaChecklist, form.surveyType]);
  const prevQaComplete = useRef(qaProgress.complete);
  useEffect(() => {
    if (qaProgress.complete && !prevQaComplete.current && form.status !== "final") {
      burstSurveyCelebration(0.42);
    }
    prevQaComplete.current = qaProgress.complete;
  }, [qaProgress.complete, form.status]);
  const finalGate = useMemo(() => evaluateSurveyFinalGate(form), [form]);
  const exportGate = useMemo(() => evaluateSurveyExportGate(form), [form]);
  const projectPermits = useMemo(
    () => listPermitsForSurveyProject(permits, form.projectId),
    [permits, form.projectId]
  );
  const blockersContext = useMemo(
    () => ({ project: formProject, projectPlans: projectPlansForForm, geoPhotos, gprReports }),
    [formProject, projectPlansForForm, geoPhotos, gprReports]
  );
  const showTrialHolesTable =
    form.surveyType === "utility_mapping_survey" ||
    form.surveyType === "eml_cat_survey" ||
    form.surveyType === "gpr_survey" ||
    form.pas128Ql === "B0";
  const specialistConfig = useMemo(() => getSpecialistFindingsConfig(form.surveyType), [form.surveyType]);
  const photoCoverage = useMemo(() => surveyPhotoCategoryCoverage(form.photos), [form.photos]);
  const showTopoClosure = ["topographical_survey", "setting_out", "gnss_control"].includes(form.surveyType);
  const blockersPanelRef = useRef(null);
  const editorPanelRef = useRef(null);

  const goToSurveyFix = useCallback((tabOrTarget, opts = {}) => {
    const target =
      tabOrTarget && typeof tabOrTarget === "object"
        ? resolveSurveyFixTarget({ ...tabOrTarget, ...opts })
        : resolveSurveyFixTarget({
            tab: typeof tabOrTarget === "string" ? tabOrTarget : undefined,
            ...opts,
          });
    setTab(target.tab);
    scheduleSurveyFixScroll(target.anchor, { root: editorPanelRef.current });
  }, []);

  const handleSurveyAutofix = useCallback(
    (fixId) => {
      const next = applySurveyAutofix(fixId, form);
      if (next) setForm(next);
    },
    [form]
  );
  const prevTab = adjacentSurveyTab(tab, "prev");
  const nextTabNav = adjacentSurveyTab(tab, "next");
  const prevSimpleStep = simpleMode ? adjacentSimpleStep(activeSimpleStep.id, "prev") : null;
  const nextSimpleStep = simpleMode ? adjacentSimpleStep(activeSimpleStep.id, "next") : null;

  const printExtras = useMemo(() => {
    const project = projects.find((p) => p.id === form.projectId);
    return {
      ramsTitle: linkedRams?.title || linkedRams?.documentNo || "",
      projectLat: project?.lat,
      projectLng: project?.lng,
    };
  }, [linkedRams, form.projectId, projects]);

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadSurveyReportPdf } = await import("./surveyReportPdf");
      const result = await downloadSurveyReportPdf(form, printExtras);
      pushAudit({ action: "survey_report_pdf", entity: "survey_report", detail: form.ref || form.id });
      pushToast({
        type: "success",
        title: "PDF downloaded",
        message: result?.fileName ? `${result.fileName}${result.pages ? ` · ${result.pages} page(s)` : ""}` : "Survey report PDF saved.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "PDF export failed", message: e?.message || "Could not generate PDF." });
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadHandoverPack = async () => {
    setPdfBusy(true);
    setPackProgress("Starting…");
    try {
      const { downloadSurveyHandoverZip } = await import("./surveyHandoverPack");
      const org = getOrgSettings();
      const shareUrl = form.ref
        ? buildOrgShareUrlWithRef(org, form.ref, isUtilityMappingOrg() ? "https://u-map.co.uk/" : "https://mysafeops.com/")
        : "";
      await downloadSurveyHandoverZip(
        form,
        { ...printExtras, org, shareUrl },
        geoPhotos,
        {
          onProgress: (phase) => setPackProgress(phase),
        }
      );
      pushAudit({ action: "survey_handover_pack", entity: "survey_report", detail: form.ref || form.id });
      pushToast({ type: "success", title: "Handover pack", message: "ZIP download started." });
    } catch (e) {
      pushToast({ type: "error", title: "Handover pack failed", message: e?.message || "Could not build handover pack." });
    } finally {
      setPdfBusy(false);
      setPackProgress("");
    }
  };

  const preparePayload = (extra = {}) => {
    let payload = {
      ...form,
      ...extra,
      limitationsText: form.limitationsText || buildLimitationsFromKeys(form.limitationKeys),
    };
    if (payload.parentReportId) {
      const parent = reports.find((r) => r.id === payload.parentReportId);
      if (parent) payload.changesSincePrevious = compareSurveyReports(parent, payload);
    }
    // Keep PAS128 anomaly cards in sync with linked / project GPR on every save.
    if (gprReports?.length) {
      payload = autoSyncGprIntoSurvey(payload, gprReports);
    }
    return payload;
  };

  const handleSave = async (extra = {}, opts = {}) => {
    const skipSmartFillPrompt = opts.skipSmartFillPrompt === true;
    setSaving(true);
    try {
      const wasDraft = form.status !== "final";
      let payload = preparePayload(extra);

      if (payload.status === "final") {
        const finalGate = evaluateSurveyFinalGate(payload);
        if (!finalGate.allowed) {
          setSaving(false);
          pushToast({
            type: "warn",
            title: "Cannot mark final",
            message: finalGate.message || "Complete required items first.",
            durationMs: 5000,
          });
          return;
        }
      }

      const q = surveyReportQuality(payload);
      if (!skipSmartFillPrompt && q.score < 50 && payload.status !== "final") {
        setSaving(false);
        setConfirmDialog({
          title: "Report less than 50% complete",
          message: `Currently ${q.score}%. Run Smart fill to auto-complete missing sections before saving?`,
          confirmLabel: "Smart fill & save",
          cancelLabel: "Save as-is",
          onConfirm: () => {
            setConfirmDialog(null);
            (async () => {
              setSaving(true);
              try {
                let p = preparePayload(extra);
                const project = projects.find((x) => x.id === p.projectId);
                p = await runSmartFillAll(p, {
                  project,
                  ramsDocs,
                  projectPlans: projectPlansForForm,
                  linkedRams,
                  useAi: false,
                  permits,
                });
                setForm({ ...p, updatedAt: new Date().toISOString() });
                onSave(p);
                try {
                  sessionStorage.removeItem(SURVEY_DRAFT_KEY);
                } catch {
                  /* ignore */
                }
              } finally {
                setSaving(false);
              }
            })();
          },
          onCancel: () => {
            setConfirmDialog(null);
            setSaving(true);
            try {
              onSave(payload);
              try {
                sessionStorage.removeItem(SURVEY_DRAFT_KEY);
              } catch {
                /* ignore */
              }
            } finally {
              setSaving(false);
            }
          },
        });
        return;
      }
      onSave(payload);
      if (wasDraft && payload.status === "final") {
        burstSurveyCelebration();
        setHandoverOpen(true);
      }
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2500);
      pushToast({
        type: "success",
        title: payload.status === "final" ? "Report issued" : "Saved",
        message: payload.ref || payload.title || "Survey report updated.",
        durationMs: 2200,
      });
      try {
        sessionStorage.removeItem(SURVEY_DRAFT_KEY);
      } catch {
        /* ignore */
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current({}, {});
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setLivePreviewOpen((open) => !open);
      }
      if (!typing && e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        if (simpleMode) {
          const step = adjacentSimpleStep(activeSimpleStep.id, "next");
          if (step) setTab(step.tabs[0]);
        } else {
          const n = adjacentSurveyTab(tab, "next");
          if (n) setTab(n);
        }
      }
      if (!typing && e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        if (simpleMode) {
          const step = adjacentSimpleStep(activeSimpleStep.id, "prev");
          if (step) setTab(step.tabs[0]);
        } else {
          const p = adjacentSurveyTab(tab, "prev");
          if (p) setTab(p);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab, simpleMode, activeSimpleStep.id]);

  return (
    <ModuleOverlay>
      <SurveyHandoverModal
        open={handoverOpen}
        celebrate={handoverOpen}
        report={form}
        linkedRams={linkedRams}
        packBusy={pdfBusy}
        packProgress={packProgress}
        onClose={() => setHandoverOpen(false)}
        onDownloadPack={downloadHandoverPack}
        onPrint={() => onPrint(form, linkedRams)}
        onAppendRams={appendSummaryToRams}
      />
      <div
        ref={editorPanelRef}
        className={`app-module-overlay__panel app-survey-report-editor${livePreviewOpen ? " app-survey-report-editor--split" : ""}`}
        style={{ ...ss.card, maxWidth: livePreviewOpen ? 1280 : 920 }}
      >
        <SurveyEditorHero
          form={form}
          project={formProject}
          onClose={onClose}
          onGoToTab={goToSurveyFix}
          livePreviewOpen={livePreviewOpen}
          onToggleLivePreview={setLivePreviewOpen}
        />

        <SurveyRevisionTimeline report={form} allReports={reports} onOpenReport={onOpenReport} />

        <SurveyHandoverStrip
          form={form}
          linkedRams={linkedRams}
          projectPermits={projectPermits}
          geoPhotoCount={geoPhotoCount}
          onGoToTab={goToSurveyFix}
        />

        <SmartAssistPanel
          form={form}
          projects={projects}
          ramsDocs={ramsDocs}
          projectPlans={projectPlansForForm}
          geoPhotos={geoPhotos}
          permits={permits}
          gprReports={gprReports}
          linkedRams={linkedRams}
          onGoToTab={goToSurveyFix}
          simpleMode={simpleMode}
          onApply={(next) => setForm({ ...next, updatedAt: new Date().toISOString() })}
        />

        <div ref={blockersPanelRef}>
          <SurveyBlockersPanel
            report={form}
            context={blockersContext}
            onGoToTab={goToSurveyFix}
            onAutofix={handleSurveyAutofix}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            type="button"
            style={{
              ...ss.btn,
              fontSize: 11,
              fontWeight: 600,
              borderColor: simpleMode ? "#0d9488" : undefined,
              background: simpleMode ? "#ccfbf1" : undefined,
              color: simpleMode ? "#115e59" : undefined,
            }}
            onClick={() => {
              const next = !simpleMode;
              setSurveySimpleModePref(next);
              setSimpleMode(next);
            }}
          >
            {simpleMode ? "Simple mode" : "Full editor"}
          </button>
        </div>
        {simpleMode ? (
          <SurveySimpleStepNav tab={tab} report={form} onTabChange={setTab} />
        ) : (
          <SurveyEditorStepNav tab={tab} report={form} onTabChange={setTab} />
        )}

        <div className={`app-survey-editor-layout${livePreviewOpen ? " app-survey-editor-layout--split" : ""}`}>
          <div className="app-survey-editor-layout__main">
        <div key={tab} className="app-survey-tab-panel">
        {showTab("details") && (
          <>
            <div data-survey-anchor="tab-details" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }} data-survey-anchor="title">
                <label style={ss.lbl} htmlFor="survey-report-title">Report title *</label>
                <input
                  style={ss.inp}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. PAS128 QLB utility mapping — Phase 1"
                 id="survey-report-title" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-ref">Report ref</label>
                <input style={ss.inp} value={form.ref} onChange={(e) => set("ref", e.target.value)} placeholder={isUtilityMappingOrg() ? "UM26-1234-WSP" : ""}  id="survey-report-ref" />
              </div>
              {isUtilityMappingOrg() ? (
                <>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-um-job-number">Job number</label>
                    <input
                      style={ss.inp}
                      value={form.umJobNumber || ""}
                      onChange={(e) => {
                        const umJobNumber = e.target.value.replace(/\D/g, "");
                        setForm((f) => {
                          const code = f.umClientCode || "";
                          const next = { ...f, umJobNumber, updatedAt: new Date().toISOString() };
                          if (umJobNumber && code) {
                            next.ref = formatUtilityMappingRef({
                              yearYY: utilityMappingJobYearYY(f.surveyDate),
                              jobNumber: umJobNumber,
                              clientCode: code,
                            });
                          }
                          return next;
                        });
                      }}
                      placeholder="1234"
                     id="survey-report-um-job-number" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-um-client-code">Client code</label>
                    <select
                      style={ss.inp}
                      value={form.umClientCode || ""}
                      onChange={(e) => {
                        const umClientCode = e.target.value;
                        const client = getUtilityMappingClient(umClientCode);
                        setForm((f) => {
                          const job = f.umJobNumber || "";
                          const next = {
                            ...f,
                            umClientCode,
                            client: client?.name || f.client,
                            updatedAt: new Date().toISOString(),
                          };
                          if (job && umClientCode) {
                            next.ref = formatUtilityMappingRef({
                              yearYY: utilityMappingJobYearYY(f.surveyDate),
                              jobNumber: job,
                              clientCode: umClientCode,
                            });
                          }
                          return next;
                        });
                      }}
                     id="survey-report-um-client-code">
                      <option value="">— Select client —</option>
                      {listUtilityMappingClients().map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.umClientCode && utilityMappingClientLogoUrl(form.umClientCode) ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={utilityMappingClientLogoUrl(form.umClientCode)}
                        alt={getUtilityMappingClient(form.umClientCode)?.name || form.umClientCode}
                        style={{
                          maxHeight: 44,
                          maxWidth: 120,
                          objectFit: "contain",
                          background: "#fff",
                          border: "1px solid var(--color-border-secondary,#e2e8f0)",
                          borderRadius: 6,
                          padding: "4px 8px",
                        }}
                      />
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Client logo · {form.umClientCode}
                      </span>
                    </div>
                  ) : null}
                  {(() => {
                    const dig = computeUtilityMappingDigRisk(form);
                    if (!dig.label) return null;
                    const bandColor =
                      dig.band === "high" ? "#b91c1c" : dig.band === "medium" ? "#b45309" : "#0f766e";
                    return (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          border: `1px solid ${bandColor}33`,
                          background: `${bandColor}0d`,
                          borderRadius: 8,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <strong style={{ color: bandColor, fontSize: 13 }}>
                            Dig readiness · {dig.score}/100 · {dig.label}
                          </strong>
                          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Live from utilities / QL / trial holes</span>
                        </div>
                        {dig.reasons?.length ? (
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--color-text-secondary)" }}>
                            {dig.reasons.slice(0, 4).map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })()}
                </>
              ) : null}
              <div data-survey-anchor="survey-date">
                <label style={ss.lbl} htmlFor="survey-report-survey-date">Survey date *</label>
                <input type="date" style={ss.inp} value={form.surveyDate} onChange={(e) => set("surveyDate", e.target.value)}  id="survey-report-survey-date" />
              </div>
              <div data-survey-anchor="surveyor">
                <label style={ss.lbl} htmlFor="survey-report-surveyor">Surveyor / author *</label>
                <input style={ss.inp} value={form.surveyor} onChange={(e) => set("surveyor", e.target.value)} placeholder="Name and role"  id="survey-report-surveyor" />
              </div>
              <div data-survey-anchor="project">
                <label style={ss.lbl} htmlFor="survey-report-project-id">Project</label>
                <select style={ss.inp} value={form.projectId} onChange={(e) => onProjectChange(e.target.value)} id="survey-report-project-id">
                  <option value="">— Select —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-client">Client</label>
                <input style={ss.inp} value={form.client} onChange={(e) => set("client", e.target.value)}  id="survey-report-client" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl} htmlFor="survey-report-site-address">Site address</label>
                <input style={ss.inp} value={form.siteAddress} onChange={(e) => set("siteAddress", e.target.value)}  id="survey-report-site-address" />
                {siteContextBadgeLabel(form) ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#27500A", background: "#EAF3DE", display: "inline-block", padding: "2px 8px", borderRadius: 999 }}>
                    Site context: {siteContextBadgeLabel(form)}
                  </div>
                ) : null}
              </div>
              {form.projectId ? (
                <div className="app-survey-editor-quicklinks" style={{ gridColumn: "1 / -1" }}>
                  <button
                    type="button"
                    style={ss.btn}
                    onClick={() => {
                      setWorkspaceNavTarget({
                        viewId: "projects",
                        projectId: form.projectId,
                        action: "viewProjectDashboard",
                      });
                      openWorkspaceView({ viewId: "projects" });
                    }}
                  >
                    Project hub
                  </button>
                  {linkedRams ? (
                    <button
                      type="button"
                      style={ss.btn}
                      onClick={() => {
                        setWorkspaceNavTarget({
                          viewId: "rams",
                          ramsId: form.linkedRamsId,
                          projectId: form.projectId,
                          action: "edit",
                        });
                        openWorkspaceView({ viewId: "rams" });
                      }}
                    >
                      Open RAMS
                    </button>
                  ) : null}
                  <button
                    type="button"
                    style={ss.btn}
                    onClick={() => {
                      setWorkspaceNavTarget({ viewId: "geo-photos", projectId: form.projectId });
                      openWorkspaceView({ viewId: "geo-photos" });
                    }}
                  >
                    Geo-photos
                  </button>
                  <button
                    type="button"
                    style={ss.btn}
                    onClick={() => {
                      setWorkspaceNavTarget({ viewId: "project-drawings", projectId: form.projectId });
                      openWorkspaceView({ viewId: "project-drawings" });
                    }}
                  >
                    Plans
                  </button>
                </div>
              ) : null}
              <div data-survey-anchor="survey-type">
                <label style={ss.lbl} htmlFor="survey-report-survey-type">Survey type *</label>
                <select style={ss.inp} value={form.surveyType} onChange={(e) => onSurveyTypeChange(e.target.value)} id="survey-report-survey-type">
                  <option value="">— Select —</option>
                  {listSurveyTypesForOrg(SURVEY_TYPES).map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div data-survey-anchor="pas128">
                <label style={ss.lbl} htmlFor="survey-report-pas128ql">PAS128 quality level</label>
                <select style={ss.inp} value={form.pas128Ql} onChange={(e) => set("pas128Ql", e.target.value)} id="survey-report-pas128ql">
                  <option value="">— Optional —</option>
                  {PAS128_QUALITY_LEVELS.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
              {pas128MethodAppliesToSurveyType(form.surveyType) ? (
                <div>
                  <label style={ss.lbl} htmlFor="survey-report-pas128method">PAS128 method (M-series)</label>
                  <select
                    style={ss.inp}
                    value={form.pas128Method || ""}
                    onChange={(e) => {
                      const key = e.target.value;
                      if (!key) {
                        set("pas128Method", "");
                        return;
                      }
                      setForm((f) => {
                        const next = applyPas128MethodToReport(f, key, { overwrite: false });
                        return {
                          ...next,
                          limitationsText: buildLimitationsFromKeys(next.limitationKeys, next.limitationsText),
                          updatedAt: new Date().toISOString(),
                        };
                      });
                    }}
                   id="survey-report-pas128method">
                    <option value="">— Optional —</option>
                    {PAS128_METHODS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {form.pas128Method ? (
                    <button
                      type="button"
                      style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44, marginTop: 6 }}
                      onClick={() =>
                        setForm((f) => {
                          const next = applyPas128MethodToReport(f, f.pas128Method, { overwrite: true });
                          return {
                            ...next,
                            limitationsText: buildLimitationsFromKeys(next.limitationKeys, next.limitationsText),
                            updatedAt: new Date().toISOString(),
                          };
                        })
                      }
                    >
                      Re-apply method template
                    </button>
                  ) : null}
                </div>
              ) : null}
              {pas128MethodAppliesToSurveyType(form.surveyType) ? (
                <div>
                  <label style={ss.lbl} htmlFor="survey-report-pas128method-secondary">Secondary method (optional)</label>
                  <select
                    style={ss.inp}
                    value={form.pas128MethodSecondary || ""}
                    onChange={(e) => set("pas128MethodSecondary", e.target.value)}
                   id="survey-report-pas128method-secondary">
                    <option value="">— None —</option>
                    {PAS128_METHODS.filter((m) => m.key !== form.pas128Method).map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
                    Cover shows combined methods (e.g. M2 + M4P) when both are set.
                  </p>
                </div>
              ) : null}
              {pas128MethodAppliesToSurveyType(form.surveyType) ? (
                <div>
                  <label style={ss.lbl} htmlFor="survey-report-print-outline">Print outline</label>
                  <select
                    style={ss.inp}
                    value={form.printOutline || "standard"}
                    onChange={(e) => set("printOutline", e.target.value)}
                   id="survey-report-print-outline">
                    {PRINT_OUTLINE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            {ramsDocs.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <label style={ss.lbl} htmlFor="survey-report-linked-rams-id">Link RAMS (prefill scope & method)</label>
                <select style={ss.inp} value={form.linkedRamsId} onChange={(e) => onRamsLink(e.target.value)} id="survey-report-linked-rams-id">
                  <option value="">— None —</option>
                  {ramsDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title || d.documentTitle || d.id}
                      {d.surveyWorkTypeLabel ? ` · ${d.surveyWorkTypeLabel}` : ""}
                    </option>
                  ))}
                </select>
                {linkedRams && (
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span>Linked to RAMS: {linkedRams.title || linkedRams.documentTitle}</span>
                    {form.scopeFromRamsAt ? (
                      <span style={{ color: "#27500A" }}>
                        Applied scope from RAMS {new Date(form.scopeFromRamsAt).toLocaleString("en-GB")}
                      </span>
                    ) : null}
                    <button type="button" style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44 }} onClick={syncScopeFromRams}>
                      Sync from RAMS
                    </button>
                    {form.surveyType ? (
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44, borderColor: "#0d9488", color: "#0f766e" }}
                        onClick={pushSurveyPackToRams}
                      >
                        Push pack to RAMS
                      </button>
                    ) : null}
                    {form.status === "final" ? (
                      <button type="button" style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44, borderColor: "#0d9488", color: "#0f766e" }} onClick={appendSummaryToRams}>
                        Append to RAMS
                      </button>
                    ) : null}
                  </div>
                )}
                {!linkedRams && form.projectId && ramsDocs.some((d) => d.projectId === form.projectId) ? (
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44, marginTop: 6 }}
                    onClick={() => {
                      const doc = pickRamsForProject(ramsDocs, form.projectId);
                      if (doc) onRamsLink(doc.id);
                    }}
                  >
                    Link project RAMS & pull scope
                  </button>
                ) : null}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <label style={ss.lbl} htmlFor="survey-report-sections">Foreword</label>
              <textarea
                style={{ ...ss.ta, minHeight: 56 }}
                value={form.sections.foreword || ""}
                onChange={(e) => setSection("foreword", e.target.value)}
                placeholder="PAS 128 foreword — auto-filled when you select a method, or write your own."
               id="survey-report-sections" />
              {form.pas128Method ? (
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44, marginTop: 6 }}
                  onClick={() =>
                    setSection("foreword", buildPas128Foreword(form))
                  }
                >
                  Insert PAS128 foreword
                </button>
              ) : null}
            </div>
            <div style={{ marginTop: 14 }} data-survey-anchor="executive-summary">
              <label style={ss.lbl} htmlFor="survey-report-sections-2">Executive summary</label>
              <textarea
                style={{ ...ss.ta, minHeight: 72 }}
                value={form.sections.executiveSummary}
                onChange={(e) => setSection("executiveSummary", e.target.value)}
                placeholder="Brief overview for the client — what was done and key outcomes."
               id="survey-report-sections-2" />
            </div>
            <div data-survey-anchor="document-control">
            <div style={ss.sectionHead}>Document control</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10 }}>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-document-control">Issue no.</label>
                <input style={ss.inp} value={form.documentControl.issueNumber} onChange={(e) => setDocControl("issueNumber", e.target.value)}  id="survey-report-document-control" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-document-control-2">Revision</label>
                <input style={ss.inp} value={form.documentControl.revision} onChange={(e) => setDocControl("revision", e.target.value)} placeholder="A"  id="survey-report-document-control-2" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-document-control-3">Issue date</label>
                <input type="date" style={ss.inp} value={form.documentControl.issueDate} onChange={(e) => setDocControl("issueDate", e.target.value)}  id="survey-report-document-control-3" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-document-control-4">Prepared by</label>
                <input style={ss.inp} value={form.documentControl.preparedBy} onChange={(e) => setDocControl("preparedBy", e.target.value)}  id="survey-report-document-control-4" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-document-control-5">Checked by</label>
                <input style={ss.inp} value={form.documentControl.checkedBy} onChange={(e) => setDocControl("checkedBy", e.target.value)}  id="survey-report-document-control-5" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-document-control-6">Approved by</label>
                <input style={ss.inp} value={form.documentControl.approvedBy} onChange={(e) => setDocControl("approvedBy", e.target.value)}  id="survey-report-document-control-6" />
              </div>
            </div>
            </div>
          </>
        )}

        {showTab("scope") && (
          <>
            <div data-survey-anchor="tab-scope" />
            <div data-survey-anchor="scope">
            <label style={ss.lbl} htmlFor="survey-report-sections-3">Scope of works *</label>
            <textarea
              style={{ ...ss.ta, minHeight: 90 }}
              value={form.sections.scope}
              onChange={(e) => setSection("scope", e.target.value)}
              placeholder="Describe the agreed survey scope, deliverables and any exclusions."
             id="survey-report-sections-3" />
            </div>
            <div data-survey-anchor="methodology">
            <div style={ss.sectionHead}>Methodology *</div>
            <textarea
              style={{ ...ss.ta, minHeight: 100 }}
              value={form.sections.methodology}
              onChange={(e) => setSection("methodology", e.target.value)}
              placeholder="Step-by-step method: control setup, detection techniques, QA checks, handover."
            />
            </div>
            <div style={ss.sectionHead}>Equipment used</div>
            <textarea
              style={{ ...ss.ta, minHeight: 60 }}
              value={form.sections.equipmentUsed}
              onChange={(e) => setSection("equipmentUsed", e.target.value)}
              placeholder="e.g. RD8000 locator, IDS Stream C GPR, Leica GS18 rover…"
            />
            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 12px" }}>
              Tip: use <strong>Equipment kit thickbox</strong> under Findings for manufacturer / appendix cards in the PDF.
            </p>
            <div style={ss.sectionHead}>Survey extent</div>
            <textarea
              style={{ ...ss.ta, minHeight: 60 }}
              value={form.sections.surveyExtent}
              onChange={(e) => setSection("surveyExtent", e.target.value)}
              placeholder="Area covered, grid spacing, boundary references."
            />
            <div style={ss.sectionHead}>Control & accuracy</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl} htmlFor="survey-report-control-accuracy">Coordinate system</label>
                <input style={ss.inp} value={form.controlAccuracy.coordinateSystem} onChange={(e) => setControl("coordinateSystem", e.target.value)}  id="survey-report-control-accuracy" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-control-accuracy-2">Control source</label>
                <input style={ss.inp} value={form.controlAccuracy.controlSource} onChange={(e) => setControl("controlSource", e.target.value)}  id="survey-report-control-accuracy-2" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-control-accuracy-3">Horizontal tolerance</label>
                <input style={ss.inp} value={form.controlAccuracy.horizontalTolerance} onChange={(e) => setControl("horizontalTolerance", e.target.value)}  id="survey-report-control-accuracy-3" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-control-accuracy-4">Vertical tolerance</label>
                <input style={ss.inp} value={form.controlAccuracy.verticalTolerance} onChange={(e) => setControl("verticalTolerance", e.target.value)}  id="survey-report-control-accuracy-4" />
              </div>
              {showTopoClosure ? (
                <>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-control-accuracy-5">Traverse closure</label>
                    <input
                      style={ss.inp}
                      value={form.controlAccuracy.traverseClosure}
                      onChange={(e) => setControl("traverseClosure", e.target.value)}
                      placeholder="e.g. 1:50,000 / 8 mm"
                     id="survey-report-control-accuracy-5" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-control-accuracy-6">Level closure</label>
                    <input
                      style={ss.inp}
                      value={form.controlAccuracy.levelClosure}
                      onChange={(e) => setControl("levelClosure", e.target.value)}
                      placeholder="e.g. ±3 mm"
                     id="survey-report-control-accuracy-6" />
                  </div>
                </>
              ) : null}
            </div>
            <label style={ss.lbl} htmlFor="survey-report-control-accuracy-7">Control points / notes</label>
            <textarea
              style={{ ...ss.ta, minHeight: 56 }}
              value={form.controlAccuracy.controlPointsNotes}
              onChange={(e) => setControl("controlPointsNotes", e.target.value)}
              placeholder="Control point IDs, residuals, independent checks…"
             id="survey-report-control-accuracy-7" />
            <div data-survey-anchor="deliverables">
            <div style={ss.sectionHead}>Deliverables schedule</div>
            <RowTableEditor
              rows={form.deliverables}
              onChange={(deliverables) => setForm((f) => ({ ...f, deliverables, updatedAt: new Date().toISOString() }))}
              emptyLabel="No deliverables listed — Smart fill adds defaults by survey type."
              addLabel="+ Add deliverable"
              columns={[
                { key: "format", label: "Format", options: DELIVERABLE_FORMAT_OPTIONS },
                { key: "description", label: "Description", placeholder: "Utility mark-up PDF" },
                { key: "crs", label: "CRS / grid", placeholder: "OSGB36" },
                { key: "status", label: "Status", placeholder: "Issued with report" },
              ]}
            />
            </div>
            {isUtilityMappingOrg() ? (
              <>
                <div style={{ ...ss.sectionHead, marginTop: 16 }}>Drawing register</div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
                  CAD sheets for the issued pack. Leave empty to auto-build from the report ref on print.
                </p>
                <RowTableEditor
                  rows={form.drawingSheets || []}
                  onChange={(drawingSheets) => setForm((f) => ({ ...f, drawingSheets, updatedAt: new Date().toISOString() }))}
                  emptyLabel="No custom sheets — print will use the default UM register."
                  addLabel="+ Add sheet"
                  columns={[
                    { key: "sheet", label: "Sheet", placeholder: "UM26-1234-WSP-01" },
                    { key: "title", label: "Title", placeholder: "Utility survey — overall plan" },
                    { key: "scale", label: "Scale", placeholder: "As noted" },
                    { key: "status", label: "Status", placeholder: "Rev A" },
                  ]}
                />
                <button
                  type="button"
                  style={{ ...ss.btn, marginTop: 8 }}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      drawingSheets: buildUtilityMappingDrawingSheets({ ...f, drawingSheets: [] }),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                >
                  Seed default sheets
                </button>
              </>
            ) : null}
          </>
        )}

        {showTab("professional") && (
          <>
            <div data-survey-anchor="tab-professional" />
            <div style={ss.sectionHead}>Survey programme</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-survey-programme">Start time</label>
                <input type="time" style={ss.inp} value={form.surveyProgramme.startTime} onChange={(e) => setProgramme("startTime", e.target.value)}  id="survey-report-survey-programme" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-survey-programme-2">End time</label>
                <input type="time" style={ss.inp} value={form.surveyProgramme.endTime} onChange={(e) => setProgramme("endTime", e.target.value)}  id="survey-report-survey-programme-2" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-survey-programme-3">Hours on site</label>
                <input style={ss.inp} value={form.surveyProgramme.hoursOnSite} onChange={(e) => setProgramme("hoursOnSite", e.target.value)} placeholder="e.g. 6.5"  id="survey-report-survey-programme-3" />
              </div>
            </div>
            <label style={ss.lbl} htmlFor="survey-report-survey-programme-4">Personnel on site</label>
            <input
              style={{ ...ss.inp, marginBottom: 10 }}
              value={form.surveyProgramme.personnel}
              onChange={(e) => setProgramme("personnel", e.target.value)}
              placeholder="Surveyor, assistant, client rep…"
             id="survey-report-survey-programme-4" />
            <label style={ss.lbl} htmlFor="survey-report-survey-programme-5">Site access notes</label>
            <textarea
              style={{ ...ss.ta, minHeight: 48, marginBottom: 14 }}
              value={form.surveyProgramme.siteAccessNotes}
              onChange={(e) => setProgramme("siteAccessNotes", e.target.value)}
             id="survey-report-survey-programme-5" />
            <div data-survey-anchor="qa">
            <div style={ss.sectionHead}>QA & verification ({qaProgress.checked}/{qaProgress.total})</div>
            <div
              className={`app-survey-qa-meter${qaProgress.complete ? " app-survey-qa-meter--complete" : ""}`}
              aria-label={`QA checklist ${qaProgress.pct} percent complete`}
            >
              <div className="app-survey-qa-meter__bar">
                <div className="app-survey-qa-meter__fill" style={{ width: `${qaProgress.pct}%` }} />
              </div>
              <span className="app-survey-qa-meter__label">
                {qaProgress.complete ? "All checks complete — ready for sign-off" : `${qaProgress.pct}% complete for this survey type`}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 10, lineHeight: 1.45 }}>
              Generic UK surveying checks — align with PAS 128 / HSG47 where applicable. Not a substitute for your RAMS or client brief.
            </p>
            {qaChecklistGroups.map((group) => {
              const gp = qaGroupProgress.find((g) => g.id === group.id);
              return (
              <div key={group.id} className="app-survey-qa-group" style={{ marginBottom: 12 }}>
                <div className="app-survey-qa-group__head">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    {group.label}
                    {gp ? (
                      <span className={`app-survey-qa-group__badge${gp.complete ? " app-survey-qa-group__badge--done" : ""}`}>
                        {gp.checked}/{gp.total}
                      </span>
                    ) : null}
                  </div>
                  {gp && !gp.complete ? (
                    <button type="button" className="app-survey-qa-group__action" onClick={() => setQaGroup(group.id, true)}>
                      Mark all
                    </button>
                  ) : gp?.complete ? (
                    <button type="button" className="app-survey-qa-group__action app-survey-qa-group__action--muted" onClick={() => setQaGroup(group.id, false)}>
                      Clear
                    </button>
                  ) : null}
                </div>
                <CheckboxGrid
                  options={group.items}
                  selected={Object.entries(form.qaChecklist || {})
                    .filter(([, v]) => v)
                    .map(([k]) => k)}
                  onToggle={(key) => setQa(key, !form.qaChecklist?.[key])}
                />
              </div>
            );
            })}
            </div>
            <div data-survey-anchor="standards">
            <div style={ss.sectionHead}>Standards referenced</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 8, lineHeight: 1.45 }}>
              Tick standards cited in this report — they appear in the PDF issue pack.
            </p>
            <CheckboxGrid
              options={SURVEY_PUBLIC_STANDARDS}
              selected={form.standardsCited || []}
              onToggle={toggleStandardCited}
            />
            </div>
            <div style={ss.sectionHead}>Health & safety cross-reference</div>
            {form.projectId ? (
              <div style={{ marginBottom: 10 }}>
                <label style={ss.lbl}>Link permit to dig (PTW)</label>
                <select
                  style={ss.inp}
                  value={form.hseRefs.linkedPermitId || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      setForm((f) => ({
                        ...f,
                        hseRefs: { ...f.hseRefs, linkedPermitId: "", permitRef: "" },
                        updatedAt: new Date().toISOString(),
                      }));
                      return;
                    }
                    const permit = projectPermits.find((p) => p.id === id);
                    if (permit) {
                      setForm((f) => ({
                        ...applyLinkedPermitToReport(f, permit),
                        updatedAt: new Date().toISOString(),
                      }));
                    }
                  }}
                >
                  <option value="">— Select project permit —</option>
                  {projectPermits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.permitNo || p.ref || p.id) + (p.type ? ` · ${p.type.replace(/_/g, " ")}` : "")}
                    </option>
                  ))}
                </select>
                {form.hseRefs.linkedPermitId ? (
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11, marginTop: 6 }}
                    onClick={() =>
                      openWorkspaceView({ viewId: "permits", permitId: form.hseRefs.linkedPermitId, mode: "view" })
                    }
                  >
                    Open linked permit
                  </button>
                ) : null}
                {projectPermits.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "6px 0 0" }}>
                    No permits on this project — create a permit to dig under Permits, then link here.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-hse-refs">Permit reference</label>
                <input style={ss.inp} value={form.hseRefs.permitRef} onChange={(e) => setHse("permitRef", e.target.value)} placeholder="Auto-filled from permits if linked"  id="survey-report-hse-refs" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-hse-refs-2">CAT scan reference</label>
                <input style={ss.inp} value={form.hseRefs.catScanRef} onChange={(e) => setHse("catScanRef", e.target.value)}  id="survey-report-hse-refs-2" />
              </div>
            </div>
            <label style={ss.lbl} htmlFor="survey-report-hse-refs-3">RAMS excerpt (optional)</label>
            <textarea
              style={{ ...ss.ta, minHeight: 56, marginBottom: 14 }}
              value={form.hseRefs.ramsExcerpt}
              onChange={(e) => setHse("ramsExcerpt", e.target.value)}
              placeholder="Short method statement excerpt for the PDF."
             id="survey-report-hse-refs-3" />
            {form.surveyType === "uav_aerial" ? (
              <>
                <div style={ss.sectionHead}>UAV / CAA compliance</div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 10, lineHeight: 1.45 }}>
                  Operator authorisation and flight-safety references shown in the report and handover pack.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-uav-compliance">CAA Operator ID</label>
                    <input
                      style={ss.inp}
                      value={form.uavCompliance.caaOperatorId}
                      onChange={(e) => setUavCompliance("caaOperatorId", e.target.value)}
                      placeholder="GBR-OP-XXXXXXXX"
                     id="survey-report-uav-compliance" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-uav-compliance-2">Flyer ID(s)</label>
                    <input
                      style={ss.inp}
                      value={form.uavCompliance.flyerIds}
                      onChange={(e) => setUavCompliance("flyerIds", e.target.value)}
                      placeholder="GBR-FLY-XXXXXXXX"
                     id="survey-report-uav-compliance-2" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-uav-compliance-3">GVC / A2 CofC reference</label>
                    <input
                      style={ss.inp}
                      value={form.uavCompliance.authorisationRef}
                      onChange={(e) => setUavCompliance("authorisationRef", e.target.value)}
                      placeholder="Operational authorisation ref"
                     id="survey-report-uav-compliance-3" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-uav-compliance-4">Drone registration / serial</label>
                    <input
                      style={ss.inp}
                      value={form.uavCompliance.droneRegistration}
                      onChange={(e) => setUavCompliance("droneRegistration", e.target.value)}
                     id="survey-report-uav-compliance-4" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-uav-compliance-5">Insurance policy reference</label>
                    <input
                      style={ss.inp}
                      value={form.uavCompliance.insurancePolicyRef}
                      onChange={(e) => setUavCompliance("insurancePolicyRef", e.target.value)}
                     id="survey-report-uav-compliance-5" />
                  </div>
                  <div>
                    <label style={ss.lbl} htmlFor="survey-report-uav-compliance-6">NOTAM reference</label>
                    <input
                      style={ss.inp}
                      value={form.uavCompliance.notamRef}
                      onChange={(e) => setUavCompliance("notamRef", e.target.value)}
                      placeholder="If filed for this flight"
                     id="survey-report-uav-compliance-6" />
                  </div>
                </div>
                <label style={ss.lbl} htmlFor="survey-report-uav-compliance-7">Ground exclusion / emergency landing plan (optional)</label>
                <textarea
                  style={{ ...ss.ta, minHeight: 48, marginBottom: 14 }}
                  value={form.uavCompliance.groundExclusionPlanRef}
                  onChange={(e) => setUavCompliance("groundExclusionPlanRef", e.target.value)}
                  placeholder="Ground crew exclusion zone and emergency landing plan reference."
                 id="survey-report-uav-compliance-7" />
              </>
            ) : null}
            <div data-survey-anchor="calibration">
            <div style={ss.sectionHead}>Equipment calibration</div>
            <RowTableEditor
              rows={form.equipmentCalibration}
              onChange={(equipmentCalibration) => setForm((f) => ({ ...f, equipmentCalibration, updatedAt: new Date().toISOString() }))}
              emptyLabel="No calibration records — Smart fill adds defaults by survey type."
              addLabel="+ Add instrument"
              columns={[
                { key: "instrument", label: "Instrument", placeholder: "RD8000" },
                { key: "serialNo", label: "Serial no." },
                { key: "calibrationDue", label: "Cal. due", type: "date" },
                { key: "status", label: "Status", options: EQUIPMENT_CALIBRATION_STATUS },
              ]}
            />
            </div>
            <div style={ss.sectionHead}>Revision history</div>
            <RowTableEditor
              rows={form.revisionHistory}
              onChange={(revisionHistory) => setForm((f) => ({ ...f, revisionHistory, updatedAt: new Date().toISOString() }))}
              emptyLabel="No revision history — initial issue added on Smart fill."
              addLabel="+ Add revision"
              columns={[
                { key: "date", label: "Date", type: "date" },
                { key: "revision", label: "Rev", placeholder: "B" },
                { key: "author", label: "Author" },
                { key: "description", label: "Description", placeholder: "Updated findings" },
              ]}
            />
            <div style={ss.sectionHead}>Sign-off</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-signatures">Surveyor name</label>
                <input style={ss.inp} value={form.signatures.surveyorName} onChange={(e) => setSig("surveyorName", e.target.value)}  id="survey-report-signatures" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-signatures-2">Surveyor sign date</label>
                <input type="date" style={ss.inp} value={form.signatures.surveyorSignedDate} onChange={(e) => setSig("surveyorSignedDate", e.target.value)}  id="survey-report-signatures-2" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-signatures-3">Client name (optional)</label>
                <input style={ss.inp} value={form.signatures.clientName} onChange={(e) => setSig("clientName", e.target.value)}  id="survey-report-signatures-3" />
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-signatures-4">Client acceptance date</label>
                <input type="date" style={ss.inp} value={form.signatures.clientAcceptedDate} onChange={(e) => setSig("clientAcceptedDate", e.target.value)}  id="survey-report-signatures-4" />
              </div>
            </div>
          </>
        )}

        {showTab("weather") && (
          <>
            <div data-survey-anchor="weather">
            {(form.weather?.tempC != null || form.weather?.windMph != null) && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#f0f9ff",
                  border: "0.5px solid #bae6fd",
                  fontSize: 12,
                }}
              >
                {form.weather.tempC != null && (
                  <span>
                    Temperature: {form.weather.tempMinC != null && form.weather.tempMinC !== form.weather.tempC
                      ? `${form.weather.tempMinC}–${form.weather.tempC}°C`
                      : `${form.weather.tempC}°C`}
                  </span>
                )}
                {form.weather.windMph != null && (
                  <span style={{ marginLeft: form.weather.tempC != null ? 12 : 0 }}>Wind: ~{Number(form.weather.windMph).toFixed(1)} mph</span>
                )}
                {form.weather.fetchedAt && (
                  <span style={{ display: "block", marginTop: 4, color: "var(--color-text-secondary)" }}>
                    Fetched {new Date(form.weather.fetchedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-weather">Ground surface</label>
                <select style={ss.inp} value={form.weather.groundSurface} onChange={(e) => setWeather("groundSurface", e.target.value)} id="survey-report-weather">
                  {GROUND_SURFACE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ss.lbl} htmlFor="survey-report-weather-2">Rain during survey</label>
                <select style={ss.inp} value={form.weather.rainDuringSurvey} onChange={(e) => setWeather("rainDuringSurvey", e.target.value)} id="survey-report-weather-2">
                  {RAIN_DURING_SURVEY.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={ss.sectionHead}>Conditions observed</div>
            <CheckboxGrid
              options={WEATHER_PHENOMENA}
              selected={form.weather.phenomena}
              onToggle={(key) => setWeather("phenomena", toggleArray(form.weather.phenomena, key))}
            />
            <div style={ss.sectionHead}>Methods potentially affected</div>
            <CheckboxGrid
              options={METHODS_AFFECTED}
              selected={form.weather.methodsAffected}
              onToggle={(key) => setWeather("methodsAffected", toggleArray(form.weather.methodsAffected, key))}
            />
            <div style={{ marginTop: 14 }}>
              <label style={ss.lbl} htmlFor="survey-report-weather-3">Conditions narrative</label>
              <textarea
                style={{ ...ss.ta, minHeight: 56 }}
                value={form.weather.conditionsNarrative}
                onChange={(e) => setWeather("conditionsNarrative", e.target.value)}
                placeholder="Describe weather at site and any impact on survey programme."
               id="survey-report-weather-3" />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl} htmlFor="survey-report-weather-4">Equipment / method impact</label>
              <textarea
                style={{ ...ss.ta, minHeight: 56 }}
                value={form.weather.equipmentMethodImpact}
                onChange={(e) => setWeather("equipmentMethodImpact", e.target.value)}
                placeholder="e.g. GPR attenuation on wet clay; GNSS held under tree cover."
               id="survey-report-weather-4" />
            </div>
            </div>
          </>
        )}

        {showTab("records") && (
          <>
            <div data-survey-anchor="records">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.entries(UTILITY_RECORDS_PRESETS).map(([key, p]) => (
                <button key={key} type="button" style={{ ...ss.btn, fontSize: 11 }} onClick={() => applyRecordsPreset(key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={ss.sectionHead}>Sources consulted</div>
            <CheckboxGrid
              options={UTILITY_RECORDS_SOURCES}
              selected={form.utilityRecords.sourcesConsulted}
              onToggle={(key) => setRecords("sourcesConsulted", toggleArray(form.utilityRecords.sourcesConsulted, key))}
            />
            <div style={ss.sectionHead}>Outcomes</div>
            <CheckboxGrid
              options={UTILITY_RECORDS_OUTCOMES}
              selected={form.utilityRecords.outcomes}
              onToggle={(key) => setRecords("outcomes", toggleArray(form.utilityRecords.outcomes, key))}
            />
            <div style={ss.sectionHead}>Information gaps</div>
            <CheckboxGrid
              options={UTILITY_RECORDS_GAPS}
              selected={form.utilityRecords.informationGaps}
              onToggle={(key) => setRecords("informationGaps", toggleArray(form.utilityRecords.informationGaps, key))}
            />
            <div style={{ marginTop: 14 }}>
              <label style={ss.lbl} htmlFor="survey-report-utility-records">What was found in records</label>
              <textarea style={{ ...ss.ta, minHeight: 56 }} value={form.utilityRecords.whatWasFound} onChange={(e) => setRecords("whatWasFound", e.target.value)}  id="survey-report-utility-records" />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl} htmlFor="survey-report-utility-records-2">What was not found / not available</label>
              <textarea style={{ ...ss.ta, minHeight: 56 }} value={form.utilityRecords.whatWasNotFound} onChange={(e) => setRecords("whatWasNotFound", e.target.value)}  id="survey-report-utility-records-2" />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl} htmlFor="survey-report-utility-records-3">Gap explanation</label>
              <textarea style={{ ...ss.ta, minHeight: 48 }} value={form.utilityRecords.gapExplanation} onChange={(e) => setRecords("gapExplanation", e.target.value)}  id="survey-report-utility-records-3" />
            </div>
            <div data-survey-anchor="dbyd">
            <div style={ss.sectionHead}>LSBUD / DBYD enquiry log</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
              Structured desktop utility records enquiries — supports HSG47 / PAS128 records review traceability.
            </p>
            <RowTableEditor
              rows={form.dbydEnquiries || []}
              onChange={(dbydEnquiries) => setForm((f) => ({ ...f, dbydEnquiries, updatedAt: new Date().toISOString() }))}
              emptyLabel="No LSBUD / DBYD enquiries logged yet."
              addLabel="+ Add enquiry"
              columns={[
                { key: "provider", label: "Provider", options: DBYD_ENQUIRY_PROVIDERS },
                { key: "reference", label: "Reference", placeholder: "LSBUD-12345" },
                { key: "enquiryDate", label: "Date", type: "date" },
                { key: "undertakers", label: "Undertakers", placeholder: "DNO, water company…" },
                { key: "status", label: "Status", options: DBYD_ENQUIRY_STATUS },
                { key: "notes", label: "Notes", placeholder: "Partial pack — gas missing" },
              ]}
            />
            </div>
            <div style={ss.sectionHead}>Undertaker response status</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
              Per-undertaker desktop search outcomes (PAS 128 Survey Type D / M1). Status: Affected, Not affected, or No response.
            </p>
            <RowTableEditor
              rows={form.undertakerResponses || []}
              onChange={(undertakerResponses) => setForm((f) => ({ ...f, undertakerResponses, updatedAt: new Date().toISOString() }))}
              emptyLabel="No undertaker responses logged yet."
              addLabel="+ Add undertaker"
              columns={[
                { key: "undertaker", label: "Undertaker", placeholder: "Statutory undertaker name" },
                { key: "category", label: "Category", options: UNDERTAKER_CATEGORIES },
                { key: "status", label: "Status", options: UNDERTAKER_RESPONSE_STATUS },
                { key: "responseDate", label: "Response date", type: "date" },
                { key: "notes", label: "Notes", placeholder: "Optional notes" },
              ]}
            />
            <div style={ss.sectionHead}>Records references</div>
            <RowTableEditor
              rows={form.recordsReferences}
              onChange={(recordsReferences) => setForm((f) => ({ ...f, recordsReferences, updatedAt: new Date().toISOString() }))}
              emptyLabel="Add DNO / undertaker reference numbers received."
              addLabel="+ Add record reference"
              columns={[
                { key: "source", label: "Source", placeholder: "UK Power Networks" },
                { key: "reference", label: "Reference", placeholder: "REF-12345" },
                { key: "receivedDate", label: "Received", type: "date" },
                { key: "status", label: "Status", options: RECORD_REF_STATUS_OPTIONS },
              ]}
            />
            </div>
          </>
        )}

        {showTab("limitations") && (
          <>
            <div data-survey-anchor="limitations">
            <div style={ss.sectionHead}>Standard limitation clauses</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
              Tick applicable items — text is assembled into the Limitations section of the printed report.
            </p>
            <CheckboxGrid options={LIMITATION_RULES} selected={form.limitationKeys} onToggle={toggleLimitation} />
            <div style={{ marginTop: 14 }}>
              <label style={ss.lbl} htmlFor="survey-report-limitations-text">Limitations text (editable)</label>
              <textarea
                style={{ ...ss.ta, minHeight: 90 }}
                value={form.limitationsText || buildLimitationsFromKeys(form.limitationKeys)}
                onChange={(e) => set("limitationsText", e.target.value)}
               id="survey-report-limitations-text" />
              <button
                type="button"
                style={{ ...ss.btn, fontSize: 11, marginTop: 6 }}
                onClick={() => set("limitationsText", buildLimitationsFromKeys(form.limitationKeys))}
              >
                Regenerate from tickboxes
              </button>
            </div>
            <div style={ss.sectionHead}>Site access limitations</div>
            <CheckboxGrid
              options={ACCESS_LIMITATION_TYPES}
              selected={form.accessLimitations}
              onToggle={(key) => set("accessLimitations", toggleArray(form.accessLimitations, key))}
            />
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl} htmlFor="survey-report-access-limitations-notes">Access notes</label>
              <textarea
                style={{ ...ss.ta, minHeight: 48 }}
                value={form.accessLimitationsNotes}
                onChange={(e) => set("accessLimitationsNotes", e.target.value)}
               id="survey-report-access-limitations-notes" />
            </div>
            </div>
          </>
        )}

        {showTab("findings") && (
          <>
            <div data-survey-anchor="tab-findings" />
            {specialistConfig ? (
              <div data-survey-anchor="specialist-table">
                <div style={ss.sectionHead}>{specialistConfig.title}</div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>{specialistConfig.hint}</p>
                <RowTableEditor
                  rows={form[specialistConfig.tableKey] || []}
                  onChange={(rows) =>
                    setForm((f) => ({ ...f, [specialistConfig.tableKey]: rows, updatedAt: new Date().toISOString() }))
                  }
                  emptyLabel={`No ${specialistConfig.title.toLowerCase()} yet.`}
                  addLabel="+ Add row"
                  columns={specialistConfig.columns}
                />
              </div>
            ) : null}
            {pas128Stats ? <SurveyPas128Dashboard stats={pas128Stats} /> : null}
            {form.pas128Method ? <Pas128WorkflowStrip methodKey={form.pas128Method} className="app-survey-workflow-strip--findings" /> : null}
            <div data-survey-anchor="cad-import">
            <CadImportPanel
              cadImport={form.cadImport}
              utilitiesTable={form.utilitiesTable}
              cadBusy={cadBusy}
              ss={ss}
              onUpload={handleCadUpload}
              onLayerMappingsChange={handleCadLayerMappings}
              onSeedUtilities={handleSeedUtilitiesFromCad}
              onClear={() => setForm((f) => ({ ...f, cadImport: null, updatedAt: new Date().toISOString() }))}
            />
            </div>
            {isGiReport ? (
              <div data-survey-anchor="gi-locations">
                <div style={ss.sectionHead}>GI location schedule</div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
                  Structured table for trial pits, boreholes, DCP points and samples — links to geo-photo figures in the PDF.
                </p>
                <RowTableEditor
                  rows={form.giLocationsTable || []}
                  onChange={(giLocationsTable) => setForm((f) => ({ ...f, giLocationsTable, updatedAt: new Date().toISOString() }))}
                  emptyLabel="No GI locations — add rows, import from geo-photos, or describe in findings below."
                  addLabel="+ Add GI location"
                  columns={[
                    { key: "locationId", label: "Location ID", placeholder: "BH01" },
                    { key: "method", label: "Method", options: GI_METHOD_OPTIONS },
                    { key: "depth", label: "Depth", placeholder: "12.5 m" },
                    { key: "notes", label: "Notes", placeholder: "Made ground to 1.2 m" },
                  ]}
                />
                {form.projectId && countGeoPhotosForReport(geoPhotos, form.projectId) > 0 && (
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11, marginBottom: 12 }}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        giLocationsTable: geoPhotosToGiLocationsTable(geoPhotos, f.projectId, {
                          existingRows: f.giLocationsTable,
                        }),
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                  >
                    Import GI locations from geo-photos
                  </button>
                )}
              </div>
            ) : null}
            <div data-survey-anchor="utilities">
            <div style={ss.sectionHead}>Utility schedule (PAS128)</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
              Structured table prints before narrative findings — ideal for utility mapping reports.
            </p>
            <RowTableEditor
              rows={form.utilitiesTable}
              onChange={(utilitiesTable) => setForm((f) => ({ ...f, utilitiesTable, updatedAt: new Date().toISOString() }))}
              emptyLabel="No utilities in schedule — add rows, import from geo-photos, or describe in text below."
              addLabel="+ Add utility"
              columns={[
                { key: "utilityType", label: "Utility", options: UTILITY_TYPE_OPTIONS },
                { key: "diameter", label: "Dia.", placeholder: "150 mm" },
                { key: "material", label: "Material", placeholder: "PE / CI" },
                { key: "depth", label: "Depth", placeholder: "0.8 m" },
                { key: "source", label: "Source", options: UTILITY_SOURCE_OPTIONS },
                { key: "detectStatus", label: "Status", options: UTILITY_DETECT_STATUS },
                { key: "method", label: "Method", placeholder: "EML + GPR" },
                { key: "pas128Ql", label: "PAS128 QL", options: PAS128_QUALITY_LEVELS },
                { key: "confidence", label: "Confidence", options: UTILITY_CONFIDENCE_LEVELS },
                { key: "notes", label: "Notes", placeholder: "Near substation / TFR" },
              ]}
            />
            {form.projectId && countGeoPhotosForReport(geoPhotos, form.projectId) > 0 && (
              <button
                type="button"
                style={{ ...ss.btn, fontSize: 11, marginBottom: 12 }}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    utilitiesTable: geoPhotosToUtilitiesTable(geoPhotos, f.projectId, {
                      existingRows: f.utilitiesTable,
                      pas128Ql: f.pas128Ql,
                    }),
                    updatedAt: new Date().toISOString(),
                  }))
                }
              >
                Import utility rows from geo-photos
              </button>
            )}
            </div>
            {showTrialHolesTable ? (
              <div data-survey-anchor="trial-holes">
                <div style={ss.sectionHead}>Trial holes / Type B0 verification log</div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
                  Record intrusive verification where PAS128 Type B0 or client brief requires exposed confirmation.
                </p>
                <RowTableEditor
                  rows={form.trialHolesTable || []}
                  onChange={(trialHolesTable) => setForm((f) => ({ ...f, trialHolesTable, updatedAt: new Date().toISOString() }))}
                  emptyLabel="No trial holes logged — add rows when verification is in scope."
                  addLabel="+ Add trial hole"
                  columns={[
                    { key: "holeId", label: "ID", placeholder: "TH01" },
                    { key: "location", label: "Location", placeholder: "Grid ref / chainage" },
                    { key: "depth", label: "Depth", placeholder: "1.2 m" },
                    { key: "utilityVerified", label: "Utility", options: UTILITY_TYPE_OPTIONS },
                    { key: "pas128Ql", label: "PAS128 QL", options: PAS128_QUALITY_LEVELS },
                    { key: "result", label: "Result", placeholder: "Gas main confirmed" },
                    { key: "notes", label: "Notes", placeholder: "Hand dig, 0.5 m buffer" },
                  ]}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11 }}
                    disabled={!(form.trialHolesTable || []).length}
                    onClick={() => {
                      const next = applyTrialHolesToUtilities(form);
                      const stats = next._trialHoleApply || {};
                      const { _trialHoleApply, ...clean } = next;
                      setForm({ ...clean, updatedAt: new Date().toISOString() });
                      pushToast({
                        type: "success",
                        title: "Trial holes applied",
                        message: `Updated ${stats.updated || 0} utility row(s), created ${stats.created || 0} (QL-B0).`,
                      });
                    }}
                  >
                    Apply trial holes → utility QL-B0
                  </button>
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11 }}
                    disabled={!(form.recordItems || []).some((r) => r.status === "tfr" || r.tfr)}
                    onClick={() => {
                      setForm((f) => ({
                        ...seedTfrCadNotesFromRecords(f),
                        updatedAt: new Date().toISOString(),
                      }));
                      pushToast({
                        type: "success",
                        title: "TFR CAD notes",
                        message: "TFR undertakers added to site plan / drawing notes.",
                      });
                    }}
                  >
                    Seed TFR → CAD / site-plan notes
                  </button>
                </div>
              </div>
            ) : null}
            <SurveyPremiumFieldsEditor
              form={form}
              setForm={setForm}
              gprReports={gprReports}
              project={formProject}
              geoPhotos={geoPhotos}
              onToast={pushToast}
              onFetchGeology={async (overwrite) => {
                try {
                  const next = await fetchGeologyIntoSurveyReport(form, formProject, { overwrite: Boolean(overwrite) });
                  setForm((f) => ({ ...f, ...next, updatedAt: new Date().toISOString() }));
                  pushToast({
                    type: "success",
                    title: overwrite ? "BGS geology refreshed" : "BGS geology loaded",
                    message: "DigMap 50k + boreholes when available — confirm against site observations / SI.",
                  });
                } catch (err) {
                  pushToast({
                    type: "error",
                    title: "Geology lookup failed",
                    message: err?.message || "Could not reach BGS geology.",
                  });
                }
              }}
            />
            <div data-survey-anchor="findings">
            <label style={ss.lbl}>Findings & results *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 44 }}
                disabled={!(form.utilitiesTable?.length || form.undertakerResponses?.length)}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    sections: {
                      ...f.sections,
                      findings: buildFindingsDraft(f, { overwrite: true }),
                    },
                    updatedAt: new Date().toISOString(),
                  }))
                }
              >
                Build findings from schedule
              </button>
            </div>
            <textarea
              style={{ ...ss.ta, minHeight: 120 }}
              value={form.sections.findings}
              onChange={(e) => setSection("findings", e.target.value)}
              placeholder="Summarise survey results: utilities detected, levels, defects, anomalies, confidence notes."
            />
            </div>
            <div data-survey-anchor="recommendations">
            <div style={ss.sectionHead}>Recommendations</div>
            <textarea
              style={{ ...ss.ta, minHeight: 80 }}
              value={form.sections.recommendations}
              onChange={(e) => setSection("recommendations", e.target.value)}
              placeholder="Further works, verification, client actions, residual risks."
            />
            </div>
            {(form.sitePlanSnapshots || []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={ss.sectionHead}>Site plan images (PDF appendix)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {form.sitePlanSnapshots.map((s) => (
                    <figure key={s.planId || s.name} style={{ margin: 0, maxWidth: 200 }}>
                      <img
                        src={s.dataUrl}
                        alt={s.name || "Site plan"}
                        style={{ width: "100%", borderRadius: 6, border: "0.5px solid #e5e7eb" }}
                      />
                      <figcaption style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 4 }}>
                        {s.name || "Site plan"}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {showTab("photos") && (
          <>
            <div data-survey-anchor="photos">
            {form.projectId && countGeoPhotosForReport(geoPhotos, form.projectId) > 0 ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#f0fdfa",
                  border: "0.5px solid #99f6e4",
                  fontSize: 13,
                }}
              >
                {countGeoPhotosForReport(geoPhotos, form.projectId)} geo-photo(s) marked for report on this project.
                {form.geoPhotoImportAt ? (
                  <span style={{ color: "var(--color-text-secondary)", marginLeft: 6 }}>
                    Last import: {new Date(form.geoPhotoImportAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                ) : null}
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{ ...ss.btnP, fontSize: 12, padding: "6px 12px" }}
                    onClick={() =>
                      setForm((f) => ({
                        ...mergeGeoPhotos(f, geoPhotos, { replaceFindingsBlock: true, mergeUtilitiesTable: true }),
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                  >
                    Import geo-photos
                  </button>
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 12, padding: "6px 12px" }}
                    onClick={() => {
                      setWorkspaceNavTarget({ viewId: "geo-photos", projectId: form.projectId });
                      openWorkspaceView({ viewId: "geo-photos" });
                    }}
                  >
                    Open geo-photos
                  </button>
                </div>
              </div>
            ) : null}
            <label style={{ ...ss.btn, display: "inline-block", cursor: "pointer" }}>
              + Add photo
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={addPhoto} />
            </label>
            {photoCoverage.hasPhotos ? (
              <div className="app-survey-photo-coverage" style={{ marginTop: 10, marginBottom: 4 }}>
                <span className="app-survey-photo-coverage__label">
                  Evidence categories: {photoCoverage.covered}/{photoCoverage.total}
                </span>
                {photoCoverage.missingLabels.length ? (
                  <span className="app-survey-photo-coverage__hint">
                    Missing: {photoCoverage.missingLabels.slice(0, 3).join(", ")}
                    {photoCoverage.missingLabels.length > 3 ? ` +${photoCoverage.missingLabels.length - 3}` : ""}
                  </span>
                ) : (
                  <span className="app-survey-photo-coverage__hint app-survey-photo-coverage__hint--done">All categories covered</span>
                )}
              </div>
            ) : null}
            {(form.photos || []).length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 12 }}>No photos yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {form.photos.map((ph, idx) => (
                  <div key={ph.id || idx} style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                    <img src={ph.dataUrl} alt="" style={{ width: 100, height: 75, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <label style={ss.lbl} htmlFor={`survey-report-category-${ph.id}`}>Category</label>
                      <select
                        style={{ ...ss.inp, marginBottom: 6 }}
                        value={ph.category || "field_work"}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            photos: f.photos.map((p, i) => (i === idx ? { ...p, category: e.target.value } : p)),
                          }))
                        }
                       id={`survey-report-category-${ph.id}`}>
                        {SURVEY_PHOTO_CATEGORIES.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        style={ss.inp}
                        value={ph.caption}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            photos: f.photos.map((p, i) => (i === idx ? { ...p, caption: e.target.value } : p)),
                          }))
                        }
                        placeholder="Caption"
                      />
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 11, marginTop: 6, color: "#A32D2D" }}
                        onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </>
        )}

        {showTab("preview") && (
          <>
            <div data-survey-anchor="tab-preview" />
            {form.status !== "final" && !finalGate.allowed && finalGate.missing.length > 0 ? (
              <div className="app-survey-gate-callout app-survey-gate-callout--warn" role="status">
                <strong>Before marking final</strong>
                <ul>
                  {finalGate.missing.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="app-survey-gate-callout__fix-link"
                        onClick={() => goToSurveyFix(null, { label: item })}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="app-survey-gate-callout__action"
                  onClick={() => goToSurveyFix("professional", { anchor: "qa" })}
                >
                  Open first blocker →
                </button>
              </div>
            ) : null}
            {form.status === "final" && !exportGate.allowed && exportGate.missing.length > 0 ? (
              <div className="app-survey-gate-callout app-survey-gate-callout--info" role="status">
                <strong>Export pack</strong>
                <p>PDF print is available; batch export pack needs:</p>
                <ul>
                  {exportGate.missing.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="app-survey-gate-callout__fix-link"
                        onClick={() => goToSurveyFix(null, { label: item })}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {livePreviewOpen ? (
            <div className="app-survey-preview-hint">
              <p>Live preview is docked on the right.</p>
              <button type="button" style={ss.btn} onClick={() => setLivePreviewOpen(false)}>
                Show full-width preview here
              </button>
            </div>
          ) : (
            <PrintPreviewFrame
              html={previewHtml}
              title={`Survey report — A4 preview${previewPending ? " (updating…)" : ""}`}
              height={520}
              onPrint={() => onPrint(form, linkedRams)}
              printLabel="Print / save PDF"
            />
          )}
          </>
        )}
        </div>

        <div className="app-sticky-footer app-sticky-footer--actions app-survey-editor-shortcuts">
          <SurveyKeyboardHints />
          {simpleMode ? (
            prevSimpleStep ? (
              <button type="button" style={ss.btn} onClick={() => setTab(prevSimpleStep.tabs[0])}>
                ← {prevSimpleStep.label}
              </button>
            ) : (
              <span />
            )
          ) : prevTab ? (
            <button type="button" style={ss.btn} onClick={() => setTab(prevTab)}>
              ← Previous
            </button>
          ) : (
            <span />
          )}
          {simpleMode ? (
            nextSimpleStep ? (
              <button type="button" style={ss.btn} onClick={() => setTab(nextSimpleStep.tabs[0])}>
                {nextSimpleStep.label} →
              </button>
            ) : null
          ) : nextTabNav ? (
            <button type="button" style={ss.btn} onClick={() => setTab(nextTabNav)}>
              Next →
            </button>
          ) : null}
          <button type="button" style={ss.btn} onClick={() => onPrint(form, linkedRams)}>
            Preview / print
          </button>
          <button type="button" style={ss.btn} disabled={pdfBusy} onClick={handleDownloadPdf}>
            {pdfBusy ? "PDF…" : "Download PDF"}
          </button>
          {isUtilityMappingOrg() ? (
            <>
              <button
                type="button"
                style={ss.btn}
                onClick={async () => {
                  const org = getOrgSettings();
                  const shareUrl = form.ref ? buildOrgShareUrlWithRef(org, form.ref, undefined, form.documentControl?.revision) : "";
                  try {
                    const ok = await downloadUtilityMappingClientPackPdf(form, { org, shareUrl });
                    if (ok) {
                      pushToast({ type: "success", title: "Client pack PDF", message: "Executive pack downloaded as PDF." });
                    } else if (downloadUtilityMappingClientPack(form, { org, shareUrl })) {
                      pushToast({ type: "success", title: "Client pack", message: "HTML pack downloaded (PDF unavailable)." });
                    } else {
                      pushToast({ type: "warn", title: "Client pack", message: "Could not build client pack." });
                    }
                  } catch (e) {
                    if (downloadUtilityMappingClientPack(form, { org, shareUrl })) {
                      pushToast({ type: "warn", title: "Client pack HTML", message: e?.message || "PDF failed — HTML downloaded instead." });
                    } else {
                      pushToast({ type: "error", title: "Client pack failed", message: e?.message || "Could not build pack." });
                    }
                  }
                }}
              >
                Client pack PDF
              </button>
              <button
                type="button"
                style={ss.btn}
                onClick={() => {
                  const org = getOrgSettings();
                  if (downloadUtilityMappingA3BoardPack(form, { org })) {
                    pushToast({ type: "success", title: "A3 board pack", message: "Landscape board sheet downloaded." });
                  } else {
                    pushToast({ type: "warn", title: "A3 board pack", message: "Could not build A3 board pack." });
                  }
                }}
              >
                A3 board
              </button>
              <button
                type="button"
                style={ss.btn}
                onClick={() => {
                  const href = buildUtilityMappingClientMailto(form);
                  if (href) window.location.href = href;
                  else pushToast({ type: "warn", title: "Email", message: "Client email draft unavailable." });
                }}
              >
                Email client
              </button>
            </>
          ) : null}
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={ss.btnP}
            disabled={saving}
            className={savedFlash ? "app-survey-save-btn--flash" : undefined}
            onClick={() => handleSave()}
          >
            {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save report"}
          </button>
          {form.status !== "final" && (
            <button
              type="button"
              className={`app-survey-mark-final-btn${editorQuality.score >= 80 ? " app-survey-mark-final-btn--ready" : ""}`}
              style={{ ...ss.btn, borderColor: "#0d9488", color: "#0d9488" }}
              disabled={saving}
              onClick={() => {
                const gate = evaluateSurveyFinalGate(form);
                if (!gate.allowed) {
                  blockersPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                setConfirmDialog({
                  title: "Mark report as final?",
                  message: "Issue date and sign-off will be set. You can still edit later if needed.",
                  onConfirm: () => {
                    const finalized = finalizeReportRevision({ ...form, status: "final" });
                    handleSave(finalized, { skipSmartFillPrompt: true });
                    setConfirmDialog(null);
                  },
                });
              }}
            >
              Mark final
            </button>
          )}
        </div>
          </div>
          <SurveyLivePreviewDock
            open={livePreviewOpen}
            onToggle={setLivePreviewOpen}
            html={previewHtml}
            onPrint={() => onPrint(form, linkedRams)}
            height={520}
            qualityScore={editorQuality.score}
            exportReady={form.status === "final" ? exportGate.allowed : null}
            pending={previewPending}
          />
        </div>
        <ConfirmDialog
          open={Boolean(confirmDialog)}
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          confirmLabel={confirmDialog?.confirmLabel || "Confirm"}
          cancelLabel={confirmDialog?.cancelLabel || "Cancel"}
          onConfirm={confirmDialog?.onConfirm}
          onCancel={confirmDialog?.onCancel || (() => setConfirmDialog(null))}
        />
      </div>
    </ModuleOverlay>
  );
}

export default function SurveyReport() {
  const [simpleMode, setSimpleMode] = useState(() => getSurveySimpleModePref());
  const { caps } = useApp();
  const { pushToast } = useToast();
  const [reports, setReports] = useState(() => load(STORAGE_KEY, []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [ramsDocs] = useState(() => load("rams_builder_docs", []));
  const [projectPlans] = useState(() => listProjectPlans());
  const [geoPhotos, setGeoPhotos] = useState(() => load("geo_photos", []));
  const [gprReports] = useState(() => load("gpr_reports", []));
  const [permits] = useState(() => load("permits_v2", []));
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [listSort, setListSort] = useState("newest");
  const [listConfirm, setListConfirm] = useState(null);
  const [listBulkMode, setListBulkMode] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState(() => new Set());
  const [pdfBusyId, setPdfBusyId] = useState("");
  const listPg = useRegisterListPaging(30);

  useEffect(() => {
    listPg.reset();
  }, [filter, projectFilter, listSearch, listSort]);

  useEffect(() => {
    const t = consumeWorkspaceNavTarget();
    if (t?.viewId !== "survey-report") return;
    openSurveyReportFromNav(t, {
      projs: load("mysafeops_projects", []),
      existing: load(STORAGE_KEY, []),
      geo: load("geo_photos", []),
      rams: load("rams_builder_docs", []),
      setModal,
    });
  }, []);

  const { d1Hydrating: d1RepH, d1OutboxPending: d1RepO } = useD1OrgArraySync({
    storageKey: STORAGE_KEY,
    namespace: STORAGE_KEY,
    value: reports,
    setValue: setReports,
    load,
    save,
    serializeForSync: stripSurveyReportsForD1,
  });
  const { d1Hydrating: d1ProjH, d1OutboxPending: d1ProjO } = useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  const { d1Hydrating: d1GeoH, d1OutboxPending: d1GeoO } = useD1OrgArraySync({
    storageKey: "geo_photos",
    namespace: "geo_photos",
    value: geoPhotos,
    setValue: setGeoPhotos,
    load,
    save,
    serializeForSync: stripGeoPhotosForD1,
  });
  const d1Hydrating = d1RepH || d1ProjH || d1GeoH;
  const d1OutboxPending = d1RepO || d1ProjO || d1GeoO;

  const filtered = useMemo(() => {
    let rows = liveOrgArrayRows(reports);
    if (filter === "draft") rows = rows.filter((r) => r.status !== "final");
    if (filter === "final") rows = rows.filter((r) => r.status === "final");
    if (filter === "ready") {
      rows = rows.filter((r) => {
        if (r.status === "final") return false;
        return surveyReportQuality(r).score >= 80;
      });
    }
    if (projectFilter) rows = rows.filter((r) => r.projectId === projectFilter);
    rows = filterSurveyReportsSearch(rows, listSearch);
    return sortSurveyReports(rows, listSort);
  }, [reports, filter, projectFilter, listSearch, listSort]);

  const liveReports = useMemo(() => liveOrgArrayRows(reports), [reports]);
  const listSummary = useMemo(() => summarizeSurveyReportList(liveReports), [liveReports]);
  const filterCounts = useMemo(() => surveyListFilterCounts(liveReports), [liveReports]);

  const groupedReports = useMemo(
    () => groupSurveyReportsByProject(filtered, projects),
    [filtered, projects]
  );

  const enrichedRows = useMemo(() => enrichSurveyListRows(filtered, projects), [filtered, projects]);
  const listGroupMeta = useMemo(() => surveyListGroupMeta(groupedReports), [groupedReports]);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const ramsById = useMemo(() => Object.fromEntries(ramsDocs.map((d) => [d.id, d])), [ramsDocs]);

  const persist = (report, isNew) => {
    if (!ensureProjectLinked({ projectId: report.projectId, projects, moduleLabel: "survey report" })) return;
    setReports((prev) => {
      const i = prev.findIndex((x) => x.id === report.id);
      if (i >= 0) {
        const n = [...prev];
        n[i] = report;
        return n;
      }
      return [report, ...prev];
    });
    pushAudit({
      action: isNew ? "survey_report_create" : "survey_report_update",
      entity: "survey_report",
      detail: report.ref || report.id,
    });
    setModal(null);
  };

  const duplicateReport = useCallback((report, { asRevision = false } = {}) => {
    const copy = buildDuplicateReportPayload(report, reports, { asRevision });
    setReports((prev) => [copy, ...prev]);
    pushAudit({
      action: asRevision ? "survey_report_revision" : "survey_report_duplicate",
      entity: "survey_report",
      detail: copy.ref || copy.id,
    });
    setModal({ type: "edit", isNew: false, data: copy });
  }, [reports]);

  const downloadPdfForReport = useCallback(async (report) => {
    const rams = ramsById[report.linkedRamsId];
    const project = projectById[report.projectId];
    setPdfBusyId(report.id);
    pushToast({ type: "info", title: "Generating PDF…", message: "Building A4 pages — this can take a few seconds.", durationMs: 4000 });
    try {
      const { downloadSurveyReportPdf } = await import("./surveyReportPdf");
      const result = await downloadSurveyReportPdf(report, {
        ramsTitle: rams?.title || rams?.documentTitle,
        projectLat: project?.lat,
        projectLng: project?.lng,
      });
      pushAudit({ action: "survey_report_pdf", entity: "survey_report", detail: report.ref || report.id });
      pushToast({
        type: "success",
        title: "PDF downloaded",
        message: result?.fileName ? `${result.fileName}${result.pages ? ` · ${result.pages} page(s)` : ""}` : "Survey report PDF saved.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "PDF export failed", message: e?.message || "Could not generate PDF." });
    } finally {
      setPdfBusyId("");
    }
  }, [projectById, ramsById, pushToast]);

  const exportPackForReport = useCallback(async (report) => {
    const exportGate = evaluateSurveyExportGate(report);
    if (!exportGate.allowed) {
      pushToast({ type: "warn", title: "Export not ready", message: exportGate.message || "Export pack is not ready yet.", durationMs: 5000 });
      return;
    }
    const rams = ramsById[report.linkedRamsId];
    const project = projectById[report.projectId];
    setPdfBusyId(report.id);
    try {
      const { downloadSurveyReportPack } = await import("./surveyReportExport");
      await downloadSurveyReportPack(
        report,
        {
          ramsTitle: rams?.title || rams?.documentTitle,
          projectLat: project?.lat,
          projectLng: project?.lng,
        },
        geoPhotos
      );
      pushAudit({ action: "survey_report_pack", entity: "survey_report", detail: report.ref || report.id });
    } catch (e) {
      pushToast({ type: "error", title: "Export pack failed", message: e?.message || "Could not build export pack." });
    } finally {
      setPdfBusyId("");
    }
  }, [geoPhotos, projectById, ramsById]);

  const printReport = useCallback(async (report) => {
    const rams = ramsById[report.linkedRamsId];
    const project = projectById[report.projectId];
    const { openSurveyReportPrint } = await import("./surveyReportPrintHtml");
    openSurveyReportPrint(report, {
      ramsTitle: rams?.title || rams?.documentTitle,
      projectLat: project?.lat,
      projectLng: project?.lng,
    });
    pushAudit({ action: "survey_report_print", entity: "survey_report", detail: report.ref || report.id });
  }, [projectById, ramsById]);

  const exportHtmlForReport = useCallback(async (report) => {
    const rams = ramsById[report.linkedRamsId];
    const project = projectById[report.projectId];
    const { downloadSurveyReportHtml } = await import("./surveyReportPrintHtml");
    downloadSurveyReportHtml(report, {
      ramsTitle: rams?.title || rams?.documentTitle,
      projectLat: project?.lat,
      projectLng: project?.lng,
    });
    pushAudit({ action: "survey_report_html", entity: "survey_report", detail: report.ref || report.id });
  }, [projectById, ramsById]);

  const exportClientPackForReport = useCallback(
    async (report) => {
      if (!isUtilityMappingOrg()) return;
      const org = getOrgSettings();
      const shareUrl = report.ref
        ? buildOrgShareUrlWithRef(org, report.ref, undefined, report.documentControl?.revision)
        : "";
      try {
        const ok = await downloadUtilityMappingClientPackPdf(report, { org, shareUrl });
        if (ok) {
          pushToast({ type: "success", title: "Client pack PDF", message: "Executive pack downloaded as PDF." });
          pushAudit({ action: "survey_client_pack_pdf", entity: "survey_report", detail: report.ref || report.id });
          return;
        }
      } catch {
        /* fall through to HTML */
      }
      if (downloadUtilityMappingClientPack(report, { org, shareUrl })) {
        pushToast({ type: "success", title: "Client pack", message: "HTML pack downloaded." });
        pushAudit({ action: "survey_client_pack", entity: "survey_report", detail: report.ref || report.id });
      } else {
        pushToast({ type: "warn", title: "Client pack", message: "Could not build client pack." });
      }
    },
    [pushToast]
  );

  const exportA3BoardForReport = useCallback(
    (report) => {
      if (!isUtilityMappingOrg()) return;
      const org = getOrgSettings();
      if (downloadUtilityMappingA3BoardPack(report, { org })) {
        pushToast({ type: "success", title: "A3 board pack", message: "Landscape board sheet downloaded." });
        pushAudit({ action: "survey_a3_board", entity: "survey_report", detail: report.ref || report.id });
      } else {
        pushToast({ type: "warn", title: "A3 board pack", message: "Could not build A3 board pack." });
      }
    },
    [pushToast]
  );

  const missingProjectCount = useMemo(
    () => projectsMissingReports(projects, reports).length,
    [projects, reports]
  );

  const batchExportFinalPacks = useCallback(async () => {
    const finals = liveOrgArrayRows(reports).filter((r) => r.status === "final");
    const eligible = finals.filter((r) => evaluateSurveyExportGate(r).allowed);
    if (!eligible.length) {
      pushToast({
        type: "warn",
        title: "Nothing to export",
        message: "No final reports meet export pack requirements (PAS128 QL, utilities, QA, photos).",
        durationMs: 5000,
      });
      return;
    }
    if (
      eligible.length > 3 &&
      !window.confirm(`Export PDF pack for ${eligible.length} final reports? This may take a minute.`)
    ) {
      return;
    }
    for (const report of eligible.slice(0, 20)) {
      await exportPackForReport(report);
    }
  }, [reports, exportPackForReport]);

  const toggleReportSelect = useCallback((id) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const batchAppendToRams = useCallback(() => {
    const { results } = batchAppendFinalSurveysToRams(reports, ramsDocs);
    const ok = results.filter((r) => r.ok).length;
    const skipped = results.filter((r) => !r.ok).length;
    if (!ok) {
      pushToast({ type: "warn", title: "Nothing appended", message: "No final reports could be appended — each needs a RAMS on its project." });
      return;
    }
    pushToast({
      type: "success",
      title: "Appended to RAMS",
      message: `Appended ${ok} survey summary(ies) to RAMS.${skipped ? ` ${skipped} skipped (no RAMS).` : ""}`,
    });
  }, [reports, ramsDocs, pushToast]);

  const batchAssignSelectedToProject = useCallback(() => {
    const ids = [...selectedReportIds];
    if (!ids.length) {
      pushToast({ type: "warn", title: "Nothing selected", message: "Select reports first (turn on bulk select)." });
      return;
    }
    const targetId = projectFilter || window.prompt("Project ID to assign selected reports to:");
    if (!targetId) return;
    if (!projects.some((p) => p.id === targetId)) {
      pushToast({ type: "error", title: "Project not found", message: "Check the project ID and try again." });
      return;
    }
    setReports((prev) => batchAssignSurveysToProject(ids, targetId, prev));
    setSelectedReportIds(new Set());
    setListBulkMode(false);
    pushToast({ type: "success", title: "Assigned", message: `${ids.length} report(s) linked to project.` });
  }, [selectedReportIds, projectFilter, projects, pushToast]);

  const batchCreateForProjects = () => {
    if (!missingProjectCount) return;
    setListConfirm({
      title: "Create draft reports?",
      message: `Create draft survey reports for ${missingProjectCount} project(s) that have no report yet?`,
      confirmLabel: "Create drafts",
      tone: "default",
      onConfirm: () => {
        const { created, reports: next } = batchCreateDraftReports(projects, reports, ramsDocs);
        setReports(next);
        pushAudit({
          action: "survey_report_batch_create",
          entity: "survey_report",
          detail: `${created.length} drafts`,
        });
        if (created.length === 1) {
          setModal({ type: "edit", isNew: true, data: created[0] });
        }
        setListConfirm(null);
      },
    });
  };

  const openEditor = useCallback((report, isNew = false) => {
    setModal({ type: "edit", data: report, isNew });
  }, []);

  const handleListDelete = useCallback((r) => {
    setListConfirm({
      title: "Delete survey report?",
      message: `${r.ref || r.title || "This report"} moves to Recycle Bin for ${7} days.`,
      tone: "danger",
      confirmLabel: "Delete",
      onConfirm: () => {
        pushRecycleBinItem({
          moduleId: "survey-report",
          moduleLabel: "Survey reports",
          itemType: "survey_report",
          itemLabel: r.ref || r.title || r.id,
          sourceKey: STORAGE_KEY,
          payload: r,
        });
        setReports((p) => replaceWithTombstone(p, r.id));
        pushAudit({ action: "survey_report_delete", entity: "survey_report", detail: r.id });
        setListConfirm(null);
      },
    });
  }, []);

  const handleProjectHub = useCallback((r) => {
    setWorkspaceNavTarget({
      viewId: "projects",
      projectId: r.projectId,
      action: "viewProjectDashboard",
    });
    openWorkspaceView({ viewId: "projects" });
  }, []);

  const handleGeoJsonExport = useCallback(async (r) => {
    try {
      const { downloadSurveyReportGeoJson } = await import("./surveyReportExport");
      downloadSurveyReportGeoJson(r, geoPhotos);
    } catch (e) {
      pushToast({ type: "error", title: "GeoJSON export failed", message: e?.message || "Could not export GeoJSON." });
    }
  }, [geoPhotos, pushToast]);

  const handleKmlExport = useCallback(async (r) => {
    try {
      const { downloadSurveyReportKml } = await import("./surveyReportExport");
      downloadSurveyReportKml(r, geoPhotos);
    } catch (e) {
      pushToast({ type: "error", title: "KML export failed", message: e?.message || "Could not export KML." });
    }
  }, [geoPhotos, pushToast]);

  const handleKmzExport = useCallback(async (r) => {
    try {
      const { downloadSurveyReportKmz } = await import("./surveyReportExport");
      await downloadSurveyReportKmz(r, geoPhotos);
    } catch (e) {
      pushToast({ type: "error", title: "KMZ export failed", message: e?.message || "Could not export KMZ." });
    }
  }, [geoPhotos, pushToast]);

  const handleGpxExport = useCallback(async (r) => {
    try {
      const { downloadSurveyReportGpx } = await import("./surveyReportExport");
      downloadSurveyReportGpx(r, geoPhotos);
    } catch (e) {
      pushToast({ type: "error", title: "GPX export failed", message: e?.message || "Could not export GPX." });
    }
  }, [geoPhotos, pushToast]);

  const handleCadPackExport = useCallback(async (r) => {
    try {
      const { downloadSurveyReportCadPack } = await import("./surveyReportExport");
      await downloadSurveyReportCadPack(r, geoPhotos);
    } catch (e) {
      pushToast({ type: "error", title: "CAD pack failed", message: e?.message || "Could not export CAD pack." });
    }
  }, [geoPhotos, pushToast]);

  const handleRevision = useCallback((r) => {
    duplicateReport(r, { asRevision: true });
  }, [duplicateReport]);

  const createNew = () => {
    const ref = nextSurveyRef(reports);
    const umFields = umFieldsFromRef(ref);
    const pid = defaultProjectIdForCreate(projects);
    const p = projects.find((x) => x.id === pid);
    const base = blankSurveyReport({
      ref,
      ...umFields,
      title: p ? `Survey report — ${p.name || ref}` : `Survey report ${ref}`,
      projectId: pid || "",
    });
    setModal({
      type: "edit",
      data: pid ? prefillReportFromProject(base, p, pickRamsForProject(ramsDocs, pid)) : base,
      isNew: true,
    });
  };

  const toggleSimpleMode = () => {
    const next = !simpleMode;
    setSurveySimpleModePref(next);
    setSimpleMode(next);
  };

  return (
    <div className="app-document-module app-document-module--premium" style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="survey reports" />

      {modal?.type === "edit" && (
        <ReportEditor
          report={modal.data}
          isNew={modal.isNew}
          projects={projects}
          ramsDocs={ramsDocs.filter((d) => d.surveyWorkType || d.surveyMethodStatement)}
          projectPlans={projectPlans}
          geoPhotos={geoPhotos}
          gprReports={gprReports}
          permits={permits}
          reports={reports}
          onSave={(r) => persist(r, modal.isNew)}
          onClose={() => setModal(null)}
          onOpenReport={(id) => {
            const existing = reports.find((x) => x.id === id);
            if (existing) setModal({ type: "edit", data: existing, isNew: false });
          }}
          onPrint={(r) => printReport(r)}
        />
      )}

      <div className="app-survey-list-shell">
      <PageHero
        badgeText="SR"
        title="Survey report"
        lead={
          <span>
            Site survey reports you can issue as a branded A4 PDF — pick a project, use Smart fill, then preview.
            {simpleMode ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#ccfbf1",
                    color: "#115e59",
                    border: "1px solid #99f6e4",
                  }}
                >
                  Simple mode on
                </span>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Guided steps first — PAS 128 / advanced tools stay under More.
                </span>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 6 }}>
                Full editor — you can turn on Simple mode in Survey templates / org settings.
              </span>
            )}
          </span>
        }
        suppressRegisterPdf
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              style={{
                ...ss.btn,
                fontSize: 12,
                fontWeight: 600,
                borderColor: simpleMode ? "#0d9488" : undefined,
                background: simpleMode ? "#ccfbf1" : undefined,
                color: simpleMode ? "#115e59" : undefined,
              }}
              onClick={toggleSimpleMode}
              title="Simple mode shows guided steps; Full editor shows every tab"
            >
              {simpleMode ? "Simple mode" : "Full editor"}
            </button>
            <button type="button" style={ss.btnP} onClick={createNew}>
              + New report
            </button>
          </div>
        }
      />

      {reports.length > 0 ? <SurveyListStatsBar summary={listSummary} /> : null}

      <div className="app-survey-list-toolbar">
        <input
          type="search"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder="Search title, ref, surveyor, project…"
          style={{ ...ss.inp, flex: "1 1 200px", minWidth: 180, fontSize: 13 }}
          aria-label="Search survey reports"
        />
        <select
          value={listSort}
          onChange={(e) => setListSort(e.target.value)}
          style={{ ...ss.inp, fontSize: 12, minWidth: 140 }}
          aria-label="Sort survey reports"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="complete">Most complete</option>
          <option value="incomplete">Least complete</option>
          <option value="project">By project</option>
        </select>
      </div>

      <div className="app-survey-list-filters">
        {[
          ["all", "All"],
          ["draft", "Drafts"],
          ["ready", "Ready to finalise"],
          ["final", "Final"],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            className={`app-survey-list-filter-pill${filter === k ? " app-survey-list-filter-pill--active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {l}
            <span className="app-survey-list-filter-pill__count">{filterCounts[k] ?? 0}</span>
          </button>
        ))}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="app-survey-list-filters__project"
          style={{ ...ss.inp, fontSize: 12, minWidth: 160 }}
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "Untitled"}
            </option>
          ))}
        </select>
        {listSummary.needsWork > 0 && (
          <button
            type="button"
            style={{ ...ss.btn, fontSize: 12, borderColor: "#fcd34d", background: "#fffbeb" }}
            onClick={() => {
              setFilter("draft");
              setListSort("incomplete");
            }}
          >
            Needs work ({listSummary.needsWork})
          </button>
        )}
        {liveReports.filter((r) => r.status === "final").length > 0 ? (
          <>
          <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => void batchExportFinalPacks()}>
            Bulk export finals (PDF pack)
          </button>
          <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={batchAppendToRams}>
            Append finals to RAMS
          </button>
          </>
        ) : null}
        <button
          type="button"
          style={{ ...ss.btn, fontSize: 12, ...(listBulkMode ? { background: "#ccfbf1", color: "#115e59" } : {}) }}
          onClick={() => {
            setListBulkMode((v) => !v);
            setSelectedReportIds(new Set());
          }}
        >
          {listBulkMode ? "Cancel bulk" : "Bulk select"}
        </button>
        {listBulkMode && selectedReportIds.size > 0 ? (
          <button type="button" style={{ ...ss.btn, fontSize: 12, borderColor: "#0d9488", color: "#0f766e" }} onClick={batchAssignSelectedToProject}>
            Assign {selectedReportIds.size} to project
          </button>
        ) : null}
        {missingProjectCount > 0 && (
          <button type="button" style={{ ...ss.btn, fontSize: 12, marginLeft: "auto" }} onClick={batchCreateForProjects}>
            Batch: {missingProjectCount} project{missingProjectCount === 1 ? "" : "s"} without report
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📐"
          title={reports.length === 0 ? "No survey reports yet" : "No reports match this filter"}
          description={
            reports.length === 0
              ? "Three steps: 1) New report + pick a project  2) Smart fill (weather, records, findings)  3) Preview PDF — then mark final when ready."
              : "Try another filter or create a new report."
          }
          actionLabel={reports.length === 0 ? "Start first report" : "Create report"}
          onAction={createNew}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(() => {
            let rowIndex = 0;
            let lastGroup = null;
            return listPg.visible(enrichedRows).map((row) => {
              const r = row.report;
              const groupKey = r.projectId || "__none__";
              const meta = listGroupMeta.get(groupKey);
              const showGroupHeader = !projectFilter && groupKey !== lastGroup;
              lastGroup = groupKey;
              const hasGeo = r.projectId && countGeoPhotosForReport(geoPhotos, r.projectId) > 0;
              const staggerIndex = rowIndex++;
              return (
                <SurveyListRow
                  key={r.id}
                  staggerIndex={staggerIndex}
                  enriched={row}
                  showGroupHeader={showGroupHeader}
                  groupLabel={meta?.label || "No project"}
                  groupCount={meta?.count || 0}
                  caps={caps}
                  pdfBusy={pdfBusyId === r.id}
                  bulkMode={listBulkMode}
                  selected={selectedReportIds.has(r.id)}
                  onToggleSelect={toggleReportSelect}
                  onEdit={(rep) => openEditor(rep, false)}
                  onPdf={downloadPdfForReport}
                  onPrint={printReport}
                  onPack={exportPackForReport}
                  onDuplicate={duplicateReport}
                  onHtmlExport={exportHtmlForReport}
                  onClientPack={isUtilityMappingOrg() ? exportClientPackForReport : null}
                  onA3Board={isUtilityMappingOrg() ? exportA3BoardForReport : null}
                  onGeoJsonExport={hasGeo ? handleGeoJsonExport : null}
                  onKmlExport={hasGeo ? handleKmlExport : null}
                  onKmzExport={hasGeo ? handleKmzExport : null}
                  onGpxExport={hasGeo ? handleGpxExport : null}
                  onCadPackExport={hasGeo ? handleCadPackExport : null}
                  onRevision={handleRevision}
                  onProjectHub={r.projectId ? handleProjectHub : null}
                  onDelete={handleListDelete}
                />
              );
            });
          })()}
          <RegisterListPagingFooter
            hasMore={listPg.hasMore(filtered)}
            remaining={listPg.remaining(filtered)}
            showing={Math.min(listPg.cap, filtered.length)}
            total={filtered.length}
            onShowMore={listPg.showMore}
            itemLabel="reports"
            buttonStyle={ss.btn}
          />
        </div>
      )}
      <ConfirmDialog
        open={Boolean(listConfirm)}
        title={listConfirm?.title}
        message={listConfirm?.message}
        tone={listConfirm?.tone || "danger"}
        confirmLabel={listConfirm?.confirmLabel || (listConfirm?.tone === "danger" ? "Delete" : "Confirm")}
        onConfirm={listConfirm?.onConfirm}
        onCancel={() => setListConfirm(null)}
      />
      </div>
    </div>
  );
}
