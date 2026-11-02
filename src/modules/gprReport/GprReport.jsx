import { useSupabaseAuth } from "../../context/SupabaseAuthContext";
import { projectDisplayLabel } from "../../utils/projectDisplayLabel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/gpr-report.css";
import { useD1OrgArraySync } from "../../hooks/useD1OrgArraySync";
import { stripGeoPhotosForD1, stripGprReportsForD1 } from "../../utils/d1SyncPayload";
import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { pushAudit } from "../../utils/auditLog";
import { stampDocumentAuthorship } from "../../utils/documentAuthorship.js";
import { ms } from "../../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import { downloadBlob } from "../../utils/downloadBlob";
import { safeHttpUrl } from "../../utils/safeUrl.js";
import { reviewGprEvidence } from "../../utils/gprEvidenceAiClient.js";
import { appApiUrl } from "../../utils/appApiUrl";
import { siteContextBadgeLabel } from "../../utils/inheritSiteContext";
import PageHero from "../../components/PageHero";
import { D1ModuleSyncBanner } from "../../components/D1ModuleSyncBanner";
import EmptyState from "../../components/EmptyState";
import ModuleOverlay from "../../components/ModuleOverlay";
import ConfirmDialog from "../../components/ConfirmDialog";
import SurveyLivePreviewDock from "../surveyReport/SurveyLivePreviewDock";
import GprEditorHero from "./GprEditorHero";
import GprEquipmentProfileImages from "./GprEquipmentProfileImages";
import GprEditorStepNav from "./GprEditorStepNav";
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
import GprBlockersPanel from "./GprBlockersPanel";
import { applyGprAutofix } from "./gprAutofix";
import { buildGprBlockers, buildGprIssueChecklist } from "./gprReportBlockers";
import { suggestContinuousUtilities } from "./gprNarrativeAutomation.js";
import { pushGprIntoLinkedSurvey } from "../surveyReport/surveyGprBridge";
import { filterGprReports, groupGprReportsByProject, suggestDeliverableFlags, GPR_LIST_STATUS_FILTERS } from "./gprReportListHelpers";
import { consumeWorkspaceNavTarget, peekWorkspaceNavTarget } from "../../utils/workspaceNavContext";
import { countGprGeoPhotos, importGeoPhotosIntoGprReport } from "../../utils/gprGeoIntegrations";
import { deleteGprReport, persistGprReports } from "./gprReportPersistence";
import { liveOrgArrayRows } from "../../utils/d1ArrayMerge";
import {
  ANOMALY_CONFIDENCE,
  ANOMALY_TYPES,
  blankGprAnomaly,
  blankGprAnomalyFigure,
  GPR_ANOMALY_FIGURE_LIMIT,
  GPR_ANOMALY_FIGURE_ROLES,
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
import { useGprPreviewHtml } from "./useGprPreviewHtml";
import GprLineLengthSummaryCard from "./GprLineLengthSummaryCard.jsx";
import GprCadImportCard from "./GprCadImportCard.jsx";
import { importGprCadFile } from "./gprCadImport.js";
import { downloadGprReportPdf } from "./gprReportPdf";
import { downloadGprReportWord } from "./gprReportWord";
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
  upsertGprReportInList,
} from "./gprReportHelpers";
import { gprTabComplete, GPR_EDITOR_TABS } from "./gprReportEditorNav";
import { applyGprSmartNarratives,
  applyPrebuiltGprPack,
  fetchEnvironmentalIntoReport,
  fetchWaterIntoReport,
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
import { applyGprFindingsDraft } from "./gprNarrativeAutomation.js";
import { applyIndustryGprTemplate } from "./gprReportTemplateContext";
import GprPreSurveyCard from "./GprPreSurveyCard";
import { applyGprStartHereCapture, captureGprStartHere, blankGprSitePhoto, isIndoorGprSurvey } from "./gprPreSurvey";
import { compressImageFile } from "../../utils/geoPhotoUtils";
import { lookupSitePostcode } from "../../utils/siteAddressLookup.js";
import { reverseUkPostcode } from "../../utils/postcodeLookup.js";
import { getOrgSettings } from "../../utils/orgSettingsStorage";
import {
  britishNationalGridToWgs84,
  normaliseWhat3Words,
  parseBritishNationalGrid,
  wgs84ToBritishNationalGrid,
} from "../../utils/britishNationalGrid.js";
import { listUtilityMappingClients, utilityMappingClientLogoUrl } from "../../utils/utilityMappingClients.js";
import GprThemePicker from "./GprThemePicker.jsx";
import { gprThemeCssVariables } from "./gprVisualTheme.js";
import GprEvidencePanel from "./GprEvidencePanel.jsx";
import GprImageAnnotator from "./GprImageAnnotator.jsx";
import { buildGprEvidenceReviewPayload, mergeGprEvidenceReview } from "./gprEvidence.js";
import { clearGprEditorSession, getGprEditorScope, readGprEditorSession, writeGprEditorSession } from "./gprEditorSession.js";

const STORAGE_KEY = "gpr_reports";

const ss = {
  ...ms,
  ta: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #64748b",
    borderRadius: 8,
    fontSize: 16,
    background: "#fff",
    color: "#0f172a",
    fontFamily: "DM Sans,sans-serif",
    boxSizing: "border-box",
    resize: "vertical",
    lineHeight: 1.5,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #64748b",
    borderRadius: 8,
    fontSize: 16,
    boxSizing: "border-box",
    minHeight: 44,
    background: "#fff",
    color: "#0f172a",
  },
  sectionHead: {
    fontSize: 12,
    fontWeight: 800,
    color: "#1e3a5f",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "18px 0 10px",
  },
  tabRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 16,
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: 10,
  },
  tab: (active) => ({
    padding: "10px 14px",
    minHeight: 44,
    borderRadius: 6,
    border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    background: active ? "#ccfbf1" : "#fff",
    color: active ? "#115e59" : "#334155",
    fontFamily: "DM Sans,sans-serif",
    touchAction: "manipulation",
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
    <label className="app-gpr-field">
      <div className="app-gpr-field__label">{label}</div>
      {children}
    </label>
  );
}

