import { useEffect, useMemo, useState, useDeferredValue, useCallback, useRef } from "react";
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
} from "./surveyReportConstants";
import {
  buildLimitationsFromKeys,
  nextSurveyRef,
  surveyReportQuality,
  surveyTypeLabel,
  toggleArray,
} from "./surveyReportHelpers";
import { downloadSurveyReportHtml, openSurveyReportPrint, buildSurveyReportHtml } from "./surveyReportPrintHtml";
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
  runSmartFillAll,
  smartFillNextSteps,
  suggestLimitationKeys,
} from "./surveyReportSmart";
import { listProjectPlans, plansForProject } from "../permits/permitPlanOverlayRegistry";
import { consumeWorkspaceNavTarget, openWorkspaceView, setWorkspaceNavTarget } from "../../utils/workspaceNavContext";
import { countGeoPhotosForReport, importGeoPhotosIntoReport as mergeGeoPhotos } from "../../utils/geoPhotoIntegrations";
import StatusChip from "../../components/StatusChip";
import EmptyState from "../../components/EmptyState";
import PrintPreviewFrame from "../../components/PrintPreviewFrame";
import ModuleOverlay from "../../components/ModuleOverlay";
import { getSurveyStatusMeta } from "../../utils/statusChipMeta";

const STORAGE_KEY = "survey_reports";

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

const EDITOR_TABS = [
  { id: "details", label: "Details" },
  { id: "scope", label: "Scope & method" },
  { id: "weather", label: "Weather" },
  { id: "records", label: "Records review" },
  { id: "limitations", label: "Limitations" },
  { id: "findings", label: "Findings" },
  { id: "photos", label: "Photos" },
  { id: "preview", label: "Print preview" },
];

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

