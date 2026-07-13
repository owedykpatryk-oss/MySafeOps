import { useCallback, useEffect, useMemo, useState } from "react";
import "../../styles/gpr-report.css";
import { useD1OrgArraySync } from "../../hooks/useD1OrgArraySync";
import { useApp } from "../../context/AppContext";
import { pushAudit } from "../../utils/auditLog";
import { ms } from "../../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import PageHero from "../../components/PageHero";
import { D1ModuleSyncBanner } from "../../components/D1ModuleSyncBanner";
import EmptyState from "../../components/EmptyState";
import ModuleOverlay from "../../components/ModuleOverlay";
import ConfirmDialog from "../../components/ConfirmDialog";
import SurveyLivePreviewDock from "../surveyReport/SurveyLivePreviewDock";
import GprEditorHero from "./GprEditorHero";
import GprInsightPanel from "./GprInsightPanel";
import GprListStatsBar from "./GprListStatsBar";
import GprListRow from "./GprListRow";
import GprDeliverableScorecard from "./GprDeliverableScorecard";
import GprProcessingPipeline from "./GprProcessingPipeline";
import GprChainageChart from "./GprChainageChart";
import GprRadargramLightbox from "./GprRadargramLightbox";
import GprWaveBackdrop from "./GprWaveBackdrop";
import GprScanPanelGrid from "./GprScanPanelGrid";
import GprAcquisitionDiagram from "./GprAcquisitionDiagram";
import { filterGprReports, groupGprReportsByProject, suggestDeliverableFlags, GPR_LIST_STATUS_FILTERS } from "./gprReportListHelpers";
import { consumeWorkspaceNavTarget } from "../../utils/workspaceNavContext";
import { countGprGeoPhotos, importGeoPhotosIntoGprReport } from "../../utils/gprGeoIntegrations";
import { pushRecycleBinItem } from "../../utils/recycleBin";
import { sanitizePrintPreviewHtml } from "../../utils/htmlEscape";
import {
  ANOMALY_CONFIDENCE,
  ANOMALY_TYPES,
  blankGprAnomaly,
  blankGprEquipment,
  blankGprReport,
  CALIBRATION_METHODS,
  ANOMALY_QUICK_TEMPLATES,
  GPR_EQUIPMENT_PRESETS,
  GPR_LIMITATION_RULES,
  GPR_QA_ITEMS,
  GPR_DELIVERABLES,
  GPR_SOFTWARE_OPTIONS,
  SCAN_SIGNAL_QUALITY,
  CHAINAGE_CONDITION_BANDS,
  PROCESSING_FILTER_CATALOG,
  blankGprScanPanel,
  blankGprChainageSegment,
  blankGprPlanFigure,
  MOISTURE_OPTIONS,
  PROCESSING_STEPS,
  REINFORCEMENT_OPTIONS,
  SCAN_MODES,
  SURFACE_TYPE_OPTIONS,
} from "./gprReportConstants";
import { buildGprReportHtml } from "./gprReportPrintHtml";
import GprLineLengthSummaryCard from "./GprLineLengthSummaryCard.jsx";
import { downloadGprReportPdf } from "./gprReportPdf";
import {
  gprReportQuality,
  nextGprRef,
  normalizeGprReport,
  enrichGprListRow,
  summarizeGprReportList,
  depthFromTwoWayTime,
  recalcGroundPenetration,
  buildAnomaliesGeoJson,
  buildDuplicateGprPayload,
  autoNumberAnomalies,
} from "./gprReportHelpers";
import { gprTabComplete, GPR_EDITOR_TABS } from "./gprReportEditorNav";
import {
  applyGprSmartNarratives,
  applyPrebuiltGprPack,
  fetchEnvironmentalIntoReport,
  fetchGeologyIntoReport,
  prefillGprFromProject,
  runGprSmartFill,
  suggestGprLimitationKeys,
  gprSmartTips,
  syncProcessingNarrative,
  addAnomalyFromTemplate,
  importFromSurveyReport,
  importChainageFromSurveyCad,
  buildGprLineLengthNarrative,
} from "./gprReportSmart";
import { applyIndustryGprTemplate } from "./gprReportTemplateContext";

const STORAGE_KEY = "gpr_reports";

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
  input: {
    width: "100%",
    padding: "8px 10px",
    border: "0.5px solid var(--color-border-secondary,#ccc)",
    borderRadius: 6,
    fontSize: 13,
    boxSizing: "border-box",
  },
  sectionHead: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "18px 0 10px",
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
  btn: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "DM Sans,sans-serif",
  },
};

const TAB_LABELS = {
  equipment: "Equipment & acquisition",
  ground: "Ground & environment",
};

const TABS = GPR_EDITOR_TABS.map((t) => ({ id: t.id, label: TAB_LABELS[t.id] || t.label }));

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: "var(--color-text-secondary)" }}>{label}</div>
      {children}
    </label>
  );
}

