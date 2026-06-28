import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { isAnthropicConfigured } from "../../utils/anthropicClient";
import { useD1OrgArraySync } from "../../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../../utils/useRegisterListPaging";
import { useApp } from "../../context/AppContext";
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
  RAIN_DURING_SURVEY,
  SURVEY_TYPES,
  UTILITY_RECORDS_GAPS,
  UTILITY_RECORDS_OUTCOMES,
  UTILITY_RECORDS_PRESETS,
  UTILITY_RECORDS_SOURCES,
  WEATHER_PHENOMENA,
  QA_CHECKLIST_ITEMS,
  UTILITY_TYPE_OPTIONS,
  UTILITY_CONFIDENCE_LEVELS,
  DELIVERABLE_FORMAT_OPTIONS,
  RECORD_REF_STATUS_OPTIONS,
  EQUIPMENT_CALIBRATION_STATUS,
} from "./surveyReportConstants";
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
  generateAiSurveyDraft,
  mergeSitePlanIntoReport,
  pickRamsForProject,
  prefillReportFromProject,
  projectsMissingReports,
  pullScopeFromRams,
  runSmartFillAll,
  smartFillNextSteps,
  suggestLimitationKeys,
} from "./surveyReportSmart";
import { listProjectPlans, plansForProject } from "../permits/permitPlanOverlayRegistry";
import { consumeWorkspaceNavTarget, openWorkspaceView, setWorkspaceNavTarget } from "../../utils/workspaceNavContext";
import { countGeoPhotosForReport, importGeoPhotosIntoReport as mergeGeoPhotos, geoPhotosToUtilitiesTable } from "../../utils/geoPhotoIntegrations";
import { readCadFile, mergeCadAnalysisIntoReport, applyCadLayerMappings } from "../../utils/surveyDxfAnalyzer";
import CadImportPanel from "./CadImportPanel";
import EmptyState from "../../components/EmptyState";
import PrintPreviewFrame from "../../components/PrintPreviewFrame";
import ModuleOverlay from "../../components/ModuleOverlay";
import ConfirmDialog from "../../components/ConfirmDialog";
import SurveyEditorStepNav from "./SurveyEditorStepNav";
import SurveyEditorHero from "./SurveyEditorHero";
import SurveyListStatsBar from "./SurveyListStatsBar";
import SurveyRevisionTimeline from "./SurveyRevisionTimeline";
import SurveyLivePreviewDock from "./SurveyLivePreviewDock";
import SurveyListRow from "./SurveyListRow";
import { useSurveyPreviewHtml } from "./useSurveyPreviewHtml";
import { enrichSurveyListRows, surveyListGroupMeta } from "./surveyReportListRows";
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
} from "../../utils/documentPropagation";