function GprEquipmentProfileCard({ preset }) {
  if (!preset || preset.key === "custom") return null;
  const frequencyLabel = preset.frequencyRangeMhz ? `${preset.frequencyRangeMhz} MHz sweep` : `${preset.antennaFrequencyMhz} MHz`;
  const facts = preset.techHighlights?.length
    ? preset.techHighlights
    : [
        `${preset.antennaFrequencyMhz} MHz`,
        `${preset.channels} channel${preset.channels === 1 ? "" : "s"}`,
        preset.processingSoftware,
      ].filter(Boolean);

  return (
    <section className="app-gpr-equipment-profile" aria-label={`${preset.manufacturer} ${preset.model} technical profile`}>
      <GprEquipmentProfileImages key={preset.key} preset={preset} />
      <div className="app-gpr-equipment-profile__body">
        <p className="app-gpr-equipment-profile__eyebrow">Selected equipment</p>
        <h3>{preset.manufacturer} {preset.model}</h3>
        <div className="app-gpr-equipment-profile__metrics">
          <span><strong>{frequencyLabel}</strong></span>
          <span><strong>{preset.channels}</strong> channel{preset.channels === 1 ? "" : "s"}</span>
          <span><strong>{preset.defaultVelocityCmNs}</strong> cm/ns default</span>
        </div>
        <p className="app-gpr-equipment-profile__configuration">{preset.configuration}</p>
        <ul>
          {facts.map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
        <div className="app-gpr-equipment-profile__footer">
          {preset.processingSoftware ? <span>Software: {preset.processingSoftware}</span> : <span>Software: set per mobilisation</span>}
          {preset.sourceUrl ? (
            <a href={preset.sourceUrl} target="_blank" rel="noopener noreferrer">Official product information ↗</a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function GprReport() {
  useApp();
  const { user } = useSupabaseAuth();
  const scope = getGprEditorScope(user?.id || "anonymous");
  return <ScopedGprReport key={scope} scope={scope} />;
}

function ScopedGprReport({ scope }) {
  const { dataRefreshTick } = useApp();
  const { pushToast } = useToast();
  const [reports, setReports] = useState(() => load(STORAGE_KEY, []));
  const [projects, setProjects] = useState(() => load("mysafeops_projects", []));
  const [geoPhotos, setGeoPhotos] = useState(() => load("geo_photos", []));
  const [modal, setModal] = useState(() => {
    const restored = readGprEditorSession(scope);
    return restored ? { isNew: Boolean(restored.isNew), data: restored.data } : null;
  });
  const editorOpen = Boolean(modal);
  const openReportId = modal?.data?.id;
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [tab, setTab] = useState(() => readGprEditorSession(scope)?.tab || "setup");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [livePreviewOpen, setLivePreviewOpen] = useState(() => {
    try {
      return typeof window !== "undefined" && window.matchMedia("(min-width: 1100px) and (pointer: fine)").matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(min-width: 1100px) and (pointer: fine)");
    const onChange = (e) => {
      if (!e.matches) setLivePreviewOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  const [depthCalcNs, setDepthCalcNs] = useState("");
  const [lightboxRg, setLightboxRg] = useState(null);
  const [imageEdit, setImageEdit] = useState(null);
  const [listStatus, setListStatus] = useState("all");
  const [listProject, setListProject] = useState("");
  const [groupByProject, setGroupByProject] = useState(true);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [cadBusy, setCadBusy] = useState(false);

  const { d1Hydrating: d1RepH, d1OutboxPending: d1RepO } = useD1OrgArraySync({
    storageKey: STORAGE_KEY,
    namespace: STORAGE_KEY,
    value: reports,
    setValue: setReports,
    load,
    save,
    serializeForSync: stripGprReportsForD1,
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

  const surveyReports = useMemo(() => load("survey_reports", []), [dataRefreshTick]);
  const liveReports = useMemo(() => liveOrgArrayRows(reports), [reports]);
  const listSummary = useMemo(() => summarizeGprReportList(liveReports), [liveReports]);

  useEffect(() => {
    setReports(load(STORAGE_KEY, []));
    setProjects(load("mysafeops_projects", []));
    setGeoPhotos(load("geo_photos", []));
  }, [dataRefreshTick]);

  const persist = useCallback((next) => {
    const saved = persistGprReports(scope, next);
    if (!saved) return false;
    setReports(saved);
    return true;
  }, [scope]);

  useEffect(() => {
    if (scope !== getGprEditorScope()) return;
    const t = pendingNavigation || peekWorkspaceNavTarget();
    if (!t || t.viewId !== "gpr-report") return;
    if (editorOpen) {
      if (!pendingNavigation) {
        // Keep deferred navigation inside this scoped component, never in the
        // shared target slot where another organisation could consume it.
        consumeWorkspaceNavTarget();
        if ((t.reportId && t.reportId !== openReportId) || (!t.reportId && t.projectId)) setPendingNavigation(t);
      }
      return;
    }
    const finishNavigation = () => {
      if (!pendingNavigation) consumeWorkspaceNavTarget();
      setPendingNavigation(null);
    };
    if (t.reportId) {
      const found = load(STORAGE_KEY, []).find((r) => r.id === t.reportId && !r.deletedAt);
      if (!found) {
        if (!d1Hydrating) { finishNavigation(); pushToast({ type: "error", message: "The requested GPR report is no longer available in this workspace." }); }
        return;
      }
      finishNavigation();
      setTab("setup");
      setModal({ data: found, isNew: false });
      return;
    }
    if (t.projectId) {
      const p = load("mysafeops_projects", []).find((x) => x.id === t.projectId && !x.deletedAt);
      if (!p) {
        if (!d1Hydrating) { finishNavigation(); pushToast({ type: "error", message: "The requested site is no longer available. Choose another site." }); }
        return;
      }
      finishNavigation();
      const ref = nextGprRef(reports);
      const base = prefillGprFromProject(blankGprReport({ ref }), p);
      setTab("setup");
      setModal({ data: base, isNew: true });
    }
  }, [reports, projects, editorOpen, openReportId, pendingNavigation, d1Hydrating, pushToast, scope]);

  const filtered = useMemo(
    () => filterGprReports(liveReports, { search, status: listStatus, projectId: listProject }),
    [liveReports, search, listStatus, listProject]
  );

  const grouped = useMemo(
    () => (groupByProject ? groupGprReportsByProject(filtered, projects) : null),
    [filtered, projects, groupByProject]
  );

  const form = modal?.data;
  const orgSettings = getOrgSettings();
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

  const { html: previewHtml, pending: previewPending } = useGprPreviewHtml(form, gprPrintExtras, {
    active: Boolean(form) && livePreviewOpen,
    debounceMs: 500,
  });

  const quality = form ? gprReportQuality(form) : { score: 0, missing: [] };
  const smartTips = useMemo(
    () => (form ? gprSmartTips(form, project, linkedSurveyReport) : []),
    [form, project, linkedSurveyReport]
  );

  const formRef = useRef(form);
  const modalRef = useRef(modal);
  const dirtyRef = useRef(Boolean(readGprEditorSession(scope)));
  formRef.current = form;
  modalRef.current = modal;

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const flushEditorToStorage = useCallback(() => {
    const current = formRef.current;
    const m = modalRef.current;
    if (scope !== getGprEditorScope()) return false;
    if (!current?.id || !m || !dirtyRef.current) return true;
    writeGprEditorSession({ ...m, data: current, tab }, scope);
    const normalized = stampDocumentAuthorship(normalizeGprReport(current), {
      isCreate: Boolean(m.isNew) || !current.createdById,
    });
    if (!persist((prev) => upsertGprReportInList(prev, normalized))) return false;
    dirtyRef.current = false;
    if (m.isNew) {
      setModal((prev) => (prev ? { ...prev, isNew: false, data: { ...prev.data, createdById: prev.data?.createdById || normalized.createdById } } : prev));
    }
    return true;
  }, [persist, scope, tab]);

  const closeEditor = useCallback(() => {
    if (!flushEditorToStorage()) {
      pushToast({ type: "error", title: "Report not saved", message: "Your draft remains open. Retry saving before closing." });
      return;
    }
    clearGprEditorSession(scope);
    setModal(null);
  }, [flushEditorToStorage, pushToast, scope]);

  const patch = (partial) => {
    if (!form) return;
    markDirty();
    setModal({
      ...modal,
      data: normalizeGprReport({ ...form, ...partial, updatedAt: new Date().toISOString() }),
    });
  };

  const patchReport = (updater) => {
    if (!form) return;
    markDirty();
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
    if (!form || scope !== getGprEditorScope()) return;
    dirtyRef.current = true;
    writeGprEditorSession({ ...modal, tab }, scope);
    const normalized = stampDocumentAuthorship(normalizeGprReport(form), {
      isCreate: Boolean(modal.isNew) || !form.createdById,
    });
    if (!persist((prev) => upsertGprReportInList(prev, normalized))) {
      pushToast({ type: "error", title: "Report not saved", message: "Storage could not save your changes. Your draft remains open for retry." });
      return;
    }

    // Bidirectional sync: push anomalies into linked / same-project survey report.
    try {
      const surveys = load("survey_reports", []);
      const { reports: nextSurveys, updated } = pushGprIntoLinkedSurvey(normalized, surveys);
      if (updated) {
        if (save("survey_reports", nextSurveys) !== true) throw new Error("Survey save failed");
        pushToast({
          type: "success",
          title: "Synced to survey",
          message: `GPR anomalies merged into ${updated.ref || "linked survey report"}.`,
          durationMs: 2800,
        });
      }
    } catch {
      pushToast({ type: "error", title: "Survey sync failed", message: "The GPR report was saved, but the linked survey was not. Retry Save report to sync it." });
    }

    pushAudit({ action: modal.isNew ? "gpr_report_create" : "gpr_report_update", entity: "gpr_report", detail: normalized.ref });
    dirtyRef.current = false;
    setModal({ ...modal, isNew: false, data: normalized });
    pushToast({ type: "success", title: "Saved", message: "GPR report stays open.", durationMs: 2200 });
  };

  useEffect(() => {
    if (!modal?.data?.id) {
      clearGprEditorSession(scope);
      return;
    }
    writeGprEditorSession({ isNew: Boolean(modal.isNew), data: modal.data, tab }, scope);
  }, [modal, tab, scope]);

  useEffect(() => {
    if (!form) return undefined;
    const t = window.setTimeout(() => flushEditorToStorage(), 600);
    return () => window.clearTimeout(t);
  }, [form, flushEditorToStorage]);

  useEffect(() => {
    if (!modal) return undefined;
    const onHide = () => {
      if (document.visibilityState === "hidden") flushEditorToStorage();
    };
    const onPageHide = () => flushEditorToStorage();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flushEditorToStorage();
    };
  }, [modal, flushEditorToStorage]);

  const handleGprAutofix = (fixId) => {
    if (!form) return;
    const next = applyGprAutofix(fixId, form);
    if (next) {
      markDirty();
      setModal({ ...modal, data: normalizeGprReport(next) });
    }
  };

  const handleGprCadUpload = async (e) => {
    const file = e.target?.files?.[0];
    e.target.value = "";
    if (!file || !form) return;
    setCadBusy(true);
    try {
      const next = await importGprCadFile(form, file);
      markDirty();
      setModal({ ...modal, data: normalizeGprReport(next) });
      const cad = next.gprCadImport;
      pushToast({
        type: "success",
        title: "CAD model-space analysed",
        message: `GPR: ${cad?.gprLayers?.segmentCount || 0} · UMG→B1: ${cad?.umgB1Upgrades?.segmentCount || 0} · No-access hatches: ${cad?.hatches?.constraintHatchCount || 0} · Anomalies: ${cad?.anomalies?.count || 0}`,
        durationMs: 4200,
      });
      pushAudit({ action: "gpr_report_cad_import", entity: "gpr_report", detail: file.name });
    } catch (err) {
      pushToast({
        type: "error",
        title: "CAD import failed",
        message: err?.message || "Could not parse DXF (model space).",
      });
    } finally {
      setCadBusy(false);
    }
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
      processingSoftware: preset.processingSoftware || equipment[eqIndex].processingSoftware,
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
      markDirty();
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
      markDirty();
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
      markDirty();
      setModal({ ...modal, data: normalizeGprReport(applyGprSmartNarratives(next)) });
    } catch (e) {
      alert(e.message || "Geology lookup failed — set a project map pin or postcode");
    } finally {
      setBusy("");
    }
  };

  const fetchWeather = async () => {
    if (!form) return;
    setBusy("weather");
    try {
      let next = await fetchEnvironmentalIntoReport(form, project);
      try {
        next = await fetchWaterIntoReport(next, project);
      } catch {
        /* weather still applies if the water desk-check is unavailable */
      }
      markDirty();
      setModal({ ...modal, data: normalizeGprReport(next) });
    } catch (e) {
      alert(e.message || "Weather lookup failed");
    } finally {
      setBusy("");
    }
  };

  const runStartHere = async () => {
    if (!form) return;
    setBusy("start");
    try {
      const capture = await captureGprStartHere({ project, report: form });
      const next = applyGprStartHereCapture(form, capture);
      markDirty();
      setModal({ ...modal, data: normalizeGprReport(next) });
      if (capture.gpsError && capture.gpsSource !== "device") {
        pushToast({
          type: "info",
          title: "GPS used a fallback",
          message: capture.gpsError,
          durationMs: 3200,
        });
      } else {
        pushToast({
          type: "success",
          title: "Start here stamped",
          message: isIndoorGprSurvey(form) ? "GPS and indoor survey context are on this report." : "GPS and optional live weather are on this report.",
          durationMs: 2400,
        });
      }
    } catch (e) {
      pushToast({
        type: "error",
        title: "Start here failed",
        message: e.message || "Could not capture GPS or weather.",
      });
    } finally {
      setBusy("");
    }
  };

  const addPreSurveyPhoto = async (files) => {
    const list = [...(files || [])].filter(Boolean);
    if (!list.length || !form) return;
    try {
      const added = [];
      for (const file of list) {
        const dataUrl = await compressImageFile(file, { maxWidth: 1280, quality: 0.78 });
        added.push(
          blankGprSitePhoto({
            dataUrl,
            fileName: file.name,
            capturedAt: new Date().toISOString(),
            caption: "Site photo",
          })
        );
      }
      patchReport((r) => ({
        ...r,
        preSurvey: { ...r.preSurvey, photos: [...(r.preSurvey?.photos || []), ...added] },
      }));
    } catch (e) {
      pushToast({ type: "error", title: "Photo failed", message: e.message || "Could not add photo." });
    }
  };

  const patchPreSurvey = (nextPs) => {
    const firstDate = (nextPs.surveyDates || []).filter(Boolean)[0];
    const obs = form.groundConditions?.siteObservations || {};
    const surfaceType =
      nextPs.surfaceKeys?.length === 1
        ? nextPs.surfaceKeys[0]
        : nextPs.surfaceKeys?.length > 1
          ? "mixed"
          : obs.surfaceType;
    patchReport((r) => ({
      ...r,
      preSurvey: nextPs,
      surveyDate: firstDate || r.surveyDate,
      groundConditions: {
        ...r.groundConditions,
        siteObservations: {
          ...obs,
          surfaceType: surfaceType || obs.surfaceType,
          moisture: nextPs.moisture || obs.moisture,
        },
      },
    }));
  };

  const suggestLimitations = () => {
    if (!form) return;
    const keys = suggestGprLimitationKeys(form);
    patch({ limitationKeys: keys });
  };

  const markFinal = () => {
    if (!form) return;
    const { blockers } = buildGprBlockers(form, { linkedSurveyReport, project });
    const critical = blockers.filter((item) => item.severity === "block");
    if (critical.length) {
      setTab(critical[0].tab || "qa");
      pushToast({
        type: "error",
        title: "Final issue blocked",
        message: `${critical.length} must-fix item${critical.length === 1 ? "" : "s"}: ${critical.map((item) => item.label).join(" · ")}`,
        durationMs: 6500,
      });
      return;
    }
    setConfirmFinal(true);
  };

  const runEvidenceReview = async () => {
    if (!form) return;
    setBusy("evidence-ai");
    try {
      const result = await reviewGprEvidence(buildGprEvidenceReviewPayload(form));
      patchReport((report) => mergeGprEvidenceReview(report, result));
      pushToast({
        type: "success",
        title: "Evidence classified",
        message: `${result.assessments?.length || 0} verified source(s) reviewed. No uncited site facts were generated.`,
        durationMs: 4200,
      });
    } catch (e) {
      pushToast({ type: "error", title: "AI review blocked safely", message: e.message || "No report content was changed." });
    } finally {
      setBusy("");
    }
  };

  const confirmMarkFinal = () => {
    if (!form) return;
    patch({
      status: "final",
      issuePurpose: "Final issue",
      finalisedAt: new Date().toISOString(),
    });
    setConfirmFinal(false);
  };

  const exportHtml = () => {
    if (!form) return;
    const html = buildGprReportHtml(form, gprPrintExtras);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    if (!downloadBlob(blob, `${form.ref || "gpr-report"}.html`)) {
      pushToast({ type: "error", title: "Download blocked", message: "Allow downloads for this site and try again." });
      return;
    }
    pushAudit({ action: "gpr_report_html", entity: "gpr_report", detail: form.ref });
    pushToast({ type: "success", title: "HTML downloaded", message: `${form.ref || "gpr-report"}.html` });
  };

  const syncDeliverablesFromEvidence = () => {
    patch({ deliverables: suggestDeliverableFlags(form) });
  };

  const addPlanFigureFile = async (file) => {
    if (!file || !form) return;
    try {
      const dataUrl = await compressImageFile(file, { maxWidth: 1600, quality: 0.82 });
      patchReport((r) => {
        const planFigures = [
          ...(r.planFigures || []),
          blankGprPlanFigure({
            label: file.name.replace(/\.[^.]+$/, ""),
            dataUrl,
            fileName: `${String(file.name || "plan").replace(/\.[^.]+$/, "")}.jpg`,
            capturedAt: new Date().toISOString(),
          }),
        ];
        return {
          ...r,
          planFigures,
          deliverables: suggestDeliverableFlags({ ...r, planFigures }),
        };
      });
    } catch (e) {
      pushToast({ type: "error", title: "Photo failed", message: e?.message || "Could not add plan image." });
    }
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
    pushToast({ type: "info", title: "Generating PDF…", message: "Building A4 GPR report pages.", durationMs: 4000 });
    try {
      const result = await downloadGprReportPdf(form, gprPrintExtras);
      pushToast({
        type: "success",
        title: "PDF downloaded",
        message: result?.fileName ? `${result.fileName}${result.pages ? ` · ${result.pages} page(s)` : ""}` : "GPR report PDF saved.",
      });
    } catch (e) {
      pushToast({ type: "error", title: "PDF export failed", message: e?.message || "Could not generate PDF." });
    } finally {
      setBusy("");
    }
  };

  const exportWord = async () => {
    if (!form) return;
    setBusy("word");
    try {
      const result = await downloadGprReportWord(form, gprPrintExtras);
      pushAudit({ action: "gpr_report_word", entity: "gpr_report", detail: form.ref });
      pushToast({ type: "success", title: "Word downloaded", message: `${result.fileName} · ${result.imageCount} image(s)` });
    } catch (e) {
      pushToast({ type: "error", title: "Word export failed", message: e?.message || "Could not generate Word document." });
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
    if (!downloadBlob(blob, `${form.ref || "gpr-anomalies"}.geojson`)) {
      pushToast({ type: "error", title: "Download blocked", message: "Allow downloads for this site and try again." });
    }
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

  const addAcquisitionScreenshots = async (files) => {
    const list = [...(files || [])].filter(Boolean);
    if (!list.length || !form) return;
    const existing = form.acquisition?.screenshots || [];
    const room = Math.max(0, 6 - existing.length);
    if (!room) {
      pushToast({ type: "error", title: "Screenshot limit", message: "Up to 6 acquisition screenshots." });
      return;
    }
    try {
      const added = [];
      for (const file of list.slice(0, room)) {
        const dataUrl = await compressImageFile(file, { maxWidth: 1600, quality: 0.82 });
        added.push({
          id: `acq_${Date.now()}_${added.length}`,
          dataUrl,
          caption: String(file.name || "Acquisition screenshot").replace(/\.[^.]+$/, "").slice(0, 160),
        });
      }
      patchNested("acquisition", { screenshots: [...existing, ...added] });
    } catch (e) {
      pushToast({ type: "error", title: "Screenshot failed", message: e?.message || "Could not add screenshot." });
    }
  };

  const addRadargramFile = async (file) => {
    if (!file || !form) return;
    try {
      const dataUrl = await compressImageFile(file, { maxWidth: 1600, quality: 0.82 });
      patchReport((r) => ({
        ...r,
        radargrams: [
          ...(r.radargrams || []),
          {
            id: `rg_${Date.now()}`,
            label: file.name.replace(/\.[^.]+$/, ""),
            lineRef: "",
            dataUrl,
            fileName: `${String(file.name || "radargram").replace(/\.[^.]+$/, "")}.jpg`,
            capturedAt: new Date().toISOString(),
            notes: "",
          },
        ],
      }));
    } catch (e) {
      pushToast({ type: "error", title: "Photo failed", message: e?.message || "Could not add radargram." });
    }
  };

  const renderSetup = () => (
    <>
      <GprPreSurveyCard
        preSurvey={form.preSurvey}
        busy={busy}
        surveyor={form.surveyor}
        onStartHere={runStartHere}
        onChange={patchPreSurvey}
        onAddPhoto={addPreSurveyPhoto}
        onBeforePickPhoto={flushEditorToStorage}
        onRemovePhoto={(id) =>
          patchPreSurvey({
            ...form.preSurvey,
            photos: (form.preSurvey?.photos || []).filter((p) => p.id !== id),
          })
        }
        onAnnotatePhoto={(photo) => setImageEdit({ image: photo, save: (updated) => patchReport((r) => ({ ...r, preSurvey: { ...r.preSurvey, photos: (r.preSurvey?.photos || []).map((item) => item.id === photo.id ? { ...item, ...updated } : item) } })) })}
      />
      <Field label="Report ref">
        <input style={ss.input} value={form.ref} onChange={(e) => patch({ ref: e.target.value })} />
      </Field>
      <Field label="Title">
        <input style={ss.input} value={form.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Project (optional)">
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
          <option value="">No project — GPR only</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{projectDisplayLabel(p)}</option>
          ))}
        </select>
      </Field>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--color-text-secondary,#64748b)" }}>
        A GPR-only job does not need a project or RAMS. Type the client, address and postcode here.
      </p>
      <Field label="Client">
        <input style={ss.input} value={form.client || ""} placeholder="Barnes Fernandez" onChange={(e) => patch({ client: e.target.value })} />
      </Field>
      <Field label="Site address">
        <input style={ss.input} value={form.siteAddress} placeholder="Street, town" onChange={(e) => patch({ siteAddress: e.target.value })} />
        {siteContextBadgeLabel(form) ? (
          <div style={{ marginTop: 6, fontSize: 11, color: "#27500A", background: "#EAF3DE", display: "inline-block", padding: "2px 8px", borderRadius: 999 }}>
            Site context: {siteContextBadgeLabel(form)}
          </div>
        ) : null}
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
        <Field label="Postcode">
          <input style={ss.input} value={form.postcode || ""} placeholder="B1 1AA" onChange={(e) => patch({ postcode: e.target.value })} />
        </Field>
        <Field label="Latitude">
          <input style={ss.input} value={form.siteLat ?? ""} placeholder="52.48" onChange={(e) => patch({ siteLat: e.target.value })} />
        </Field>
        <Field label="Longitude">
          <input style={ss.input} value={form.siteLng ?? ""} placeholder="-1.90" onChange={(e) => patch({ siteLng: e.target.value })} />
        </Field>
      </div>
      <button
        type="button"
        style={{ ...ss.btn, background: "#e0f2fe", color: "#075985", marginBottom: 12 }}
        disabled={!!busy}
        onClick={async () => {
          setBusy("postcode");
          try {
            const hit = await lookupSitePostcode(form.postcode || form.siteAddress);
            if (!hit?.lat) throw new Error("Postcode not found");
            patch({
              postcode: hit.postcode || form.postcode,
              siteLat: hit.lat,
              siteLng: hit.lng,
              siteAddress: form.siteAddress || [hit.adminDistrict, hit.postcode].filter(Boolean).join(", "),
              ...(() => {
                const grid = wgs84ToBritishNationalGrid(hit.lat, hit.lng);
                return grid ? { osgbEasting: grid.easting, osgbNorthing: grid.northing, gridRef: grid.gridRef } : {};
              })(),
            });
          } catch (e) {
            alert(e.message || "Postcode lookup failed");
          } finally {
            setBusy("");
          }
        }}
      >
        {busy === "postcode" ? "Looking up…" : "Look up postcode"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12 }}>
        <Field label="OSGB easting">
          <input style={ss.input} value={form.osgbEasting ?? ""} placeholder="530262" onChange={(e) => patch({ osgbEasting: e.target.value })} />
        </Field>
        <Field label="OSGB northing">
          <input style={ss.input} value={form.osgbNorthing ?? ""} placeholder="179553" onChange={(e) => patch({ osgbNorthing: e.target.value })} />
        </Field>
        <Field label="Grid reference">
          <input style={ss.input} value={form.gridRef || ""} placeholder="TQ 30262 79553" onChange={(e) => patch({ gridRef: e.target.value })} />
        </Field>
      </div>
      <button
        type="button"
        style={{ ...ss.btn, background: "#f1f5f9", color: "#0f172a", marginBottom: 12 }}
        disabled={!!busy}
        onClick={async () => {
          const parsed = parseBritishNationalGrid(form.gridRef || `${form.osgbEasting || ""} ${form.osgbNorthing || ""}`);
          if (!parsed) {
            alert("Enter a grid reference such as TQ 30262 79553, or an easting and northing.");
            return;
          }
          const wgs = britishNationalGridToWgs84(parsed.easting, parsed.northing);
          if (!wgs) {
            alert("That grid point is outside the National Grid.");
            return;
          }
          const grid = wgs84ToBritishNationalGrid(wgs.lat, wgs.lng);
          setBusy("osgb");
          try {
            const hit = await reverseUkPostcode(wgs.lat, wgs.lng);
            let next = {
              ...form,
              osgbEasting: Math.round(parsed.easting),
              osgbNorthing: Math.round(parsed.northing),
              gridRef: grid?.gridRef || form.gridRef,
              siteLat: Number(wgs.lat.toFixed(6)),
              siteLng: Number(wgs.lng.toFixed(6)),
              postcode: hit?.postcode || form.postcode,
              siteAddress: form.siteAddress || [hit?.adminDistrict, hit?.postcode].filter(Boolean).join(", "),
            };
            try {
              next = await fetchEnvironmentalIntoReport(next, project);
            } catch (e) {
              alert(e.message || "Weather lookup failed. The grid point is still saved.");
            }
            try {
              next = await fetchWaterIntoReport(next, project);
            } catch {
              /* coordinates and weather stay if the water check is unavailable */
            }
            markDirty();
            setModal({ ...modal, data: normalizeGprReport(next) });
          } finally {
            setBusy("");
          }
        }}
      >
        {busy === "osgb" ? "Reading postcode…" : "Use OSGB as the site point"}
      </button>
      <Field label="What3Words">
        <input style={ss.input} value={form.what3words || ""} placeholder="filled.count.soap" onChange={(e) => patch({ what3words: e.target.value })} />
      </Field>
      <button
        type="button"
        style={{ ...ss.btn, background: "#f1f5f9", color: "#0f172a", marginBottom: 12 }}
        disabled={!!busy}
        onClick={async () => {
          const words = normaliseWhat3Words(form.what3words);
          if (!words) {
            alert("Enter three words, for example filled.count.soap");
            return;
          }
          setBusy("w3w");
          try {
            const response = await fetch(appApiUrl("/api/what3words"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ words }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              patch({ what3words: words });
              throw new Error(payload.error === "what3words_not_configured"
                ? "Words saved. Add WHAT3WORDS_API_KEY on the server to turn them into a map point."
                : "Those words were not found.");
            }
            const grid = wgs84ToBritishNationalGrid(payload.lat, payload.lng);
            patch({
              what3words: payload.words || words,
              siteLat: Number(payload.lat.toFixed(6)),
              siteLng: Number(payload.lng.toFixed(6)),
              ...(grid ? { osgbEasting: grid.easting, osgbNorthing: grid.northing, gridRef: grid.gridRef } : {}),
            });
          } catch (e) {
            alert(e.message || "What3Words lookup failed");
          } finally {
            setBusy("");
          }
        }}
      >
        {busy === "w3w" ? "Looking up…" : "Use What3Words as the site point"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
        <Field label="Survey date">
          <input
            type="date"
            style={ss.input}
            value={form.surveyDate}
            onChange={(e) => patch({ surveyDate: e.target.value })}
          />
        </Field>
        <Field label="Surveyor (optional)">
          <input style={ss.input} value={form.surveyor} placeholder="Name, N/A or Unknown" onChange={(e) => patch({ surveyor: e.target.value })} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {["N/A", "Unknown", ""].map((value) => (
              <button key={value || "blank"} type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0f172a" }} onClick={() => patch({ surveyor: value })}>
                {value || "Leave blank"}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12 }}>
        <Field label="Status">
          <select
            style={ss.input}
            value={form.status}
            onChange={(e) => {
              if (e.target.value === "final") {
                markFinal();
                return;
              }
              patch({
                status: "draft",
                issuePurpose: form.issuePurpose === "Final issue" ? "For review" : form.issuePurpose,
                finalisedAt: null,
              });
            }}
          >
            <option value="draft">Draft</option>
            <option value="final">Final</option>
          </select>
        </Field>
        <Field label="Revision">
          <input style={ss.input} value={form.revision || ""} placeholder="P01 / C01" onChange={(e) => patch({ revision: e.target.value })} />
        </Field>
        <Field label="Issue purpose">
          <select style={ss.input} value={form.issuePurpose || "For information"} onChange={(e) => patch({ issuePurpose: e.target.value })}>
            <option value="For information">For information</option>
            <option value="For review">For review</option>
            <option value="For coordination">For coordination</option>
            <option value="Final issue">Final issue</option>
          </select>
        </Field>
      </div>
      <GprThemePicker
        value={form.visualTheme}
        organisation={orgSettings}
        onChange={(visualTheme) => patch({ visualTheme })}
      />
      <div style={{ marginTop: 12 }}>
        <div style={ss.sectionHead}>Cover logos</div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--color-text-secondary,#64748b)" }}>
          Our logo, the client logo only (private job such as Barnes Fernandez), or both (Utility Mapping working for Birmingham City Council).
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["own", "Our logo only"],
            ["client", "Client logo only"],
            ["both", "Both logos"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              style={{
                ...ss.btn,
                background: (form.coverBranding?.mode || "own") === mode ? "#0f766e" : "#f1f5f9",
                color: (form.coverBranding?.mode || "own") === mode ? "#fff" : "#0f172a",
              }}
              onClick={() => patch({ coverBranding: { ...(form.coverBranding || {}), mode } })}
            >
              {label}
            </button>
          ))}
        </div>
        {(form.coverBranding?.mode === "client" || form.coverBranding?.mode === "both") && (
          <div style={{ display: "grid", gap: 8, marginTop: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label="Client name on cover">
              <input
                style={ss.input}
                value={form.coverBranding?.clientName || ""}
                placeholder="Barnes Fernandez"
                onChange={(e) => patch({ coverBranding: { ...(form.coverBranding || {}), clientName: e.target.value } })}
              />
            </Field>
            {listUtilityMappingClients().length > 0 && (
              <Field label="Saved client logo">
                <select
                  style={ss.input}
                  value={form.coverBranding?.clientCode || ""}
                  onChange={(e) => {
                    const clientCode = e.target.value;
                    const picked = listUtilityMappingClients().find((c) => c.code === clientCode);
                    patch({
                      coverBranding: {
                        ...(form.coverBranding || {}),
                        clientCode,
                        clientName: form.coverBranding?.clientName || picked?.name || "",
                      },
                    });
                  }}
                >
                  <option value="">Upload instead</option>
                  {listUtilityMappingClients().map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Client logo file">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const dataUrl = await compressImageFile(file, { maxWidth: 640, quality: 0.82 });
                  patch({ coverBranding: { ...(form.coverBranding || {}), clientLogoDataUrl: dataUrl, clientCode: "" } });
                }}
              />
            </Field>
            {(form.coverBranding?.clientLogoDataUrl || utilityMappingClientLogoUrl(form.coverBranding?.clientCode)) && (
              <img
                alt={form.coverBranding?.clientName || "Client logo"}
                src={form.coverBranding?.clientLogoDataUrl || utilityMappingClientLogoUrl(form.coverBranding?.clientCode)}
                style={{ height: 48, objectFit: "contain", alignSelf: "end" }}
              />
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" style={{ ...ss.btn, ...ss.btnP }} disabled={!!busy} onClick={runPrebuiltPack}>
          {busy === "prebuilt" ? "Applying…" : "Apply prebuilt pack"}
        </button>
        <button type="button" style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }} disabled={!!busy} onClick={applyGenericTemplate}>
          Template only
        </button>
        <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e" }} disabled={!!busy} onClick={runSmartFill}>
          {busy === "smart" ? "Filling…" : "BGS + optional weather + narratives"}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-secondary,#64748b)", lineHeight: 1.45 }}>
        Prebuilt pack loads the generic industry template, fetches optional BGS geology and outdoor weather, then fills report sections from rule-based narratives — no AI required.
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
        <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e", marginTop: 8 }} onClick={syncDeliverablesFromEvidence}>
          Sync deliverables from evidence
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={ss.sectionHead}>Report sign-off</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
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
    const selectedPreset = GPR_EQUIPMENT_PRESETS.find((preset) => preset.key === eq.presetKey);
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
        <GprEquipmentProfileCard preset={selectedPreset} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
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
        <div
          tabIndex={0}
          onPaste={(e) => {
            const fromFiles = [...(e.clipboardData?.files || [])];
            const fromItems = [...(e.clipboardData?.items || [])]
              .filter((item) => item.type?.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter(Boolean);
            const images = fromFiles.length ? fromFiles : fromItems;
            if (!images.length) return;
            e.preventDefault();
            addAcquisitionScreenshots(images);
          }}
          style={{ marginTop: 12, padding: 10, border: "1px dashed #99f6e4", borderRadius: 8 }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <label
              style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e", cursor: "pointer" }}
              onPointerDown={flushEditorToStorage}
            >
              + Acquisition screenshot
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  addAcquisitionScreenshots(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Upload or click this box and paste (Ctrl+V) a screenshot from the acquisition software. Up to 6. The whole image prints, nothing cropped.
            </span>
          </div>
          {(form.acquisition.screenshots || []).length ? (
            <div className="app-gpr-radargram-grid">
              {(form.acquisition.screenshots || []).map((shot, idx) => (
                <div key={shot.id || idx} className="app-gpr-radargram-thumb">
                  <img src={shot.dataUrl} alt="" style={{ objectFit: "contain", background: "#f8fafc" }} />
                  <button type="button" className="app-gpr-annotate-btn" onClick={() => setImageEdit({ image: shot, save: (updated) => patchReport((r) => ({ ...r, acquisition: { ...r.acquisition, screenshots: (r.acquisition?.screenshots || []).map((item) => item.id === shot.id ? { ...item, ...updated } : item) } })) })}>✎ Annotate image</button>
                  <input
                    style={{ ...ss.input, fontSize: 11, marginTop: 4 }}
                    value={shot.caption || ""}
                    placeholder="Caption"
                    onChange={(e) => {
                      const screenshots = [...(form.acquisition.screenshots || [])];
                      screenshots[idx] = { ...shot, caption: e.target.value };
                      patchNested("acquisition", { screenshots });
                    }}
                  />
                  <button
                    type="button"
                    className="app-gpr-list-delete"
                    onClick={() =>
                      patchNested("acquisition", {
                        screenshots: (form.acquisition.screenshots || []).filter((_, i) => i !== idx),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
              No acquisition screenshot yet.
            </p>
          )}
        </div>

        <div style={ss.sectionHead}>Velocity model</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
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
      <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={form.includeGeology} onChange={(e) => patch({ includeGeology: e.target.checked })} />
          Include BGS geology in this report (optional)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={form.includeHistoricalEvidence} onChange={(e) => patch({ includeHistoricalEvidence: e.target.checked })} />
          Include historic photos and records (optional)
        </label>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          Turn either option off to omit its desk-study section from the report. Saved evidence is retained for later use.
        </span>
      </div>
      {form.includeGeology ? (<>
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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0", alignItems: "center" }}>
        <button type="button" style={{ ...ss.btn, ...ss.btnP }} disabled={!!busy} onClick={fetchGeology}>
          {busy === "geology" ? "Fetching BGS…" : "Fetch BGS geology (50k)"}
        </button>
        {!isIndoorGprSurvey(form) ? <button type="button" style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }} disabled={!!busy} onClick={fetchWeather}>
          {busy === "weather" ? "Fetching weather…" : "Fetch optional weather for survey date"}
        </button> : null}
        <button
          type="button"
          style={{ ...ss.btn, background: "#e0f2fe", color: "#075985" }}
          disabled={!!busy}
          onClick={async () => {
            setBusy("water");
            try {
              const next = await fetchWaterIntoReport(form, project);
              markDirty();
              setModal({ ...modal, data: normalizeGprReport(next) });
            } catch (e) {
              alert(e.message || "Water check failed");
            } finally {
              setBusy("");
            }
          }}
        >
          {busy === "water" ? "Checking water…" : "Check nearby water"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0 }}>
        DigMap <strong>50k</strong> bedrock / superficial / artificial + nearby borehole index (625k fallback). Desk study only — not SI soils.
      </p>
      {project && !(project.lat && project.lng) ? (
        <p style={{ fontSize: 12, color: "#b45309", marginTop: 0 }}>
          No project map pin — lookup may use a postcode centroid (less accurate). Set lat/lng on the project.
        </p>
      ) : null}
      {form.groundConditions?.accuracyWarning ? (
        <p style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", padding: 8, borderRadius: 8 }}>
          {form.groundConditions.accuracyWarning}
        </p>
      ) : null}
      {form.groundConditions?.fetchedAt ? (
        <div style={{ fontSize: 12, color: "#0f766e", marginBottom: 12 }}>
          Last fetch {new Date(form.groundConditions.fetchedAt).toLocaleString("en-GB")}
          {form.groundConditions.scale ? ` · ${form.groundConditions.scale}` : ""}
          {form.groundConditions.coordSource ? ` · ${form.groundConditions.coordSource}` : ""}
          {(form.groundConditions.nearbyBoreholes || []).length
            ? ` · ${form.groundConditions.nearbyBoreholes.length} nearby boreholes`
            : ""}
        </div>
      ) : null}
      {(form.groundConditions?.nearbyBoreholes || []).length ? (
        <div style={{ marginBottom: 14, overflowX: "auto" }}>
          <div style={ss.sectionHead}>Nearby BGS borehole index</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e2e8f0" }}>Ref</th>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e2e8f0" }}>Distance</th>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e2e8f0" }}>Length</th>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e2e8f0" }}>Precision</th>
              </tr>
            </thead>
            <tbody>
              {(form.groundConditions.nearbyBoreholes || []).slice(0, 6).map((b) => (
                <tr key={b.reference || b.name}>
                  <td style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>
                    {b.scanUrl && safeHttpUrl(b.scanUrl) ? (
                      <a href={safeHttpUrl(b.scanUrl)} target="_blank" rel="noopener noreferrer">
                        {b.reference || b.name || "Scan"}
                      </a>
                    ) : (
                      b.reference || b.name || "—"
                    )}
                  </td>
                  <td style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>
                    {b.distanceM != null ? `${b.distanceM} m` : "—"}
                  </td>
                  <td style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>
                    {b.lengthM != null ? `${b.lengthM} m` : "—"}
                  </td>
                  <td style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>{b.precision || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      </>) : null}

      <div style={ss.sectionHead}>Site observations</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
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

      {form.includeGeology && form.groundConditions?.narrative ? (
        <details style={{ marginTop: 12, fontSize: 13 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Full BGS narrative</summary>
          <p style={{ marginTop: 8, lineHeight: 1.5 }}>{form.groundConditions.narrative}</p>
        </details>
      ) : null}
      {form.includeHistoricalEvidence ? <GprEvidencePanel
        report={form}
        project={project}
        busy={busy === "evidence-ai"}
        onChange={(historicalEvidence) => patch({ historicalEvidence, evidenceReview: { ...form.evidenceReview, assessments: [] } })}
        onRunAi={runEvidenceReview}
        onAnnotateImage={(item) => setImageEdit({ image: { dataUrl: item.imageDataUrl, originalDataUrl: item.originalImageDataUrl, annotations: item.annotations }, save: (updated) => patchReport((r) => ({ ...r, historicalEvidence: (r.historicalEvidence || []).map((entry) => entry.id === item.id ? { ...entry, imageDataUrl: updated.dataUrl, originalImageDataUrl: updated.originalDataUrl, annotations: updated.annotations } : entry) })) })}
        inputStyle={ss.input}
        textAreaStyle={ss.ta}
        buttonStyle={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e" }}
      /> : null}
    </>
  );

  const renderFindings = () => (
    <>
      <div className="app-gpr-radargram-panel">
        <div style={ss.sectionHead}>Radargrams & scan images</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <label
            style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e", cursor: "pointer" }}
            onPointerDown={flushEditorToStorage}
          >
            + Upload image
            <input
              type="file"
              accept="image/*,.heic,.heif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addRadargramFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {form.projectId && geoPhotoCount > 0 ? (
            <button type="button" style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }} onClick={importGeoPhotos}>
              Import {geoPhotoCount} geo-photo(s)
            </button>
          ) : null}
          <button
            type="button"
            style={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e" }}
            onClick={() => patchReport((r) => autoNumberAnomalies(r))}
          >
            Auto-number anomalies
          </button>
          {(form.anomalies || []).length ? (
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e" }} onClick={exportAnomaliesGeoJson}>
              Export anomalies JSON
            </button>
          ) : null}
        </div>
        {(form.radargrams || []).length ? (
          <div className="app-gpr-radargram-grid">
            {(form.radargrams || []).map((rg, idx) => (
              <div key={rg.id} className="app-gpr-radargram-thumb" onClick={() => setLightboxRg(rg)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setLightboxRg(rg)}>
                <img src={rg.dataUrl} alt="" />
                <button type="button" className="app-gpr-annotate-btn" onClick={(event) => { event.stopPropagation(); setImageEdit({ image: rg, save: (updated) => patchReport((r) => ({ ...r, radargrams: (r.radargrams || []).map((item) => item.id === rg.id ? { ...item, ...updated } : item) })) }); }}>✎ Annotate image</button>
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
          <label
            style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e", cursor: "pointer" }}
            onPointerDown={flushEditorToStorage}
          >
            + Upload plan / CAD
            <input
              type="file"
              accept="image/*,.heic,.heif"
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
                <button type="button" className="app-gpr-annotate-btn" onClick={() => setImageEdit({ image: pf, save: (updated) => patchReport((r) => ({ ...r, planFigures: (r.planFigures || []).map((item) => item.id === pf.id ? { ...item, ...updated } : item) })) })}>✎ Annotate image</button>
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
            style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }}
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
              <Field label="Readable depth (m)">
                <input
                  style={ss.input}
                  value={p.readableDepthM || ""}
                  placeholder="Deepest readable signal"
                  onChange={(e) => {
                    const scanPanels = [...form.scanPanels];
                    scanPanels[idx] = { ...p, readableDepthM: e.target.value };
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
      <GprCadImportCard
        gprCadImport={form.gprCadImport}
        anomalies={form.anomalies}
        cadBusy={cadBusy}
        onUpload={handleGprCadUpload}
        onClear={() => patch({ gprCadImport: null })}
        ss={ss}
      />

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
              style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }}
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
      {suggestContinuousUtilities(form.anomalies).map((hint) => (
        <p key={hint} style={{ margin: "0 0 8px", fontSize: 13, color: "#075985" }}>{hint}</p>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={ss.sectionHead}>Anomalies</div>
        <button
          type="button"
          style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }}
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
            <Field label="Line">
              <input
                style={ss.input}
                value={a.lineOrGrid || ""}
                placeholder="Line 2"
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, lineOrGrid: e.target.value };
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            <Field label="Archive frame">
              <select
                style={ss.input}
                value={a.archiveCorrelation || "not_checked"}
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, archiveCorrelation: e.target.value };
                  patch({ anomalies });
                }}
              >
                <option value="not_checked">Not checked</option>
                <option value="correlates">Correlates with kept frame</option>
                <option value="does_not_correlate">Does not correlate</option>
              </select>
            </Field>
            <Field label="Frame date">
              <select
                style={ss.input}
                value={a.archiveFrameDate || ""}
                onChange={(e) => {
                  const anomalies = [...form.anomalies];
                  anomalies[idx] = { ...a, archiveFrameDate: e.target.value };
                  patch({ anomalies });
                }}
              >
                <option value="">No frame selected</option>
                {(form.historicalEvidence || []).filter((item) => item.sourceDate).map((item) => (
                  <option key={item.id} value={item.sourceDate}>{item.sourceDate} — {item.title || item.sourceName || "archive"}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="app-gpr-finding-photos">
            {(a.figures || []).map((figure) => (
              <div key={figure.id} className="app-gpr-finding-photos__item">
                {figure.dataUrl ? <img src={figure.dataUrl} alt="" /> : null}
                {figure.dataUrl ? <button type="button" className="app-gpr-annotate-btn" onClick={() => setImageEdit({ image: figure, enablePins: true, save: (updated) => patchReport((r) => ({ ...r, anomalies: (r.anomalies || []).map((item) => item.id === a.id ? { ...item, figures: (item.figures || []).map((entry) => entry.id === figure.id ? { ...entry, ...updated } : entry) } : item) })) })}>✎ Annotate / add pins</button> : null}
                {(figure.annotations || []).filter((shape) => shape.type === "pin").map((shape) => <div key={shape.number} className="app-gpr-finding-pin-note"><b>{shape.number}</b><span>{shape.text}</span></div>)}
                <select
                  style={ss.input}
                  value={figure.role}
                  onChange={(e) => {
                    const anomalies = [...form.anomalies];
                    anomalies[idx] = {
                      ...a,
                      figures: a.figures.map((item) => (item.id === figure.id ? { ...item, role: e.target.value } : item)),
                    };
                    patch({ anomalies });
                  }}
                >
                  {GPR_ANOMALY_FIGURE_ROLES.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const anomalies = [...form.anomalies];
                    anomalies[idx] = { ...a, figures: a.figures.filter((item) => item.id !== figure.id) };
                    patch({ anomalies });
                  }}
                >
                  Remove photo
                </button>
              </div>
            ))}
            {(a.figures || []).length < GPR_ANOMALY_FIGURE_LIMIT ? (
              <label className="app-gpr-finding-photos__add">
                Add GPR, CAD or archive photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const dataUrl = await compressImageFile(file, { maxWidth: 1200, quality: 0.72 });
                    const used = new Set((a.figures || []).map((item) => item.role));
                    const role = GPR_ANOMALY_FIGURE_ROLES.find((item) => !used.has(item.key))?.key || "gpr";
                    const anomalies = [...form.anomalies];
                    anomalies[idx] = {
                      ...a,
                      figures: [...(a.figures || []), blankGprAnomalyFigure({ role, dataUrl, fileName: file.name })].slice(0, GPR_ANOMALY_FIGURE_LIMIT),
                    };
                    patch({ anomalies });
                  }}
                />
              </label>
            ) : null}
          </div>
          <button
            type="button"
            style={{ ...ss.btn, background: "transparent", color: "#b91c1c", fontSize: 12 }}
            onClick={() => patch({ anomalies: form.anomalies.filter((_, i) => i !== idx) })}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e", marginBottom: 12 }}
        onClick={() => patchReport((r) => applyGprFindingsDraft(r))}
      >
        Apply findings, summary and limitations draft
      </button>
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
      <button type="button" style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e" }} onClick={suggestLimitations}>
        Suggest limitation keys from data
      </button>
      <button
        type="button"
        style={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e", marginLeft: 8 }}
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
        style={{ ...ss.btn, background: "#ccfbf1", color: "#0f766e", marginBottom: 16 }}
        onClick={() => patchReport((r) => syncProcessingNarrative(r))}
      >
        Sync data processing narrative from steps
      </button>
      {buildGprIssueChecklist(form).length ? (
        <div style={{ marginTop: 16, fontSize: 13, color: "#9a3412" }}>
          <strong>Before PDF</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {buildGprIssueChecklist(form).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" style={ss.btnP} disabled={!!busy} onClick={exportPdf}>
          {busy === "pdf" ? "Generating PDF…" : "Download PDF"}
        </button>
        <button type="button" style={{ ...ss.btn, background: "#dbeafe", color: "#1e40af" }} disabled={!!busy} onClick={exportWord}>
          {busy === "word" ? "Generating Word…" : "Download editable Word"}
        </button>
        <button type="button" style={{ ...ss.btn, background: "#f1f5f9", color: "#0f766e" }} onClick={exportHtml}>
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
        <div
          className={`app-survey-report-editor app-gpr-report-editor${livePreviewOpen ? " app-survey-report-editor--split" : ""}`}
          style={gprThemeCssVariables(form, orgSettings)}
        >
          {pendingNavigation && <div role="alert" className="app-gpr-navigation-notice">
            <strong>A GPR draft is already open</strong>
            <p>You are editing {form.title || form.ref || "an unfinished report"}. Your requested destination is {projects.find((p) => p.id === pendingNavigation.projectId)?.name || reports.find((r) => r.id === pendingNavigation.reportId)?.title || "another report"}. Save this draft before continuing, or keep editing it.</p>
            <div>
              <button type="button" style={ss.btnP} onClick={closeEditor}>Save draft and continue</button>
              <button type="button" style={ss.btn} onClick={() => setPendingNavigation(null)}>Keep editing this draft</button>
            </div>
          </div>}
          <GprEditorHero
            form={form}
            project={project}
            onClose={closeEditor}
            onGoToTab={setTab}
            livePreviewOpen={livePreviewOpen}
            onToggleLivePreview={setLivePreviewOpen}
            onMarkFinal={markFinal}
          />
          <GprEditorStepNav tab={tab} report={form} onTabChange={setTab} tabs={TABS} />
          {smartTips.length ? (
            <div className="app-gpr-smart-tips">
              {smartTips.slice(0, 3).map((tip, i) => (
                <div key={i} className={`app-gpr-smart-tip app-gpr-smart-tip--${tip.level}`}>
                  {tip.text}
                </div>
              ))}
            </div>
          ) : null}
          <GprBlockersPanel
            report={form}
            linkedSurveyReport={linkedSurveyReport}
            onGoToTab={setTab}
            onAutofix={handleGprAutofix}
          />
          <div className="app-gpr-guide">
            <strong>Next</strong>
            <span>Setup the ref, fetch BGS on Ground, add GPR and CAD photos on Findings, then apply the findings draft and open preview.</span>
            <button type="button" onClick={() => setTab(gprTabComplete(form, "setup") ? (gprTabComplete(form, "ground") ? "findings" : "ground") : "setup")}>
              {gprTabComplete(form, "setup") ? (gprTabComplete(form, "ground") ? "Open Findings" : "Open Ground") : "Open Setup"}
            </button>
          </div>
          <div className="app-survey-report-editor__body app-gpr-report-editor__body">
            <div className="app-survey-report-editor__form app-gpr-editor-form">
              {tabContent?.()}
              <div className="app-gpr-section-actions" aria-label="Move between report sections">
                <button type="button" style={ss.btn} disabled={tab === TABS[0].id}
                  onClick={() => setTab(TABS[Math.max(0, TABS.findIndex((t) => t.id === tab) - 1)].id)}>
                  ← Previous section
                </button>
                <span>Section {TABS.findIndex((t) => t.id === tab) + 1} of {TABS.length}</span>
                <button type="button" style={{ ...ss.btn, ...ss.btnP }} disabled={tab === TABS.at(-1).id}
                  onClick={() => setTab(TABS[Math.min(TABS.length - 1, TABS.findIndex((t) => t.id === tab) + 1)].id)}>
                  Next section →
                </button>
              </div>
            </div>
            <SurveyLivePreviewDock
              open={livePreviewOpen}
              onToggle={setLivePreviewOpen}
              html={previewHtml}
              onPrint={exportPdf}
              height={520}
              pending={previewPending}
            />
          </div>
          <div className="app-gpr-editor-footer app-gpr-editor-footer--shortcuts" title="Ctrl+S save · Alt+←/→ tabs · Ctrl+Shift+P preview">
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9" }} onClick={duplicateReport}>
              Duplicate
            </button>
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9" }} onClick={exportHtml}>
              Export HTML
            </button>
            <button type="button" style={{ ...ss.btn, background: "#dbeafe", color: "#1e40af" }} disabled={!!busy} onClick={exportWord}>
              {busy === "word" ? "Generating Word…" : "Download Word"}
            </button>
            <button type="button" style={{ ...ss.btn, background: "#f1f5f9" }} onClick={closeEditor}>
              Close
            </button>
            <button type="button" style={{ ...ss.btn, ...ss.btnP }} onClick={saveReport}>
              Save report
            </button>
          </div>
        </div>
      </ModuleOverlay>
    );
  };

  return (
    <div className="app-document-module app-document-module--premium app-gpr-page-shell">
      <GprWaveBackdrop />
      <PageHero
        badgeText="GPR"
        title="GPR report"
        lead="Prebuilt GPR reports — Start here records survey context and GPS, with optional outdoor weather, equipment presets and rule-based narratives."
        suppressRegisterPdf
      />
      <D1ModuleSyncBanner d1Hydrating={d1Hydrating} d1OutboxPending={d1OutboxPending} scopeLabel="GPR reports" />
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
            <option key={p.id} value={p.id}>{projectDisplayLabel(p)}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={groupByProject} onChange={(e) => setGroupByProject(e.target.checked)} />
          Group by project
        </label>
        <button
          type="button"
          style={{ ...ss.btn, ...ss.btnP }}
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
          description="Create a GPR report with equipment presets, optional BGS ground conditions and outdoor weather context."
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
      {imageEdit ? <GprImageAnnotator image={imageEdit.image} enablePins={imageEdit.enablePins} onSave={imageEdit.save} onClose={() => setImageEdit(null)} /> : null}

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
          const next = deleteGprReport(scope, confirmDelete);
          if (!next) {
            pushToast({ type: "error", title: "Report not deleted", message: "Could not safely save the deletion and recovery copy. Please retry." });
            return;
          }
          setReports(next);
          pushAudit({ action: "gpr_report_delete", entity: "gpr_report", detail: confirmDelete.ref });
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