export default function GprReport() {
  const { dataRefreshTick } = useApp();
  const sync = useD1OrgArraySync(STORAGE_KEY, []);
  const [reports, setReports] = useState(() => load(STORAGE_KEY, []));
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState("setup");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [livePreviewOpen, setLivePreviewOpen] = useState(true);
  const [depthCalcNs, setDepthCalcNs] = useState("");
  const [lightboxRg, setLightboxRg] = useState(null);
  const [listStatus, setListStatus] = useState("all");
  const [listProject, setListProject] = useState("");
  const [groupByProject, setGroupByProject] = useState(true);
  const [confirmFinal, setConfirmFinal] = useState(false);

  const projects = useMemo(() => load("mysafeops_projects", []), [dataRefreshTick]);
  const surveyReports = useMemo(() => load("survey_reports", []), [dataRefreshTick]);
  const geoPhotos = useMemo(() => load("geo_photos", []), [dataRefreshTick]);
  const listSummary = useMemo(() => summarizeGprReportList(reports), [reports]);

  useEffect(() => {
    setReports(load(STORAGE_KEY, []));
  }, [dataRefreshTick, sync.lastSyncAt]);

  const persist = useCallback(
    (next) => {
      setReports(next);
      save(STORAGE_KEY, next);
      sync.queueSave(next);
    },
    [sync]
  );

  useEffect(() => {
    const t = consumeWorkspaceNavTarget();
    if (!t || t.viewId !== "gpr-report") return;
    if (t.reportId) {
      const found = reports.find((r) => r.id === t.reportId);
      if (found) setModal({ data: found, isNew: false });
    } else if (t.projectId) {
      const p = projects.find((x) => x.id === t.projectId);
      const ref = nextGprRef(reports);
      const base = prefillGprFromProject(blankGprReport({ ref }), p);
      setModal({ data: base, isNew: true });
    }
  }, [reports, projects]);

  const filtered = useMemo(
    () => filterGprReports(reports, { search, status: listStatus, projectId: listProject }),
    [reports, search, listStatus, listProject]
  );

  const grouped = useMemo(
    () => (groupByProject ? groupGprReportsByProject(filtered, projects) : null),
    [filtered, projects, groupByProject]
  );

  const form = modal?.data;
  const project = projects.find((p) => p.id === form?.projectId);
  const linkedSurveyReport = useMemo(() => {
    if (!form?.linkedSurveyReportId) return null;
    return surveyReports.find((s) => s.id === form.linkedSurveyReportId) || null;
  }, [form?.linkedSurveyReportId, surveyReports]);
  const surveyForCadImport = useMemo(() => {
    if (linkedSurveyReport?.cadImport?.summary?.length) return linkedSurveyReport;
    if (!form?.projectId) return null;
    return (
      surveyReports.find(
        (s) =>
          s.projectId === form.projectId
          && Array.isArray(s.cadImport?.summary)
          && s.cadImport.summary.some((r) => (Number(r.lengthM) || 0) > 0)
      ) || null
    );
  }, [linkedSurveyReport, form?.projectId, surveyReports]);
  const geoPhotoCount = form?.projectId ? countGprGeoPhotos(geoPhotos, form.projectId) : 0;

  const gprPrintExtras = useMemo(
    () => ({
      projectLat: project?.lat,
      projectLng: project?.lng,
      linkedSurveyReport,
    }),
    [project?.lat, project?.lng, linkedSurveyReport]
  );

  const previewHtml = useMemo(() => {
    if (!form) return "";
    return sanitizePrintPreviewHtml(buildGprReportHtml(form, gprPrintExtras));
  }, [form, gprPrintExtras]);

  const quality = form ? gprReportQuality(form) : { score: 0, missing: [] };
  const smartTips = useMemo(
    () => (form ? gprSmartTips(form, project, linkedSurveyReport) : []),
    [form, project, linkedSurveyReport]
  );

  const patch = (partial) => {
    if (!form) return;
    setModal({
      ...modal,
      data: normalizeGprReport({ ...form, ...partial, updatedAt: new Date().toISOString() }),
    });
  };

  const patchReport = (updater) => {
    if (!form) return;
    const next = typeof updater === "function" ? updater(form) : { ...form, ...updater };
    setModal({
      ...modal,
      data: normalizeGprReport({ ...next, updatedAt: new Date().toISOString() }),
    });
  };

  const patchNested = (key, partial) => {
    patch({ [key]: { ...form[key], ...partial } });
  };

  const saveReport = () => {
    if (!form) return;
    const normalized = normalizeGprReport(form);
    const next = modal.isNew
      ? [...reports, normalized]
      : reports.map((r) => (r.id === normalized.id ? normalized : r));
    persist(next);
    pushAudit({ action: modal.isNew ? "gpr_report_create" : "gpr_report_update", entity: "gpr_report", detail: normalized.ref });
    setModal(null);
  };

  const applyPreset = (presetKey, eqIndex = 0) => {
    const preset = GPR_EQUIPMENT_PRESETS.find((p) => p.key === presetKey);
    if (!preset || !form) return;
    const equipment = [...form.equipment];
    equipment[eqIndex] = {
      ...equipment[eqIndex],
      presetKey,
      manufacturer: preset.manufacturer,
      model: preset.model,
      antennaFrequencyMhz: preset.antennaFrequencyMhz,
      channels: preset.channels,
      configuration: preset.configuration,
    };
    patchReport((r) => {
      const withEq = {
        ...r,
        equipment,
        velocityModel: { ...r.velocityModel, assumedVelocityCmNs: preset.defaultVelocityCmNs },
      };
      return r.groundConditions?.fetchedAt ? recalcGroundPenetration(withEq) : withEq;
    });
  };

  const applyGenericTemplate = () => {
    if (!form) return;
    patchReport((r) => applyIndustryGprTemplate(r, { includeSamplePanel: false }));
  };

  const runPrebuiltPack = async () => {
    if (!form) return;
    setBusy("prebuilt");
    try {
      const filled = await applyPrebuiltGprPack(form, project);
      setModal({ ...modal, data: normalizeGprReport(filled) });
    } catch (e) {
      alert(e.message || "Prebuilt pack failed");
    } finally {
      setBusy("");
    }
  };

  const runSmartFill = async () => {
    if (!form) return;
    setBusy("smart");
    try {
      const filled = await runGprSmartFill(form, project);
      setModal({ ...modal, data: normalizeGprReport(filled) });
    } catch (e) {
      alert(e.message || "Smart fill failed");
    } finally {
      setBusy("");
    }
  };

  const fetchGeology = async () => {
    if (!form) return;
    setBusy("geology");
    try {
      const next = await fetchGeologyIntoReport(form, project);
      setModal({ ...modal, data: normalizeGprReport(applyGprSmartNarratives(next)) });
    } catch (e) {
      alert(e.message || "Geology lookup failed — check project coordinates or postcode");
    } finally {
      setBusy("");
    }
  };

  const fetchWeather = async () => {
    if (!form) return;
    setBusy("weather");
    try {
      const next = await fetchEnvironmentalIntoReport(form, project);
      setModal({ ...modal, data: normalizeGprReport(next) });
    } catch (e) {
      alert(e.message || "Weather lookup failed");
    } finally {
      setBusy("");
    }
  };

  const suggestLimitations = () => {
    if (!form) return;
    const keys = suggestGprLimitationKeys(form);
    patch({ limitationKeys: keys });
  };

  const markFinal = () => {
    if (!form) return;
    setConfirmFinal(true);
  };

  const confirmMarkFinal = () => {
    if (!form) return;
    patch({ status: "final", finalisedAt: new Date().toISOString() });
    setConfirmFinal(false);
  };

  const exportHtml = () => {
    if (!form) return;
    const html = buildGprReportHtml(form, gprPrintExtras);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${form.ref || "gpr-report"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    pushAudit({ action: "gpr_report_html", entity: "gpr_report", detail: form.ref });
  };

  const syncDeliverablesFromEvidence = () => {
    patch({ deliverables: suggestDeliverableFlags(form) });
  };

  const addPlanFigureFile = (file) => {
    if (!file || !form) return;
    const reader = new FileReader();
    reader.onload = () => {
      patchReport((r) => {
        const planFigures = [
          ...(r.planFigures || []),
          blankGprPlanFigure({
            label: file.name.replace(/\.[^.]+$/, ""),
            dataUrl: reader.result,
            fileName: file.name,
            capturedAt: new Date().toISOString(),
          }),
        ];
        return {
          ...r,
          planFigures,
          deliverables: suggestDeliverableFlags({ ...r, planFigures }),
        };
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveReport();
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setLivePreviewOpen((v) => !v);
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        const idx = TABS.findIndex((t) => t.id === tab);
        if (idx >= 0 && idx < TABS.length - 1) setTab(TABS[idx + 1].id);
      }
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = TABS.findIndex((t) => t.id === tab);
        if (idx > 0) setTab(TABS[idx - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, tab]);

  const exportPdf = async () => {
    if (!form) return;
    setBusy("pdf");
    try {
      await downloadGprReportPdf(form, gprPrintExtras);
    } finally {
      setBusy("");
    }
  };

  const duplicateReport = () => {
    if (!form) return;
    const dup = buildDuplicateGprPayload(form);
    dup.ref = nextGprRef(reports);
    setModal({ isNew: true, data: dup });
  };

  const exportAnomaliesGeoJson = () => {
    if (!form) return;
    const blob = new Blob([JSON.stringify(buildAnomaliesGeoJson(form), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${form.ref || "gpr-anomalies"}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importGeoPhotos = () => {
    if (!form?.projectId) return;
    try {
      patchReport((r) => importGeoPhotosIntoGprReport(r, geoPhotos));
    } catch (e) {
      alert(e.message || "Import failed");
    }
  };

  const importChainageFromSurveyCadAction = (replace = false) => {
    if (!surveyForCadImport) return;
    try {
      patchReport((r) => {
        const imported = importChainageFromSurveyCad(r, surveyForCadImport, { replace });
        const narrative = buildGprLineLengthNarrative(imported, surveyForCadImport);
        if (!narrative) return imported;
        const existing = String(imported.sections?.findings || "").trim();
        const snippet = narrative.slice(0, 48);
        if (existing.includes(snippet)) return imported;
        return {
          ...imported,
          sections: {
            ...imported.sections,
            findings: existing ? `${existing}\n\n${narrative}` : narrative,
          },
        };
      });
    } catch (e) {
      alert(e.message || "CAD import failed");
    }
  };

  const addRadargramFile = (file) => {
    if (!file || !form) return;
    const reader = new FileReader();
    reader.onload = () => {
      patchReport((r) => ({
        ...r,
        radargrams: [
          ...(r.radargrams || []),
          {
            id: `rg_${Date.now()}`,
            label: file.name.replace(/\.[^.]+$/, ""),
            lineRef: "",
            dataUrl: reader.result,
            fileName: file.name,
            capturedAt: new Date().toISOString(),
            notes: "",
          },
        ],
      }));
    };
    reader.readAsDataURL(file);
  };

  const renderSetup = () => (
    <>
      <Field label="Report ref">
        <input style={ss.input} value={form.ref} onChange={(e) => patch({ ref: e.target.value })} />
      </Field>
      <Field label="Title">
        <input style={ss.input} value={form.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Project">
        <select
          style={ss.input}
          value={form.projectId}
          onChange={(e) => {
            const p = projects.find((x) => x.id === e.target.value);
            setModal({
              ...modal,
              data: normalizeGprReport(prefillGprFromProject({ ...form, projectId: e.target.value }, p)),
            });
          }}
        >
          <option value="">— Select project —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Site / location reference">
        <input style={ss.input} value={form.siteAddress} onChange={(e) => patch({ siteAddress: e.target.value })} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Survey date">
          <input
            type="date"
            style={ss.input}
            value={form.surveyDate}
            onChange={(e) => patch({ surveyDate: e.target.value })}
          />
        </Field>
        <Field label="Surveyor">
          <input style={ss.input} value={form.surveyor} onChange={(e) => patch({ surveyor: e.target.value })} />
        </Field>
      </div>
      <Field label="Status">
        <select style={ss.input} value={form.status} onChange={(e) => patch({ status: e.target.value })}>
          <option value="draft">Draft</option>
          <option value="final">Final</option>
        </select>
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" style={{ ...ss.btn, background: "#0C447C", color: "#fff" }} disabled={!!busy} onClick={runPrebuiltPack}>
          {busy === "prebuilt" ? "Applying…" : "Apply prebuilt pack"}
        </button>
        <button type="button" style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }} disabled={!!busy} onClick={applyGenericTemplate}>
          Template only
        </button>
        <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0C447C" }} disabled={!!busy} onClick={runSmartFill}>
          {busy === "smart" ? "Filling…" : "BGS + weather + narratives"}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-secondary,#64748b)", lineHeight: 1.45 }}>
        Prebuilt pack loads the generic industry template, fetches BGS geology and weather, then fills report sections from rule-based narratives — no AI required.
      </p>
      <div style={{ marginTop: 16 }}>
        <div style={ss.sectionHead}>Deliverables checklist</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {GPR_DELIVERABLES.map((d) => (
            <label key={d.key} style={{ display: "flex", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!form.deliverables?.[d.key]}
                onChange={(e) => patchNested("deliverables", { [d.key]: e.target.checked })}
              />
              {d.label}
            </label>
          ))}
        </div>
        <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0C447C", marginTop: 8 }} onClick={syncDeliverablesFromEvidence}>
          Sync deliverables from evidence
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={ss.sectionHead}>Report sign-off</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Author">
            <input
              style={ss.input}
              value={form.signOff?.authorName || ""}
              onChange={(e) => patchNested("signOff", { authorName: e.target.value })}
            />
          </Field>
          <Field label="Checked by">
            <input
              style={ss.input}
              value={form.signOff?.checkerName || ""}
              onChange={(e) => patchNested("signOff", { checkerName: e.target.value })}
            />
          </Field>
          <Field label="Data processor">
            <input
              style={ss.input}
              value={form.signOff?.processorName || ""}
              onChange={(e) => patchNested("signOff", { processorName: e.target.value })}
            />
          </Field>
          <Field label="Checked date">
            <input
              type="date"
              style={ss.input}
              value={form.signOff?.checkedDate || ""}
              onChange={(e) => patchNested("signOff", { checkedDate: e.target.value })}
            />
          </Field>
        </div>
      </div>
      {form.projectId && surveyReports.filter((s) => s.projectId === form.projectId).length ? (
        <div style={{ marginTop: 16 }}>
          <div style={ss.sectionHead}>Import from survey report</div>
          <select
            style={ss.input}
            defaultValue=""
            onChange={(e) => {
              const sr = surveyReports.find((s) => s.id === e.target.value);
              if (sr) patchReport((r) => importFromSurveyReport(r, sr));
              e.target.value = "";
            }}
          >
            <option value="">— Pull findings / methodology from project survey —</option>
            {surveyReports
              .filter((s) => s.projectId === form.projectId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ref || s.title} ({s.surveyType || "survey"})
                </option>
              ))}
          </select>
        </div>
      ) : null}
    </>
  );

  const renderEquipment = () => {
    const eq = form.equipment?.[0] || blankGprEquipment();
    return (
      <>
        <div style={ss.sectionHead}>Equipment</div>
        <Field label="Equipment preset">
          <select style={ss.input} value={eq.presetKey} onChange={(e) => applyPreset(e.target.value, 0)}>
            <option value="">— Custom —</option>
            {GPR_EQUIPMENT_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Manufacturer">
            <input
              style={ss.input}
              value={eq.manufacturer}
              onChange={(e) => {
                const equipment = [{ ...eq, manufacturer: e.target.value }];
                patch({ equipment });
              }}
            />
          </Field>
          <Field label="Model">
            <input
              style={ss.input}
              value={eq.model}
              onChange={(e) => patch({ equipment: [{ ...eq, model: e.target.value }] })}
            />
          </Field>
          <Field label="Antenna centre frequency (MHz)">
            <input
              type="number"
              style={ss.input}
              value={eq.antennaFrequencyMhz}
              onChange={(e) => {
                const mhz = Number(e.target.value) || "";
                const equipment = [{ ...eq, antennaFrequencyMhz: mhz }];
                patchReport((r) => recalcGroundPenetration({ ...r, equipment }));
              }}
            />
          </Field>
          <Field label="Channels">
            <input
              type="number"
              style={ss.input}
              value={eq.channels}
              onChange={(e) => patch({ equipment: [{ ...eq, channels: Number(e.target.value) || 1 }] })}
            />
          </Field>
          <Field label="Serial no.">
            <input
              style={ss.input}
              value={eq.serialNo}
              onChange={(e) => patch({ equipment: [{ ...eq, serialNo: e.target.value }] })}
            />
          </Field>
          <Field label="Processing software">
            <input
              style={ss.input}
              value={eq.processingSoftware}
              onChange={(e) => patch({ equipment: [{ ...eq, processingSoftware: e.target.value }] })}
            />
          </Field>
        </div>
        <Field label="Configuration notes">
          <textarea
            style={ss.ta}
            rows={2}
            value={eq.configuration}
            onChange={(e) => patch({ equipment: [{ ...eq, configuration: e.target.value }] })}
          />
        </Field>

        <div style={ss.sectionHead}>Acquisition</div>
        <GprAcquisitionDiagram scanMode={form.acquisition.scanMode} lineSpacingM={form.acquisition.lineSpacingM} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Scan mode">
            <select
              style={ss.input}
              value={form.acquisition.scanMode}
              onChange={(e) => patchNested("acquisition", { scanMode: e.target.value })}
            >
              {SCAN_MODES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Line spacing (m)">
            <input
              style={ss.input}
              value={form.acquisition.lineSpacingM}
              onChange={(e) => patchNested("acquisition", { lineSpacingM: e.target.value })}
            />
          </Field>
          <Field label="Trace spacing (m)">
            <input
              style={ss.input}
              value={form.acquisition.traceSpacingM}
              onChange={(e) => patchNested("acquisition", { traceSpacingM: e.target.value })}
            />
          </Field>
          <Field label="Time window (ns)">
            <input
              style={ss.input}
              value={form.acquisition.timeWindowNs}
              onChange={(e) => patchNested("acquisition", { timeWindowNs: e.target.value })}
            />
          </Field>
          <Field label="Target depth (m)">
            <input
              style={ss.input}
              value={form.acquisition.depthRangeM}
              onChange={(e) => patchNested("acquisition", { depthRangeM: e.target.value })}
            />
          </Field>
          <Field label="Coverage (%)">
            <input
              style={ss.input}
              value={form.acquisition.coveragePercent}
              onChange={(e) => patchNested("acquisition", { coveragePercent: e.target.value })}
            />
          </Field>
        </div>

        <div style={ss.sectionHead}>Velocity model</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Calibration method">
            <select
              style={ss.input}
              value={form.velocityModel.calibrationMethod}
              onChange={(e) => patchNested("velocityModel", { calibrationMethod: e.target.value })}
            >
              {CALIBRATION_METHODS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Measured velocity (cm/ns)">
            <input
              style={ss.input}
              value={form.velocityModel.measuredVelocityCmNs}
              onChange={(e) => patchNested("velocityModel", { measuredVelocityCmNs: e.target.value })}
            />
          </Field>
          <Field label="Assumed velocity (cm/ns)">
            <input
              style={ss.input}
              value={form.velocityModel.assumedVelocityCmNs}
              onChange={(e) => patchNested("velocityModel", { assumedVelocityCmNs: e.target.value })}
            />
          </Field>
          <Field label="Calibration target">
            <input
              style={ss.input}
              value={form.velocityModel.calibrationTarget}
              onChange={(e) => patchNested("velocityModel", { calibrationTarget: e.target.value })}
            />
          </Field>
        </div>

        <div style={ss.sectionHead}>Depth calculator</div>
        <div className="app-gpr-depth-calc">
          <Field label="Two-way time (ns)">
            <input
              style={ss.input}
              value={depthCalcNs}
              onChange={(e) => setDepthCalcNs(e.target.value)}
              placeholder="e.g. 40"
            />
          </Field>
          <p className="app-gpr-depth-calc__result">
            Depth ≈{" "}
            <strong>
              {depthFromTwoWayTime(
                depthCalcNs,
                form.velocityModel.measuredVelocityCmNs || form.velocityModel.assumedVelocityCmNs
              ) ?? "—"}{" "}
              m
            </strong>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 8 }}>
              using {form.velocityModel.measuredVelocityCmNs || form.velocityModel.assumedVelocityCmNs || "—"} cm/ns
            </span>
          </p>
        </div>
      </>
    );
  };

  const renderGround = () => (
    <>
      <GprInsightPanel
        report={form}
        onRecalcGround={() => patchReport((r) => recalcGroundPenetration(r))}
        onApplyAntenna={(mhz) => {
          const eq = form.equipment?.[0] || blankGprEquipment();
          patchReport((r) =>
            recalcGroundPenetration({
              ...r,
              equipment: [{ ...eq, antennaFrequencyMhz: mhz }],
            })
          );
        }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <button type="button" style={{ ...ss.btn, background: "#0C447C", color: "#fff" }} disabled={!!busy} onClick={fetchGeology}>
          {busy === "geology" ? "Fetching BGS…" : "Fetch BGS geology"}
        </button>
        <button type="button" style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }} disabled={!!busy} onClick={fetchWeather}>
          {busy === "weather" ? "Fetching weather…" : "Fetch weather for survey date"}
        </button>
      </div>

      <div style={ss.sectionHead}>Site observations</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Surface type">
          <select
            style={ss.input}
            value={form.groundConditions.siteObservations.surfaceType}
            onChange={(e) =>
              patchNested("groundConditions", {
                siteObservations: { ...form.groundConditions.siteObservations, surfaceType: e.target.value },
              })
            }
          >
            {SURFACE_TYPE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moisture">
          <select
            style={ss.input}
            value={form.groundConditions.siteObservations.moisture}
            onChange={(e) =>
              patchReport((r) =>
                recalcGroundPenetration({
                  ...r,
                  groundConditions: {
                    ...r.groundConditions,
                    siteObservations: { ...r.groundConditions.siteObservations, moisture: e.target.value },
                  },
                })
              )
            }
          >
            {MOISTURE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reinforcement">
          <select
            style={ss.input}
            value={form.groundConditions.siteObservations.reinforcement}
            onChange={(e) =>
              patchNested("groundConditions", {
                siteObservations: { ...form.groundConditions.siteObservations, reinforcement: e.target.value },
              })
            }
          >
            {REINFORCEMENT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={form.groundConditions.siteObservations.madeGround}
          onChange={(e) =>
            patchNested("groundConditions", {
              siteObservations: { ...form.groundConditions.siteObservations, madeGround: e.target.checked },
            })
          }
        />
        Made ground / backfill present
      </label>
      <Field label="Ground notes">
        <textarea
          style={ss.ta}
          rows={3}
          value={form.groundConditions.siteObservations.notes}
          onChange={(e) =>
            patchNested("groundConditions", {
              siteObservations: { ...form.groundConditions.siteObservations, notes: e.target.value },
            })
          }
        />
      </Field>

      {form.groundConditions?.narrative ? (
        <details style={{ marginTop: 12, fontSize: 13 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Full BGS narrative</summary>
          <p style={{ marginTop: 8, lineHeight: 1.5 }}>{form.groundConditions.narrative}</p>
        </details>
      ) : null}
    </>
  );

  const renderFindings = () => (
    <>
      <div className="app-gpr-radargram-panel">
        <div style={ss.sectionHead}>Radargrams & scan images</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C", cursor: "pointer" }}>
            + Upload image
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addRadargramFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {form.projectId && geoPhotoCount > 0 ? (
            <button type="button" style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }} onClick={importGeoPhotos}>
              Import {geoPhotoCount} geo-photo(s)
            </button>
          ) : null}
          <button
            type="button"
            style={{ ...ss.btn, background: "#f1f5f9", color: "#0C447C" }}
            onClick={() => patchReport((r) => autoNumberAnomalies(r))}
          >
            Auto-number anomalies
          </button>
          {(form.anomalies || []).length ? (
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0C447C" }} onClick={exportAnomaliesGeoJson}>
              Export anomalies JSON
            </button>
          ) : null}
        </div>
        {(form.radargrams || []).length ? (
          <div className="app-gpr-radargram-grid">
            {(form.radargrams || []).map((rg, idx) => (
              <div key={rg.id} className="app-gpr-radargram-thumb" onClick={() => setLightboxRg(rg)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setLightboxRg(rg)}>
                <img src={rg.dataUrl} alt="" />
                <input
                  style={{ ...ss.input, fontSize: 11, marginTop: 4 }}
                  value={rg.label}
                  placeholder="Label"
                  onChange={(e) => {
                    const radargrams = [...form.radargrams];
                    radargrams[idx] = { ...rg, label: e.target.value };
                    patch({ radargrams });
                  }}
                />
                <input
                  style={{ ...ss.input, fontSize: 11, marginTop: 4 }}
                  value={rg.lineRef}
                  placeholder="Line ref"
                  onChange={(e) => {
                    const radargrams = [...form.radargrams];
                    radargrams[idx] = { ...rg, lineRef: e.target.value };
                    patch({ radargrams });
                  }}
                />
                <button
                  type="button"
                  className="app-gpr-list-delete"
                  onClick={() => patch({ radargrams: form.radargrams.filter((_, i) => i !== idx) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
            Attach radargram screenshots or import GPR setup photos from geo-photos.
          </p>
        )}
      </div>
      <div className="app-gpr-radargram-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={ss.sectionHead}>Plan layouts & CAD figures</div>
          <label style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C", cursor: "pointer" }}>
            + Upload plan / CAD
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addPlanFigureFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {(form.planFigures || []).length ? (
          <div className="app-gpr-radargram-grid">
            {(form.planFigures || []).map((pf, idx) => (
              <div key={pf.id} className="app-gpr-radargram-thumb app-gpr-plan-figure-thumb">
                <img src={pf.dataUrl} alt="" />
                <input
                  style={{ ...ss.input, fontSize: 11, marginTop: 4 }}
                  value={pf.label}
                  placeholder="Figure label"
                  onChange={(e) => {
                    const planFigures = [...form.planFigures];
                    planFigures[idx] = { ...pf, label: e.target.value };
                    patch({ planFigures });
                  }}
                />
                <button
                  type="button"
                  className="app-gpr-list-delete"
                  onClick={() => patch({ planFigures: form.planFigures.filter((_, i) => i !== idx) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Attach 2D plan layouts or CAD export screenshots (IQMaps / GeoLitix plan view).
          </p>
        )}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={ss.sectionHead}>Scan panels (grid / slab)</div>
          <button
            type="button"
            style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }}
            onClick={() => patch({ scanPanels: [...(form.scanPanels || []), blankGprScanPanel()] })}
          >
            + Panel
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          Grid metadata for plan layouts — grid size, scan spacing, signal quality and interpretation (CAD-style panel summary).
        </p>
        <GprScanPanelGrid
          panels={form.scanPanels}
          onSelectPanel={(p) => {
            const idx = form.scanPanels.findIndex((x) => x.id === p.id);
            if (idx >= 0) {
              document.getElementById(`gpr-panel-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />
        {(form.scanPanels || []).map((p, idx) => (
          <div key={p.id} id={`gpr-panel-${p.id}`} className="app-gpr-scan-panel-card">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              <Field label="Panel ref">
                <input
                  style={ss.input}
                  value={p.panelRef}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, panelRef: e.target.value };
                    patch({ scanPanels });
                  }}
                />
              </Field>
              <Field label="Grid W (m)">
                <input
                  style={ss.input}
                  value={p.gridSizeW}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, gridSizeW: e.target.value };
                    patch({ scanPanels });
                  }}
                />
              </Field>
              <Field label="Grid H (m)">
                <input
                  style={ss.input}
                  value={p.gridSizeH}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, gridSizeH: e.target.value };
                    patch({ scanPanels });
                  }}
                />
              </Field>
              <Field label="H spacing (m)">
                <input
                  style={ss.input}
                  value={p.scanSpacingH}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, scanSpacingH: e.target.value };
                    patch({ scanPanels });
                  }}
                />
              </Field>
              <Field label="V spacing (m)">
                <input
                  style={ss.input}
                  value={p.scanSpacingV}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, scanSpacingV: e.target.value };
                    patch({ scanPanels });
                  }}
                />
              </Field>
              <Field label="Target depth (m)">
                <input
                  style={ss.input}
                  value={p.targetDepthM}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, targetDepthM: e.target.value };
                    patch({ scanPanels });
                  }}
                />
              </Field>
              <Field label="Signal quality">
                <select
                  style={ss.input}
                  value={p.signalQuality}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, signalQuality: e.target.value };
                    patch({ scanPanels });
                  }}
                >
                  {SCAN_SIGNAL_QUALITY.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Linked radargram">
                <select
                  style={ss.input}
                  value={p.radargramId || ""}
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, radargramId: e.target.value };
                    patch({ scanPanels });
                  }}
                >
                  <option value="">— None —</option>
                  {(form.radargrams || []).map((rg) => (
                    <option key={rg.id} value={rg.id}>
                      {rg.label || rg.lineRef || rg.id}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Primary interpretation">
              <input
                style={ss.input}
                value={p.primaryInterpretation}
                placeholder="e.g. reinforcement mesh, void, linear reflector"
                onChange={(e) => {
                  const scanPanels = [...form.scanPanels];
                  scanPanels[idx] = { ...p, primaryInterpretation: e.target.value };
                  patch({ scanPanels });
                }}
              />
            </Field>
            <Field label="Comments">
              <textarea
                style={ss.ta}
                rows={2}
                value={p.comments}
                onChange={(e) => {
                  const scanPanels = [...form.scanPanels];
                  scanPanels[idx] = { ...p, comments: e.target.value };
                  patch({ scanPanels });
                }}
              />
            </Field>
            <button
              type="button"
              style={{ ...ss.btn, background: "transparent", color: "#b91c1c", fontSize: 12 }}
              onClick={() => patch({ scanPanels: form.scanPanels.filter((_, i) => i !== idx) })}
            >
              Remove panel
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={ss.sectionHead}>Chainage / corridor segments</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {surveyForCadImport ? (
              <>
                <button
                  type="button"
                  style={{ ...ss.btn, background: "#ecfdf5", color: "#047857" }}
                  onClick={() => importChainageFromSurveyCadAction(false)}
                >
                  Import from survey CAD
                </button>
                {(form.chainageSegments || []).length ? (
                  <button
                    type="button"
                    style={{ ...ss.btn, background: "transparent", color: "#047857", fontSize: 12 }}
                    onClick={() => importChainageFromSurveyCadAction(true)}
                  >
                    Replace from CAD
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }}
              onClick={() => patch({ chainageSegments: [...(form.chainageSegments || []), blankGprChainageSegment()] })}
            >
              + Segment
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          Linear acquisition metadata (swath, chainage range, thickness/depth profile notes). Use PAS128-style line refs (e.g. UMG_LV_B1) — utility and QL are read from the name; length comes from chainage from/to.
        </p>
        <GprLineLengthSummaryCard report={form} linkedSurveyReport={linkedSurveyReport} />
        {(form.chainageSegments || []).map((s, idx) => (
          <div key={s.id} style={{ border: "1px solid var(--color-border-tertiary,#e5e7eb)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              <Field label="Line ref">
                <input
                  style={ss.input}
                  placeholder="e.g. UMG_LV_B1"
                  value={s.lineRef}
                  onChange={(e) => {
                    const chainageSegments = [...form.chainageSegments];
                    chainageSegments[idx] = { ...s, lineRef: e.target.value };
                    patch({ chainageSegments });
                  }}
                />
              </Field>
              <Field label="Swath">
                <input
                  style={ss.input}
                  value={s.swathRef}
                  onChange={(e) => {
                    const chainageSegments = [...form.chainageSegments];
                    chainageSegments[idx] = { ...s, swathRef: e.target.value };
                    patch({ chainageSegments });
                  }}
                />
              </Field>
              <Field label="Chainage from (m)">
                <input
                  style={ss.input}
                  value={s.chainageStartM}
                  onChange={(e) => {
                    const chainageSegments = [...form.chainageSegments];
                    chainageSegments[idx] = { ...s, chainageStartM: e.target.value };
                    patch({ chainageSegments });
                  }}
                />
              </Field>
              <Field label="Chainage to (m)">
                <input
                  style={ss.input}
                  value={s.chainageEndM}
                  onChange={(e) => {
                    const chainageSegments = [...form.chainageSegments];
                    chainageSegments[idx] = { ...s, chainageEndM: e.target.value };
                    patch({ chainageSegments });
                  }}
                />
              </Field>
              <Field label="Thickness / depth (m)">
                <input
                  style={ss.input}
                  value={s.thicknessOrDepthM}
                  onChange={(e) => {
                    const chainageSegments = [...form.chainageSegments];
                    chainageSegments[idx] = { ...s, thicknessOrDepthM: e.target.value };
                    patch({ chainageSegments });
                  }}
                />
              </Field>
              <Field label="Condition band">
                <select
                  style={ss.input}
                  value={s.conditionBand}
                  onChange={(e) => {
                    const chainageSegments = [...form.chainageSegments];
                    chainageSegments[idx] = { ...s, conditionBand: e.target.value };
                    patch({ chainageSegments });
                  }}
                >
                  <option value="">—</option>
                  {CHAINAGE_CONDITION_BANDS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Profile notes">
              <textarea
                style={ss.ta}
                rows={2}
                value={s.profileNotes}
                onChange={(e) => {
                  const chainageSegments = [...form.chainageSegments];
                  chainageSegments[idx] = { ...s, profileNotes: e.target.value };
                  patch({ chainageSegments });
                }}
              />
            </Field>
            <button
              type="button"
              style={{ ...ss.btn, background: "transparent", color: "#b91c1c", fontSize: 12 }}
              onClick={() => patch({ chainageSegments: form.chainageSegments.filter((_, i) => i !== idx) })}
            >
              Remove segment
            </button>
          </div>
        ))}
        <GprChainageChart segments={form.chainageSegments} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, alignSelf: "center", color: "var(--color-text-secondary)" }}>Quick add:</span>
        {ANOMALY_QUICK_TEMPLATES.map((tpl) => (
          <button
            key={tpl.key}
            type="button"
            className="app-gpr-anomaly-chip"
            onClick={() => patchReport((r) => addAnomalyFromTemplate(r, tpl.key))}
          >
            + {tpl.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={ss.sectionHead}>Anomalies</div>
        <button
          type="button"
          style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }}
          onClick={() => patch({ anomalies: [...(form.anomalies || []), blankGprAnomaly()] })}
        >
          + Add anomaly
        </button>
      </div>
      {(form.anomalies || []).map((a, idx) => (
        <div
          key={a.id}
          style={{ border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: 12, marginBottom: 12 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            <Field label="Ref">
              <input
                style={ss.input}
                value={a.ref}
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, ref: e.target.value };
                  patch({ anomalies });
                }}
              />
            </Field>
            <Field label="Type">
              <select
                style={ss.input}
                value={a.anomalyType}
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, anomalyType: e.target.value };
                  patch({ anomalies });
                }}
              >
                {ANOMALY_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Depth (m)">
              <input
                style={ss.input}
                value={a.depthM}
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, depthM: e.target.value };
                  patch({ anomalies });
                }}
              />
            </Field>
            <Field label="Confidence">
              <select
                style={ss.input}
                value={a.confidence}
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, confidence: e.target.value };
                  patch({ anomalies });
                }}
              >
                {ANOMALY_CONFIDENCE.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Interpretation">
            <textarea
              style={ss.ta}
              rows={2}
              value={a.interpretation}
              onChange={(e) => {
                const anomalies = [...form.anomalies];
                anomalies[idx] = { ...a, interpretation: e.target.value };
                patch({ anomalies });
              }}
            />
          </Field>
          <button
            type="button"
            style={{ ...ss.btn, background: "transparent", color: "#b91c1c", fontSize: 12 }}
            onClick={() => patch({ anomalies: form.anomalies.filter((_, i) => i !== idx) })}
          >
            Remove
          </button>
        </div>
      ))}
      <Field label="Findings narrative">
        <textarea
          style={ss.ta}
          rows={6}
          value={form.sections.findings}
          onChange={(e) => patchNested("sections", { findings: e.target.value })}
        />
      </Field>
    </>
  );

  const renderNarrative = () => (
    <>
      <Field label="Foreword">
        <textarea
          style={ss.ta}
          rows={5}
          value={form.sections.foreword}
          onChange={(e) => patchNested("sections", { foreword: e.target.value })}
        />
      </Field>
      {[
        ["executiveSummary", "Executive summary"],
        ["scope", "Scope"],
        ["methodology", "Methodology"],
        ["dataProcessing", "Data processing"],
        ["interpretationCriteria", "Interpretation criteria"],
        ["deliverablesNotes", "Deliverables notes"],
        ["limitations", "Limitations"],
        ["recommendations", "Recommendations"],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <textarea
            style={ss.ta}
            rows={key === "methodology" || key === "interpretationCriteria" ? 8 : 4}
            value={form.sections[key]}
            onChange={(e) => patchNested("sections", { [key]: e.target.value })}
          />
        </Field>
      ))}
      <button type="button" style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C" }} onClick={suggestLimitations}>
        Suggest limitation keys from data
      </button>
      <button
        type="button"
        style={{ ...ss.btn, background: "#f1f5f9", color: "#0C447C", marginLeft: 8 }}
        onClick={() => patchReport((r) => applyGprSmartNarratives(r))}
      >
        Regenerate prebuilt narratives
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginTop: 12 }}>
        {GPR_LIMITATION_RULES.map((rule) => (
          <label key={rule.key} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={(form.limitationKeys || []).includes(rule.key)}
              onChange={() => {
                const set = new Set(form.limitationKeys || []);
                if (set.has(rule.key)) set.delete(rule.key);
                else set.add(rule.key);
                patch({ limitationKeys: [...set] });
              }}
            />
            {rule.label}
          </label>
        ))}
      </div>
    </>
  );

  const renderQa = () => (
    <>
      <GprDeliverableScorecard report={form} />
      <GprProcessingPipeline filters={form.processing?.filters} software={form.processing?.software} />
      <div style={ss.sectionHead}>QA checklist</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
        {GPR_QA_ITEMS.map((item) => (
          <label key={item.key} style={{ display: "flex", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.qaChecklist[item.key]}
              onChange={(e) => patchNested("qaChecklist", { [item.key]: e.target.checked })}
            />
            {item.label}
          </label>
        ))}
      </div>
      <div style={ss.sectionHead}>Processing log (GeoLitix / IQMaps-style)</div>
      <Field label="Processing software">
        <select
          style={ss.input}
          value={form.processing?.software || ""}
          onChange={(e) => patchNested("processing", { software: e.target.value })}
        >
          <option value="">— Select —</option>
          {GPR_SOFTWARE_OPTIONS.map((sw) => (
            <option key={sw} value={sw}>
              {sw}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ overflowX: "auto", marginBottom: 16 }}>
        <table className="app-gpr-filter-table">
          <thead>
            <tr>
              <th>Apply</th>
              <th>Filter</th>
              <th>Parameter</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(form.processing?.filters?.length ? form.processing.filters : PROCESSING_FILTER_CATALOG.map((f) => ({
              key: f.key,
              label: f.label,
              parameter: f.defaultParameter,
              notes: f.defaultNotes,
              applied: f.defaultApplied,
            }))).map((f, idx) => (
              <tr key={f.key || idx}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!f.applied}
                    onChange={(e) => {
                      const filters = [...(form.processing?.filters?.length ? form.processing.filters : PROCESSING_FILTER_CATALOG.map((x) => ({
                        key: x.key,
                        label: x.label,
                        parameter: x.defaultParameter,
                        notes: x.defaultNotes,
                        applied: x.defaultApplied,
                      })))];
                      filters[idx] = { ...filters[idx], applied: e.target.checked };
                      patchNested("processing", { filters });
                    }}
                  />
                </td>
                <td>{f.label}</td>
                <td>
                  <input
                    style={{ ...ss.input, fontSize: 12 }}
                    value={f.parameter || ""}
                    onChange={(e) => {
                      const filters = [...(form.processing?.filters || [])];
                      filters[idx] = { ...filters[idx], parameter: e.target.value };
                      patchNested("processing", { filters });
                    }}
                  />
                </td>
                <td>
                  <input
                    style={{ ...ss.input, fontSize: 12 }}
                    value={f.notes || ""}
                    onChange={(e) => {
                      const filters = [...(form.processing?.filters || [])];
                      filters[idx] = { ...filters[idx], notes: e.target.value };
                      patchNested("processing", { filters });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={ss.sectionHead}>Processing steps applied</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {PROCESSING_STEPS.map((step) => (
          <label key={step.key} style={{ display: "flex", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={(form.processing?.stepsApplied || []).includes(step.key)}
              onChange={() => {
                const set = new Set(form.processing?.stepsApplied || []);
                if (set.has(step.key)) set.delete(step.key);
                else set.add(step.key);
                patchNested("processing", { stepsApplied: [...set] });
              }}
            />
            {step.label}
          </label>
        ))}
      </div>
      <Field label="Processing notes">
        <textarea
          style={ss.ta}
          rows={3}
          value={form.processing?.notes || ""}
          onChange={(e) => patchNested("processing", { notes: e.target.value })}
        />
      </Field>
      <button
        type="button"
        style={{ ...ss.btn, background: "#E6F1FB", color: "#0C447C", marginBottom: 16 }}
        onClick={() => patchReport((r) => syncProcessingNarrative(r))}
      >
        Sync data processing narrative from steps
      </button>
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" style={{ ...ss.btn, background: "#0C447C", color: "#fff" }} disabled={!!busy} onClick={exportPdf}>
          {busy === "pdf" ? "Generating PDF…" : "Download PDF"}
        </button>
        <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0C447C" }} onClick={exportHtml}>
          Export HTML
        </button>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", alignSelf: "center" }}>
          Completeness: {quality.score}%
        </span>
      </div>
    </>
  );

  const renderEditor = () => {
    if (!form) return null;
    const tabContent = {
      setup: renderSetup,
      equipment: renderEquipment,
      ground: renderGround,
      findings: renderFindings,
      narrative: renderNarrative,
      qa: renderQa,
    }[tab];

    return (
      <ModuleOverlay className="app-gpr-module-overlay">
        <div className={`app-survey-report-editor app-gpr-report-editor${livePreviewOpen ? " app-survey-report-editor--split" : ""}`}>
          <GprEditorHero
            form={form}
            project={project}
            onClose={() => setModal(null)}
            onGoToTab={setTab}
            livePreviewOpen={livePreviewOpen}
            onToggleLivePreview={setLivePreviewOpen}
            onMarkFinal={markFinal}
          />
          {smartTips.length ? (
            <div className="app-gpr-smart-tips">
              {smartTips.slice(0, 3).map((tip, i) => (
                <div key={i} className={`app-gpr-smart-tip app-gpr-smart-tip--${tip.level}`}>
                  {tip.text}
                </div>
              ))}
            </div>
          ) : null}
          <div className="app-survey-report-editor__body app-gpr-report-editor__body">
            <div className="app-survey-report-editor__form">
              <div style={ss.tabRow}>
                {TABS.map((t) => {
                  const done = gprTabComplete(form, t.id);
                  return (
                    <button key={t.id} type="button" style={ss.tab(tab === t.id)} onClick={() => setTab(t.id)}>
                      {done ? <span className="app-gpr-tab-dot app-gpr-tab-dot--done" aria-hidden /> : null}
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {tabContent?.()}
            </div>
            <SurveyLivePreviewDock
              open={livePreviewOpen}
              onToggle={setLivePreviewOpen}
              html={previewHtml}
              onPrint={exportPdf}
              height={520}
            />
          </div>
          <div className="app-gpr-editor-footer app-gpr-editor-footer--shortcuts" title="Ctrl+S save · Alt+←/→ tabs · Ctrl+Shift+P preview">
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9" }} onClick={duplicateReport}>
              Duplicate
            </button>
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9" }} onClick={exportHtml}>
              Export HTML
            </button>
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9" }} onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="button" style={{ ...ss.btn, background: "#0C447C", color: "#fff" }} onClick={saveReport}>
              Save report
            </button>
          </div>
        </div>
      </ModuleOverlay>
    );
  };

  return (
    <div className="app-gpr-page-shell">
      <GprWaveBackdrop />
      <PageHero
        title="GPR report"
        subtitle="Prebuilt GPR reports — equipment presets, BGS geology, weather impact, rule-based narratives (offline-ready)."
      />
      <D1ModuleSyncBanner {...sync} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...ss.input, maxWidth: 280 }}
          placeholder="Search ref, title, site…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...ss.input, maxWidth: 140 }} value={listStatus} onChange={(e) => setListStatus(e.target.value)}>
          {GPR_LIST_STATUS_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <select style={{ ...ss.input, maxWidth: 180 }} value={listProject} onChange={(e) => setListProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={groupByProject} onChange={(e) => setGroupByProject(e.target.checked)} />
          Group by project
        </label>
        <button
          type="button"
          style={{ ...ss.btn, background: "#0C447C", color: "#fff" }}
          onClick={() => {
            setTab("setup");
            setModal({ isNew: true, data: blankGprReport({ ref: nextGprRef(reports) }) });
          }}
        >
          + New GPR report
        </button>
      </div>

      <GprListStatsBar summary={listSummary} />

      {!filtered.length ? (
        <EmptyState
          title="No GPR reports yet"
          description="Create a GPR report with prebuilt industry template, equipment presets, BGS ground conditions and weather impact analysis."
          actionLabel="New GPR report"
          onAction={() => setModal({ isNew: true, data: blankGprReport({ ref: nextGprRef(reports) }) })}
        />
      ) : (
        <div className="app-gpr-list">
          {grouped
            ? grouped.map((g) => (
                <div key={g.projectId || "__none__"} className="app-gpr-list-group">
                  <div className="app-gpr-list-group__head">
                    {g.projectName}
                    <span className="app-gpr-list-group__count">{g.reports.length}</span>
                  </div>
                  {g.reports.map((r) => {
                    const p = projects.find((x) => x.id === r.projectId);
                    const enriched = enrichGprListRow(r, p);
                    return (
                      <GprListRow
                        key={r.id}
                        enriched={enriched}
                        onEdit={() => {
                          setTab("setup");
                          setModal({ isNew: false, data: r });
                        }}
                        onDelete={() => setConfirmDelete(r)}
                      />
                    );
                  })}
                </div>
              ))
            : filtered.map((r) => {
                const p = projects.find((x) => x.id === r.projectId);
                const enriched = enrichGprListRow(r, p);
                return (
                  <GprListRow
                    key={r.id}
                    enriched={enriched}
                    onEdit={() => {
                      setTab("setup");
                      setModal({ isNew: false, data: r });
                    }}
                    onDelete={() => setConfirmDelete(r)}
                  />
                );
              })}
        </div>
      )}

      {modal && renderEditor()}

      {lightboxRg ? (
        <GprRadargramLightbox
          radargram={lightboxRg}
          velocityCmNs={form?.velocityModel?.measuredVelocityCmNs || form?.velocityModel?.assumedVelocityCmNs}
          timeWindowNs={form?.acquisition?.timeWindowNs}
          onClose={() => setLightboxRg(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmFinal}
        title="Mark report as final?"
        message="Final reports should be reviewed in live preview. You can still edit later by changing status back to draft."
        confirmLabel="Mark final"
        onCancel={() => setConfirmFinal(false)}
        onConfirm={confirmMarkFinal}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete GPR report?"
        message={`Remove ${confirmDelete?.ref || confirmDelete?.title || "this report"}?`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          pushRecycleBinItem({ type: "gpr_report", label: confirmDelete.ref, payload: confirmDelete });
          persist(reports.filter((r) => r.id !== confirmDelete.id));
          pushAudit({ action: "gpr_report_delete", entity: "gpr_report", detail: confirmDelete.ref });
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