const STORAGE_KEY = "survey_reports";
const SURVEY_DRAFT_KEY = "mysafeops_survey_report_editor_draft";
const SURVEY_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ss = {
  ...ms,
  ta: {
    width: "100%",
    padding: "8px 10px",
    border: "0.5px solid var(--color-border-secondary,#ccc)",
    borderRadius: 6,
    fontSize: 13,
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
    background: active ? "#E6F1FB" : "transparent",
    color: active ? "#0C447C" : "var(--color-text-secondary)",
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

function SmartAssistPanel({ form, projects, ramsDocs, projectPlans, geoPhotos = [], permits = [], onApply, linkedRams, onGoToTab }) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [useAiOnFill, setUseAiOnFill] = useState(false);

  const project = projects.find((p) => p.id === form.projectId);
  const hasCoords = Boolean(project?.lat && project?.lng);
  const hasAi = isAnthropicConfigured();
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
        borderColor: busy === label ? "#0C447C" : undefined,
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
        border: "0.5px solid #c7d9ec",
        background: "linear-gradient(180deg, #f0f7ff 0%, #fafcff 100%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: open ? 10 : 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0C447C" }}>Smart assist</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            One-click fill, site plan import, weather, templates and optional AI polish.
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
              "Smart fill all",
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
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {assistBtn("Prefill project + RAMS", !project, async () => {
              const rams = pickRamsForProject(ramsDocs, form.projectId) || linkedRams;
              return prefillReportFromProject(form, project, rams);
            })}
            {assistBtn("Fetch weather", !project || !form.surveyDate || !hasCoords, async () =>
              fetchWeatherIntoReport(form, project)
            )}
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
          {nextSteps.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11 }}>
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
                  onClick={() => onGoToTab?.(step.tab)}
                >
                  {step.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8 }}>
            {!project && "Select a project to enable prefill and weather fetch. "}
            {project && !hasCoords && "Project has no map coordinates — set location on the project for weather. "}
            {project && !plansWithMarkup.length && "No marked site plans on this project yet (Workers → site plan). "}
            {!hasAi && "AI polish needs Anthropic key or proxy in settings. "}
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
  permits = [],
  reports = [],
  isNew,
  onSave,
  onClose,
  onPrint,
  onOpenReport,
}) {
  const [form, setForm] = useState(() => normalizeSurveyReport({ ...report }));
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cadBusy, setCadBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
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
          setForm(normalizeSurveyReport(draft.form));
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
        const payload = JSON.stringify({ form, savedAt: Date.now(), reportId: form.id });
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
    setForm((f) => ({
      ...f,
      projectId,
      projectName: p?.name || "",
      client: p?.client || f.client,
      siteAddress: p?.address || f.siteAddress,
      updatedAt: new Date().toISOString(),
    }));
  };

  const syncScopeFromRams = () => {
    const rams = linkedRams || pickRamsForProject(ramsDocs, form.projectId);
    if (!rams) {
      window.alert("Link a RAMS document first, or create one from the project hub.");
      return;
    }
    try {
      const next = pullScopeFromRams(form, rams);
      setForm({ ...next, updatedAt: new Date().toISOString() });
    } catch (e) {
      window.alert(e?.message || "Could not pull scope from RAMS.");
    }
  };

  const appendSummaryToRams = () => {
    if (form.status !== "final") {
      window.alert("Mark the report final before appending findings to RAMS handover notes.");
      return;
    }
    const allRams = load("rams_builder_docs", []);
    try {
      persistSurveyAppendixToRams(form, allRams);
      window.alert("Survey summary appended to RAMS handover notes — open RAMS to review the client handover appendix.");
    } catch (e) {
      window.alert(e?.message || "Could not append to RAMS.");
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
        photos: [...(f.photos || []), { id: `ph_${Date.now()}`, dataUrl: reader.result, caption: "" }],
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
      alert(err?.message || "CAD import failed.");
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
    setForm((f) => ({
      ...f,
      cadImport: nextCad,
      sections: { ...f.sections, findings },
      updatedAt: new Date().toISOString(),
    }));
  };

  const linkedRams = ramsDocs.find((d) => d.id === form.linkedRamsId);
  const pas128Stats = useMemo(() => buildPas128SummaryStats(form), [form]);
  const prevTab = adjacentSurveyTab(tab, "prev");
  const nextTabNav = adjacentSurveyTab(tab, "next");

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
      await downloadSurveyReportPdf(form, printExtras);
      pushAudit({ action: "survey_report_pdf", entity: "survey_report", detail: form.ref || form.id });
    } catch (e) {
      alert(e?.message || "PDF export failed.");
    } finally {
      setPdfBusy(false);
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
          window.alert(finalGate.message || "Cannot mark final — complete required items first.");
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
      if (wasDraft && payload.status === "final") burstSurveyCelebration();
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
        const n = adjacentSurveyTab(tab, "next");
        if (n) setTab(n);
      }
      if (!typing && e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        const p = adjacentSurveyTab(tab, "prev");
        if (p) setTab(p);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab]);

  return (
    <ModuleOverlay>
      <div
        className={`app-module-overlay__panel app-survey-report-editor${livePreviewOpen ? " app-survey-report-editor--split" : ""}`}
        style={{ ...ss.card, maxWidth: livePreviewOpen ? 1280 : 920 }}
      >
        <SurveyEditorHero
          form={form}
          project={formProject}
          onClose={onClose}
          onGoToTab={setTab}
          livePreviewOpen={livePreviewOpen}
          onToggleLivePreview={setLivePreviewOpen}
        />

        <SurveyRevisionTimeline report={form} allReports={reports} onOpenReport={onOpenReport} />

        <SmartAssistPanel
          form={form}
          projects={projects}
          ramsDocs={ramsDocs}
          projectPlans={projectPlansForForm}
          geoPhotos={geoPhotos}
          permits={permits}
          linkedRams={linkedRams}
          onGoToTab={setTab}
          onApply={(next) => setForm({ ...next, updatedAt: new Date().toISOString() })}
        />

        <SurveyEditorStepNav tab={tab} report={form} onTabChange={setTab} />

        <div className={`app-survey-editor-layout${livePreviewOpen ? " app-survey-editor-layout--split" : ""}`}>
          <div className="app-survey-editor-layout__main">
        <div key={tab} className="app-survey-tab-panel">
        {tab === "details" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl}>Report title *</label>
                <input
                  style={ss.inp}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. PAS128 QLB utility mapping — Phase 1"
                />
              </div>
              <div>
                <label style={ss.lbl}>Report ref</label>
                <input style={ss.inp} value={form.ref} onChange={(e) => set("ref", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Survey date *</label>
                <input type="date" style={ss.inp} value={form.surveyDate} onChange={(e) => set("surveyDate", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Surveyor / author *</label>
                <input style={ss.inp} value={form.surveyor} onChange={(e) => set("surveyor", e.target.value)} placeholder="Name and role" />
              </div>
              <div>
                <label style={ss.lbl}>Project</label>
                <select style={ss.inp} value={form.projectId} onChange={(e) => onProjectChange(e.target.value)}>
                  <option value="">— Select —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ss.lbl}>Client</label>
                <input style={ss.inp} value={form.client} onChange={(e) => set("client", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl}>Site address</label>
                <input style={ss.inp} value={form.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
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
              <div>
                <label style={ss.lbl}>Survey type *</label>
                <select style={ss.inp} value={form.surveyType} onChange={(e) => set("surveyType", e.target.value)}>
                  <option value="">— Select —</option>
                  {SURVEY_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ss.lbl}>PAS128 quality level</label>
                <select style={ss.inp} value={form.pas128Ql} onChange={(e) => set("pas128Ql", e.target.value)}>
                  <option value="">— Optional —</option>
                  {PAS128_QUALITY_LEVELS.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {ramsDocs.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <label style={ss.lbl}>Link RAMS (prefill scope & method)</label>
                <select style={ss.inp} value={form.linkedRamsId} onChange={(e) => onRamsLink(e.target.value)}>
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
                    <button type="button" style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32 }} onClick={syncScopeFromRams}>
                      Sync from RAMS
                    </button>
                    {form.status === "final" ? (
                      <button type="button" style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32, borderColor: "#0d9488", color: "#0f766e" }} onClick={appendSummaryToRams}>
                        Append to RAMS
                      </button>
                    ) : null}
                  </div>
                )}
                {!linkedRams && form.projectId && ramsDocs.some((d) => d.projectId === form.projectId) ? (
                  <button
                    type="button"
                    style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32, marginTop: 6 }}
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
              <label style={ss.lbl}>Executive summary</label>
              <textarea
                style={{ ...ss.ta, minHeight: 72 }}
                value={form.sections.executiveSummary}
                onChange={(e) => setSection("executiveSummary", e.target.value)}
                placeholder="Brief overview for the client — what was done and key outcomes."
              />
            </div>
            <div style={ss.sectionHead}>Document control</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10 }}>
              <div>
                <label style={ss.lbl}>Issue no.</label>
                <input style={ss.inp} value={form.documentControl.issueNumber} onChange={(e) => setDocControl("issueNumber", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Revision</label>
                <input style={ss.inp} value={form.documentControl.revision} onChange={(e) => setDocControl("revision", e.target.value)} placeholder="A" />
              </div>
              <div>
                <label style={ss.lbl}>Issue date</label>
                <input type="date" style={ss.inp} value={form.documentControl.issueDate} onChange={(e) => setDocControl("issueDate", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Prepared by</label>
                <input style={ss.inp} value={form.documentControl.preparedBy} onChange={(e) => setDocControl("preparedBy", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Checked by</label>
                <input style={ss.inp} value={form.documentControl.checkedBy} onChange={(e) => setDocControl("checkedBy", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Approved by</label>
                <input style={ss.inp} value={form.documentControl.approvedBy} onChange={(e) => setDocControl("approvedBy", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {tab === "scope" && (
          <>
            <label style={ss.lbl}>Scope of works *</label>
            <textarea
              style={{ ...ss.ta, minHeight: 90 }}
              value={form.sections.scope}
              onChange={(e) => setSection("scope", e.target.value)}
              placeholder="Describe the agreed survey scope, deliverables and any exclusions."
            />
            <div style={ss.sectionHead}>Methodology *</div>
            <textarea
              style={{ ...ss.ta, minHeight: 100 }}
              value={form.sections.methodology}
              onChange={(e) => setSection("methodology", e.target.value)}
              placeholder="Step-by-step method: control setup, detection techniques, QA checks, handover."
            />
            <div style={ss.sectionHead}>Equipment used</div>
            <textarea
              style={{ ...ss.ta, minHeight: 60 }}
              value={form.sections.equipmentUsed}
              onChange={(e) => setSection("equipmentUsed", e.target.value)}
              placeholder="e.g. RD8000 locator, IDS Stream C GPR, Leica GS18 rover…"
            />
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
                <label style={ss.lbl}>Coordinate system</label>
                <input style={ss.inp} value={form.controlAccuracy.coordinateSystem} onChange={(e) => setControl("coordinateSystem", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Control source</label>
                <input style={ss.inp} value={form.controlAccuracy.controlSource} onChange={(e) => setControl("controlSource", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Horizontal tolerance</label>
                <input style={ss.inp} value={form.controlAccuracy.horizontalTolerance} onChange={(e) => setControl("horizontalTolerance", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Vertical tolerance</label>
                <input style={ss.inp} value={form.controlAccuracy.verticalTolerance} onChange={(e) => setControl("verticalTolerance", e.target.value)} />
              </div>
            </div>
            <label style={ss.lbl}>Control points / notes</label>
            <textarea
              style={{ ...ss.ta, minHeight: 56 }}
              value={form.controlAccuracy.controlPointsNotes}
              onChange={(e) => setControl("controlPointsNotes", e.target.value)}
              placeholder="Control point IDs, residuals, independent checks…"
            />
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
          </>
        )}

        {tab === "professional" && (
          <>
            <div style={ss.sectionHead}>Survey programme</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={ss.lbl}>Start time</label>
                <input type="time" style={ss.inp} value={form.surveyProgramme.startTime} onChange={(e) => setProgramme("startTime", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>End time</label>
                <input type="time" style={ss.inp} value={form.surveyProgramme.endTime} onChange={(e) => setProgramme("endTime", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Hours on site</label>
                <input style={ss.inp} value={form.surveyProgramme.hoursOnSite} onChange={(e) => setProgramme("hoursOnSite", e.target.value)} placeholder="e.g. 6.5" />
              </div>
            </div>
            <label style={ss.lbl}>Personnel on site</label>
            <input
              style={{ ...ss.inp, marginBottom: 10 }}
              value={form.surveyProgramme.personnel}
              onChange={(e) => setProgramme("personnel", e.target.value)}
              placeholder="Surveyor, assistant, client rep…"
            />
            <label style={ss.lbl}>Site access notes</label>
            <textarea
              style={{ ...ss.ta, minHeight: 48, marginBottom: 14 }}
              value={form.surveyProgramme.siteAccessNotes}
              onChange={(e) => setProgramme("siteAccessNotes", e.target.value)}
            />
            <div style={ss.sectionHead}>QA & verification</div>
            <CheckboxGrid
              options={QA_CHECKLIST_ITEMS}
              selected={Object.entries(form.qaChecklist || {})
                .filter(([, v]) => v)
                .map(([k]) => k)}
              onToggle={(key) => setQa(key, !form.qaChecklist?.[key])}
            />
            <div style={ss.sectionHead}>Health & safety cross-reference</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={ss.lbl}>Permit reference</label>
                <input style={ss.inp} value={form.hseRefs.permitRef} onChange={(e) => setHse("permitRef", e.target.value)} placeholder="Auto-filled from permits if linked" />
              </div>
              <div>
                <label style={ss.lbl}>CAT scan reference</label>
                <input style={ss.inp} value={form.hseRefs.catScanRef} onChange={(e) => setHse("catScanRef", e.target.value)} />
              </div>
            </div>
            <label style={ss.lbl}>RAMS excerpt (optional)</label>
            <textarea
              style={{ ...ss.ta, minHeight: 56, marginBottom: 14 }}
              value={form.hseRefs.ramsExcerpt}
              onChange={(e) => setHse("ramsExcerpt", e.target.value)}
              placeholder="Short method statement excerpt for the PDF."
            />
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
                <label style={ss.lbl}>Surveyor name</label>
                <input style={ss.inp} value={form.signatures.surveyorName} onChange={(e) => setSig("surveyorName", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Surveyor sign date</label>
                <input type="date" style={ss.inp} value={form.signatures.surveyorSignedDate} onChange={(e) => setSig("surveyorSignedDate", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Client name (optional)</label>
                <input style={ss.inp} value={form.signatures.clientName} onChange={(e) => setSig("clientName", e.target.value)} />
              </div>
              <div>
                <label style={ss.lbl}>Client acceptance date</label>
                <input type="date" style={ss.inp} value={form.signatures.clientAcceptedDate} onChange={(e) => setSig("clientAcceptedDate", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {tab === "weather" && (
          <>
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
                <label style={ss.lbl}>Ground surface</label>
                <select style={ss.inp} value={form.weather.groundSurface} onChange={(e) => setWeather("groundSurface", e.target.value)}>
                  {GROUND_SURFACE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ss.lbl}>Rain during survey</label>
                <select style={ss.inp} value={form.weather.rainDuringSurvey} onChange={(e) => setWeather("rainDuringSurvey", e.target.value)}>
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
              <label style={ss.lbl}>Conditions narrative</label>
              <textarea
                style={{ ...ss.ta, minHeight: 56 }}
                value={form.weather.conditionsNarrative}
                onChange={(e) => setWeather("conditionsNarrative", e.target.value)}
                placeholder="Describe weather at site and any impact on survey programme."
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl}>Equipment / method impact</label>
              <textarea
                style={{ ...ss.ta, minHeight: 56 }}
                value={form.weather.equipmentMethodImpact}
                onChange={(e) => setWeather("equipmentMethodImpact", e.target.value)}
                placeholder="e.g. GPR attenuation on wet clay; GNSS held under tree cover."
              />
            </div>
          </>
        )}

        {tab === "records" && (
          <>
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
              <label style={ss.lbl}>What was found in records</label>
              <textarea style={{ ...ss.ta, minHeight: 56 }} value={form.utilityRecords.whatWasFound} onChange={(e) => setRecords("whatWasFound", e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl}>What was not found / not available</label>
              <textarea style={{ ...ss.ta, minHeight: 56 }} value={form.utilityRecords.whatWasNotFound} onChange={(e) => setRecords("whatWasNotFound", e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={ss.lbl}>Gap explanation</label>
              <textarea style={{ ...ss.ta, minHeight: 48 }} value={form.utilityRecords.gapExplanation} onChange={(e) => setRecords("gapExplanation", e.target.value)} />
            </div>
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
          </>
        )}

        {tab === "limitations" && (
          <>
            <div style={ss.sectionHead}>Standard limitation clauses</div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>
              Tick applicable items — text is assembled into the Limitations section of the printed report.
            </p>
            <CheckboxGrid options={LIMITATION_RULES} selected={form.limitationKeys} onToggle={toggleLimitation} />
            <div style={{ marginTop: 14 }}>
              <label style={ss.lbl}>Limitations text (editable)</label>
              <textarea
                style={{ ...ss.ta, minHeight: 90 }}
                value={form.limitationsText || buildLimitationsFromKeys(form.limitationKeys)}
                onChange={(e) => set("limitationsText", e.target.value)}
              />
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
              <label style={ss.lbl}>Access notes</label>
              <textarea
                style={{ ...ss.ta, minHeight: 48 }}
                value={form.accessLimitationsNotes}
                onChange={(e) => set("accessLimitationsNotes", e.target.value)}
              />
            </div>
          </>
        )}

        {tab === "findings" && (
          <>
            {pas128Stats ? (
              <div className="app-survey-pas128-summary">
                <strong>Utility schedule summary</strong>
                <span>{pas128Stats.total} utilities</span>
                <span>{pas128Stats.withDepth} with depth</span>
                <span>{pas128Stats.withGeoPhoto} geo-linked</span>
                {Object.entries(pas128Stats.byQl).map(([ql, n]) => (
                  <span key={ql}>
                    {ql}: {n}
                  </span>
                ))}
              </div>
            ) : null}
            <CadImportPanel
              cadImport={form.cadImport}
              utilitiesTable={form.utilitiesTable}
              cadBusy={cadBusy}
              ss={ss}
              onUpload={handleCadUpload}
              onLayerMappingsChange={handleCadLayerMappings}
              onClear={() => setForm((f) => ({ ...f, cadImport: null, updatedAt: new Date().toISOString() }))}
            />
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
                { key: "depth", label: "Depth", placeholder: "0.8 m" },
                { key: "method", label: "Method", placeholder: "EML + GPR" },
                { key: "pas128Ql", label: "PAS128 QL", options: PAS128_QUALITY_LEVELS },
                { key: "confidence", label: "Confidence", options: UTILITY_CONFIDENCE_LEVELS },
                { key: "notes", label: "Notes", placeholder: "Near substation" },
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
            <label style={ss.lbl}>Findings & results *</label>
            <textarea
              style={{ ...ss.ta, minHeight: 120 }}
              value={form.sections.findings}
              onChange={(e) => setSection("findings", e.target.value)}
              placeholder="Summarise survey results: utilities detected, levels, defects, anomalies, confidence notes."
            />
            <div style={ss.sectionHead}>Recommendations</div>
            <textarea
              style={{ ...ss.ta, minHeight: 80 }}
              value={form.sections.recommendations}
              onChange={(e) => setSection("recommendations", e.target.value)}
              placeholder="Further works, verification, client actions, residual risks."
            />
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

        {tab === "photos" && (
          <>
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
            {(form.photos || []).length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 12 }}>No photos yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {form.photos.map((ph, idx) => (
                  <div key={ph.id || idx} style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                    <img src={ph.dataUrl} alt="" style={{ width: 100, height: 75, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
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
          </>
        )}

        {tab === "preview" && (
          livePreviewOpen ? (
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
          )
        )}
        </div>

        <div className="app-sticky-footer app-sticky-footer--actions app-survey-editor-shortcuts" title="Ctrl+S save · Alt+←/→ tabs · Ctrl+Shift+P preview">
          {prevTab ? (
            <button type="button" style={ss.btn} onClick={() => setTab(prevTab)}>
              ← Previous
            </button>
          ) : (
            <span />
          )}
          {nextTabNav ? (
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
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={ss.btnP}
            disabled={saving}
            onClick={() => handleSave()}
          >
            {saving ? "Saving…" : "Save report"}
          </button>
          {form.status !== "final" && (
            <button
              type="button"
              style={{ ...ss.btn, borderColor: "#0d9488", color: "#0d9488" }}
              disabled={saving}
              onClick={() => {
                const gate = evaluateSurveyFinalGate(form);
                if (!gate.allowed) {
                  window.alert(gate.message || "Complete QA, calibration, sign-off and photos before marking final.");
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
  const { caps } = useApp();
  const [reports, setReports] = useState(() => load(STORAGE_KEY, []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [ramsDocs] = useState(() => load("rams_builder_docs", []));
  const [projectPlans] = useState(() => listProjectPlans());
  const [geoPhotos] = useState(() => load("geo_photos", []));
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
  });
  const { d1Hydrating: d1ProjH, d1OutboxPending: d1ProjO } = useD1OrgArraySync({
    storageKey: "mysafeops_projects",
    namespace: "mysafeops_projects",
    value: projects,
    setValue: setProjects,
    load,
    save,
  });
  const d1Hydrating = d1RepH || d1ProjH;
  const d1OutboxPending = d1RepO || d1ProjO;

  const filtered = useMemo(() => {
    let rows = reports;
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

  const listSummary = useMemo(() => summarizeSurveyReportList(reports), [reports]);

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
    try {
      const { downloadSurveyReportPdf } = await import("./surveyReportPdf");
      await downloadSurveyReportPdf(report, {
        ramsTitle: rams?.title || rams?.documentTitle,
        projectLat: project?.lat,
        projectLng: project?.lng,
      });
      pushAudit({ action: "survey_report_pdf", entity: "survey_report", detail: report.ref || report.id });
    } catch (e) {
      alert(e?.message || "PDF export failed.");
    } finally {
      setPdfBusyId("");
    }
  }, [projectById, ramsById]);

  const exportPackForReport = useCallback(async (report) => {
    const exportGate = evaluateSurveyExportGate(report);
    if (!exportGate.allowed) {
      alert(exportGate.message || "Export pack is not ready yet.");
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
      alert(e?.message || "Export pack failed.");
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

  const missingProjectCount = useMemo(
    () => projectsMissingReports(projects, reports).length,
    [projects, reports]
  );

  const batchExportFinalPacks = useCallback(async () => {
    const finals = reports.filter((r) => r.status === "final");
    const eligible = finals.filter((r) => evaluateSurveyExportGate(r).allowed);
    if (!eligible.length) {
      alert("No final reports meet export pack requirements (PAS128 QL, utilities, QA, photos).");
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
      window.alert("No final reports could be appended — each needs a RAMS on its project.");
      return;
    }
    window.alert(`Appended ${ok} survey summary(ies) to RAMS.${skipped ? ` ${skipped} skipped (no RAMS).` : ""}`);
  }, [reports, ramsDocs]);

  const batchAssignSelectedToProject = useCallback(() => {
    const ids = [...selectedReportIds];
    if (!ids.length) {
      window.alert("Select reports first (turn on bulk select).");
      return;
    }
    const targetId = projectFilter || window.prompt("Project ID to assign selected reports to:");
    if (!targetId) return;
    if (!projects.some((p) => p.id === targetId)) {
      window.alert("Project not found.");
      return;
    }
    setReports((prev) => batchAssignSurveysToProject(ids, targetId, prev));
    setSelectedReportIds(new Set());
    setListBulkMode(false);
  }, [selectedReportIds, projectFilter, projects]);

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
      message: `${r.ref || r.title || "This report"} will be permanently removed.`,
      tone: "danger",
      confirmLabel: "Delete",
      onConfirm: () => {
        setReports((p) => p.filter((x) => x.id !== r.id));
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

  const handleGeoJsonExport = useCallback((r) => {
    try {
      downloadSurveyReportGeoJson(r, geoPhotos);
    } catch (e) {
      alert(e?.message || "GeoJSON export failed.");
    }
  }, [geoPhotos]);

  const handleRevision = useCallback((r) => {
    duplicateReport(r, { asRevision: true });
  }, [duplicateReport]);

  const createNew = () => {
    const ref = nextSurveyRef(reports);
    const pid = defaultProjectIdForCreate(projects);
    if (!projects.length) {
      if (window.confirm("Survey reports must be linked to a project. Create a project first?")) {
        setWorkspaceNavTarget({ viewId: "projects", action: "createProject" });
        openWorkspaceView({ viewId: "projects" });
      }
      return;
    }
    const p = projects.find((x) => x.id === pid);
    const base = blankSurveyReport({
      ref,
      title: p ? `Survey report — ${p.name || ref}` : `Survey report ${ref}`,
      projectId: pid || "",
    });
    setModal({
      type: "edit",
      data: pid ? prefillReportFromProject(base, p, pickRamsForProject(ramsDocs, pid)) : base,
      isNew: true,
    });
  };

  return (
    <div className="app-document-module" style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="survey reports" />

      {modal?.type === "edit" && (
        <ReportEditor
          report={modal.data}
          isNew={modal.isNew}
          projects={projects}
          ramsDocs={ramsDocs.filter((d) => d.surveyWorkType || d.surveyMethodStatement)}
          projectPlans={projectPlans}
          geoPhotos={geoPhotos}
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

      <PageHero
        badgeText="SR"
        title="Survey report"
        lead="PAS128 survey reports — cover page, utility schedule, PDF download, revision control, geo-photo import and branded A4 print."
        right={
          <button type="button" style={ss.btnP} onClick={createNew}>
            + New report
          </button>
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

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          ["all", "All"],
          ["draft", "Drafts"],
          ["ready", "Ready to finalise"],
          ["final", "Final"],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            style={{
              ...ss.btn,
              background: filter === k ? "#E6F1FB" : undefined,
              color: filter === k ? "#0C447C" : undefined,
              fontSize: 12,
            }}
          >
            {l}
          </button>
        ))}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          style={{ ...ss.inp, fontSize: 12, minWidth: 160, marginLeft: 4 }}
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
        {reports.filter((r) => r.status === "final").length > 0 ? (
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
          style={{ ...ss.btn, fontSize: 12, ...(listBulkMode ? { background: "#E6F1FB", color: "#0C447C" } : {}) }}
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
              ? "Create a report with structured checklists for weather, utility records and limitations — then preview A4 or mark final."
              : "Try another filter or create a new report."
          }
          actionLabel={reports.length === 0 ? "Create first report" : "Create report"}
          onAction={createNew}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(filtered) && (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, filtered.length)} of {filtered.length}
            </div>
          )}
          {(() => {
            let lastGroup = null;
            return listPg.visible(enrichedRows).map((row) => {
              const r = row.report;
              const groupKey = r.projectId || "__none__";
              const meta = listGroupMeta.get(groupKey);
              const showGroupHeader = !projectFilter && groupKey !== lastGroup;
              lastGroup = groupKey;
              const hasGeo = r.projectId && countGeoPhotosForReport(geoPhotos, r.projectId) > 0;
              return (
                <SurveyListRow
                  key={r.id}
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
                  onGeoJsonExport={hasGeo ? handleGeoJsonExport : null}
                  onRevision={handleRevision}
                  onProjectHub={r.projectId ? handleProjectHub : null}
                  onDelete={handleListDelete}
                />
              );
            });
          })()}
          {listPg.hasMore(filtered) && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(filtered)} remaining)
              </button>
            </div>
          )}
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
  );
}