function QualityBar({ report }) {
  const q = surveyReportQuality(report);
  const colour = q.score >= 80 ? "#0d9488" : q.score >= 50 ? "#f59e0b" : "#ea580c";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 500 }}>Report completeness</span>
        <span style={{ color: colour, fontWeight: 600 }}>{q.score}%</span>
      </div>
      <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${q.score}%`, height: "100%", background: colour, transition: "width 0.2s" }} />
      </div>
      {q.missing.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>
          Still needed: {q.missing.join(" · ")}
        </div>
      )}
    </div>
  );
}

function SmartAssistPanel({ form, projects, ramsDocs, projectPlans, geoPhotos = [], onApply, linkedRams, onGoToTab }) {
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
              mergeGeoPhotos(form, geoPhotos, { replaceFindingsBlock: true })
            )}
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

function ReportEditor({ report, projects, ramsDocs, projectPlans, geoPhotos = [], isNew, onSave, onClose, onPrint }) {
  const [form, setForm] = useState(() => ({ ...report }));
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const autoFillRan = useRef(false);

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
    })
      .then((next) => setForm({ ...next, updatedAt: new Date().toISOString() }))
      .catch(() => {});
  }, [isNew, report, projects, ramsDocs, projectPlans]);

  const deferredForm = useDeferredValue(form);

  const previewHtml = useMemo(() => {
    if (tab !== "preview") return "";
    try {
      const linkedRams = ramsDocs.find((d) => d.id === deferredForm.linkedRamsId);
      return buildSurveyReportHtml(
        {
          ...deferredForm,
          limitationsText: deferredForm.limitationsText || buildLimitationsFromKeys(deferredForm.limitationKeys),
        },
        { ramsTitle: linkedRams?.title || linkedRams?.documentNo || "" }
      );
    } catch {
      return "";
    }
  }, [tab, deferredForm, ramsDocs]);

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

  const linkedRams = ramsDocs.find((d) => d.id === form.linkedRamsId);

  const preparePayload = (extra = {}) => ({
    ...form,
    ...extra,
    limitationsText: form.limitationsText || buildLimitationsFromKeys(form.limitationKeys),
  });

  const handleSave = async (extra = {}) => {
    setSaving(true);
    try {
      let payload = preparePayload(extra);
      const q = surveyReportQuality(payload);
      if (q.score < 50 && payload.status !== "final") {
        const runFill = confirm(`Report is ${q.score}% complete. Run Smart fill before saving?`);
        if (runFill) {
          const project = projects.find((p) => p.id === payload.projectId);
          payload = await runSmartFillAll(payload, {
            project,
            ramsDocs,
            projectPlans: projectPlansForForm,
            linkedRams,
            useAi: false,
          });
          setForm({ ...payload, updatedAt: new Date().toISOString() });
        }
      }
      onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleOverlay>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 760 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{form.ref ? form.ref : "New survey report"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <StatusChip meta={getSurveyStatusMeta(form.status)} size="md" />
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {form.status === "final" ? "Read-only fields locked on save" : "Complete checklists then print or mark final"}
              </span>
            </div>
          </div>
          <button type="button" style={{ ...ss.btn, padding: "4px 10px" }} onClick={onClose}>
            Close
          </button>
        </div>

        <QualityBar report={form} />

        <SmartAssistPanel
          form={form}
          projects={projects}
          ramsDocs={ramsDocs}
          projectPlans={projectPlansForForm}
          geoPhotos={geoPhotos}
          linkedRams={linkedRams}
          onGoToTab={setTab}
          onApply={(next) => setForm({ ...next, updatedAt: new Date().toISOString() })}
        />

        <div style={ss.tabRow}>
          {EDITOR_TABS.map((t) => (
            <button key={t.id} type="button" style={ss.tab(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

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
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                    Linked to RAMS: {linkedRams.title || linkedRams.documentTitle}
                  </div>
                )}
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
          </>
        )}

        {tab === "weather" && (
          <>
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
                        ...mergeGeoPhotos(f, geoPhotos, { replaceFindingsBlock: true }),
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
          <PrintPreviewFrame
            html={previewHtml}
            title="Survey report — A4 preview"
            height={520}
            onPrint={() => onPrint(form, linkedRams)}
            printLabel="Print / save PDF"
          />
        )}

        <div className="app-sticky-footer app-sticky-footer--actions">
          <button type="button" style={ss.btn} onClick={() => onPrint(form, linkedRams)}>
            Preview / print
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
                if (!confirm("Mark this report as final? You can still edit later but status will show as issued.")) return;
                handleSave({ status: "final", finalisedAt: new Date().toISOString() });
              }}
            >
              Mark final
            </button>
          )}
        </div>
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
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("all");
  const listPg = useRegisterListPaging(30);

  useEffect(() => {
    const t = consumeWorkspaceNavTarget();
    if (t?.viewId !== "survey-report") return;
    const projs = load("mysafeops_projects", []);
    const existing = load(STORAGE_KEY, []);
    const geo = load("geo_photos", []);
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
        return;
      }
      if (p) {
        const rams = load("rams_builder_docs", []);
        const base = blankSurveyReport({
          ref,
          title: `Survey report — ${p.name || ref}`,
          projectId: p.id,
        });
        const ramsDoc = pickRamsForProject(rams, p.id);
        setModal({
          type: "edit",
          isNew: true,
          data: mergeGeoPhotos(prefillReportFromProject(base, p, ramsDoc), geo, { replaceFindingsBlock: true }),
        });
        return;
      }
    }
    if (t?.projectId) {
      const p = projs.find((x) => x.id === t.projectId);
      if (p) {
        const rams = load("rams_builder_docs", []);
        const base = blankSurveyReport({
          ref,
          title: `Survey report — ${p.name || ref}`,
          projectId: p.id,
        });
        const ramsDoc = pickRamsForProject(rams, p.id);
        setModal({
          type: "edit",
          isNew: true,
          data: prefillReportFromProject(base, p, ramsDoc),
        });
        return;
      }
    }
    if (t?.action === "createReport") {
      setModal({
        type: "edit",
        isNew: true,
        data: blankSurveyReport({ ref, title: `Survey report ${ref}` }),
      });
    }
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
    if (filter === "draft") return reports.filter((r) => r.status !== "final");
    if (filter === "final") return reports.filter((r) => r.status === "final");
    return reports;
  }, [reports, filter]);

  const persist = (report, isNew) => {
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

  const duplicateReport = (report) => {
    const ref = nextSurveyRef(reports);
    const copy = {
      ...JSON.parse(JSON.stringify(report)),
      id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ref,
      title: `${report.title || report.ref || "Survey report"} (copy)`,
      status: "draft",
      surveyDate: new Date().toISOString().slice(0, 10),
      finalisedAt: null,
      smartFillAt: null,
      sitePlanSnapshots: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setReports((prev) => [copy, ...prev]);
    pushAudit({ action: "survey_report_duplicate", entity: "survey_report", detail: ref });
    setModal({ type: "edit", isNew: false, data: copy });
  };

  const missingProjectCount = useMemo(
    () => projectsMissingReports(projects, reports).length,
    [projects, reports]
  );

  const batchCreateForProjects = () => {
    if (!missingProjectCount) return;
    if (!confirm(`Create draft survey reports for ${missingProjectCount} project(s) that have no report yet?`)) return;
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
  };

  const createNew = () => {
    const ref = nextSurveyRef(reports);
    setModal({
      type: "edit",
      data: blankSurveyReport({ ref, title: `Survey report ${ref}` }),
      isNew: true,
    });
  };

  const printReport = (report) => {
    const rams = ramsDocs.find((d) => d.id === report.linkedRamsId);
    openSurveyReportPrint(report, { ramsTitle: rams?.title || rams?.documentTitle });
    pushAudit({ action: "survey_report_print", entity: "survey_report", detail: report.ref || report.id });
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
          onSave={(r) => persist(r, modal.isNew)}
          onClose={() => setModal(null)}
          onPrint={(r) => {
            const linked = ramsDocs.find((d) => d.id === r.linkedRamsId);
            openSurveyReportPrint(r, { ramsTitle: linked?.title || linked?.documentTitle });
          }}
        />
      )}

      <PageHero
        badgeText="SR"
        title="Survey report"
        lead="PAS128-style field survey reports with weather, records review, limitation checklists and branded print output."
        right={
          <button type="button" style={ss.btnP} onClick={createNew}>
            + New report
          </button>
        }
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          ["all", "All"],
          ["draft", "Drafts"],
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
          {listPg.visible(filtered).map((r) => {
            const q = surveyReportQuality(r);
            return (
              <div
                key={r.id}
                style={{
                  ...ss.card,
                  borderLeft: `4px solid ${r.status === "final" ? "#0d9488" : "#f59e0b"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 15 }}>{r.title || r.ref || "Untitled"}</strong>
                      <StatusChip meta={getSurveyStatusMeta(r.status)} />
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{q.score}% complete</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                      {r.ref} · {r.surveyDate}
                      {r.projectName ? ` · ${r.projectName}` : ""}
                      {r.surveyType ? ` · ${surveyTypeLabel(r.surveyType)}` : ""}
                    </div>
                    {r.sections?.findings && (
                      <div style={{ fontSize: 13, marginTop: 8, color: "var(--color-text-primary)", lineHeight: 1.45 }}>
                        {r.sections.findings.slice(0, 140)}
                        {r.sections.findings.length > 140 ? "…" : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <button type="button" style={ss.btn} onClick={() => printReport(r)}>
                      Print
                    </button>
                    <button
                      type="button"
                      style={ss.btn}
                      onClick={() => {
                        downloadSurveyReportHtml(r);
                        pushAudit({ action: "survey_report_html", entity: "survey_report", detail: r.ref || r.id });
                      }}
                    >
                      HTML
                    </button>
                    <button type="button" style={ss.btn} onClick={() => duplicateReport(r)}>
                      Duplicate
                    </button>
                    <button type="button" style={ss.btnP} onClick={() => setModal({ type: "edit", data: r, isNew: false })}>
                      Edit
                    </button>
                    {caps.deleteRecords && (
                      <button
                        type="button"
                        style={{ ...ss.btn, color: "#A32D2D" }}
                        onClick={() => {
                          if (confirm("Delete this survey report?")) {
                            setReports((p) => p.filter((x) => x.id !== r.id));
                            pushAudit({ action: "survey_report_delete", entity: "survey_report", detail: r.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {listPg.hasMore(filtered) && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(filtered)} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
