import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ms } from "../../utils/moduleStyles";
import PageHero from "../../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import { getTemplateForType, saveOrgTemplate } from "./permitTemplateCatalog";
import { evaluatePermitCompliance } from "./permitComplianceChecks";
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
import { consumeWorkspaceNavTarget } from "../../utils/workspaceNavContext";
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
import { buildPermitEmailRecipients, parseManualEmails, sendPermitNotificationEmail } from "../../utils/permitNotifications";
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
import { buildPermitSlaQueue, buildPermitDigest } from "./permitAutomationSla";
import { buildPermitRiskInsights } from "./permitRiskIntelligence";

const genId = () => `ptw_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

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

const permitPersonLabel = (w) => `${w.name || ""}${w.role ? ` — ${w.role}` : ""}`.trim();
const PERMIT_PREFS_KEY = "permit_form_prefs";

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
const AUDIT_ACTION_OPTIONS = ["created", "updated", "status_changed", "deleted"];
const PERMIT_SAVED_VIEWS_KEY = "permit_saved_views_v1";

function auditActionLabel(row) {
  if (!row) return "Updated";
  if (row.action === "created") return "Created permit";
  if (row.action === "deleted") return "Deleted permit";
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
function PermitForm({ permit, onSave, onClose, recentPermit, allPermits = [] }) {
  const projects = load("mysafeops_projects",[]);
  const workers = load("mysafeops_workers",[]);
  const ramsDocs = load("rams_builder_docs", []);
  const permitPrefs = load(PERMIT_PREFS_KEY, {});
  const org = (() => { try { return JSON.parse(localStorage.getItem("mysafeops_org_settings")||"{}"); } catch { return {}; } })();
  const flags = isFeatureEnabled("permits_template_builder_v2");

  const defaultType = permit?.type || "hot_work";
  const [type, setType] = useState(defaultType);
  const def = PERMIT_TYPES[type] || PERMIT_TYPES.general;
  const typeMeta = getTypeComplianceMeta(type);
  const initChecklist = (items) => Object.fromEntries((items || []).map((item) => [item.id, false]));
  const template = getTemplateForType(defaultType, PERMIT_TYPES);
  const initialChecklistItems = permit
    ? normalizeChecklistItems(defaultType, permit, checklistStringsForType(defaultType))
    : normalizeChecklistItems(defaultType, { checklistItems: template.checklistItems }, checklistStringsForType(defaultType));

  const blank = {
    id:genId(), type, projectId:"", location:"",
    description:"", issuedTo:"", issuedBy: org.defaultLeadEngineer || permitPrefs.issuedBy || "",
    linkedRamsId: "",
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now()+8*3600000).toISOString(),
    checklistItems: initialChecklistItems,
    checklist: initChecklist(initialChecklistItems),
    extraFields:{}, status:"active",
    templateVersion: 1,
    matrixVersion: "uk-v2",
    templateId: template.templateId || `permit.${defaultType}.default`,
    legalContentOwner: "HSE / Legal Reviewer",
    createdAt: new Date().toISOString(),
    notes:"",
    authorisedByRole: "",
    briefingConfirmedAt: "",
    evidenceNotes: "",
    evidencePhotoUrl: "",
    evidencePhotoStoragePath: "",
  };

  const [form, setForm] = useState(() => {
    if (!permit) return blank;
    const permitType = permit.type || type;
    const checklistItems = normalizeChecklistItems(permitType, permit, checklistStringsForType(permitType));
    return {
      ...permit,
      type: permitType,
      checklistItems,
      checklist: normalizeChecklistState(permit.checklist, checklistItems),
      templateVersion: permit.templateVersion || 1,
      matrixVersion: permit.matrixVersion || "uk-v2",
      templateId: permit.templateId || `permit.${permitType}.default`,
      legalContentOwner: permit.legalContentOwner || "HSE / Legal Reviewer",
      authorisedByRole: permit.authorisedByRole || "",
      briefingConfirmedAt: permit.briefingConfirmedAt || "",
      evidenceNotes: permit.evidenceNotes || "",
      evidencePhotoUrl: permit.evidencePhotoUrl || "",
      evidencePhotoStoragePath: permit.evidencePhotoStoragePath || "",
    };
  });
  const [evidenceUploadBusy, setEvidenceUploadBusy] = useState(false);
  const [prefillNote, setPrefillNote] = useState("");
  const [templateEditMode, setTemplateEditMode] = useState(false);
  const [issuedToPick, setIssuedToPick] = useState(() => (permit ? matchWorkerPick(permit.issuedTo, workers) : ""));
  const [issuedByPick, setIssuedByPick] = useState(() => {
    if (permit) return matchWorkerPick(permit.issuedBy, workers);
    return matchWorkerPick(org.defaultLeadEngineer || "", workers);
  });
  const [wizardStep, setWizardStep] = useState(1);
  const baselineRef = useRef(null);
  const formSnapshotStr = useCallback(
    () =>
      JSON.stringify({
        type,
        form,
        issuedToPick,
        issuedByPick,
        wizardStep,
      }),
    [type, form, issuedToPick, issuedByPick, wizardStep]
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
  const tryClose = () => {
    if (dirty && !window.confirm("Discard unsaved permit changes?")) return;
    onClose();
  };
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setExtra = (k,v) => setForm(f=>({...f,extraFields:{...f.extraFields,[k]:v}}));
  const setCheck = (id,v) => setForm(f=>({...f,checklist:{...f.checklist,[id]:v}}));

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

  const saveCurrentAsOrgTemplate = () => {
    const nextTemplate = saveOrgTemplate(type, {
      checklistItems: trimmedChecklistItems,
    }, PERMIT_TYPES);
    setForm((f) => ({
      ...f,
      templateId: nextTemplate.templateId,
      templateVersion: nextTemplate.templateVersion,
      matrixVersion: nextTemplate.matrixVersion || "uk-v1",
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
      ...f,
      ...next,
      type: nextType,
      checklistItems: nextItems,
      checklist: normalizeChecklistState(next.checklist, nextItems),
      extraFields: { ...(f.extraFields || {}), ...(next.extraFields || {}) },
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
  };

  const prefillFromRecent = () => {
    const source = clonePermitForPrefill(recentPermit, type);
    if (!source) return;
    applyPrefill(source, "Prefilled from latest permit");
  };

  const onIssuedToSelect = (e) => {
    const v = e.target.value;
    if (v === "") { setIssuedToPick(""); set("issuedTo", ""); return; }
    if (v === "__custom__") { setIssuedToPick("__custom__"); return; }
    const w = workers.find((x) => x.id === v);
    if (w) { setIssuedToPick(v); set("issuedTo", permitPersonLabel(w) || w.name); }
  };
  const onIssuedBySelect = (e) => {
    const v = e.target.value;
    if (v === "") { setIssuedByPick(""); set("issuedBy", ""); return; }
    if (v === "__custom__") { setIssuedByPick("__custom__"); return; }
    const w = workers.find((x) => x.id === v);
    if (w) { setIssuedByPick(v); set("issuedBy", permitPersonLabel(w) || w.name); }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    const nextTemplate = getTemplateForType(newType, PERMIT_TYPES);
    const items = normalizeChecklistItems(newType, { checklistItems: nextTemplate.checklistItems }, checklistStringsForType(newType));
    setForm(f=>({...f, type:newType, checklistItems:items, checklist:initChecklist(items)}));
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
  const quality = runPermitQualityGates(form);
  const compliance = evaluatePermitCompliance({ ...form, type, endDateTime: form.endDateTime }, trimmedChecklistItems);
  const legalReady = compliance.legalReady;
  const canIssue = Boolean(quality.ok && trimmedChecklistItems.length > 0 && legalReady);
  const permitCopilotHints = useMemo(() => {
    const hints = [];
    if (!form.location) hints.push("Add a precise work location before approval.");
    if (!form.issuedBy || !form.issuedTo) hints.push("Complete issuer + recipient to improve traceability.");
    if ((form.extraFields?.fieldCaptureEntries || []).length === 0) hints.push("Capture at least one field data entry for evidence quality.");
    if ((compliance.missingCriticalRegulatory || []).length > 0) {
      hints.push("Regulatory hard-stop: complete critical compliance evidence before activation.");
    }
    if (!form.linkedRamsId) hints.push("Link RAMS document to strengthen permit context.");
    return hints.slice(0, 5);
  }, [form, compliance.missingCriticalRegulatory]);

  const buildPermitPayload = (status) => {
    const safeItems = trimmedChecklistItems.length ? trimmedChecklistItems : createDefaultChecklistItems(type, checklistStringsForType(type));
    const safeChecklist = normalizeChecklistState(form.checklist, safeItems);
    return {
      ...form,
      type,
      status,
      checklistItems: safeItems,
      checklist: safeChecklist,
      templateVersion: form.templateVersion || 1,
      matrixVersion: form.matrixVersion || "uk-v2",
      templateId: form.templateId || `permit.${type}.default`,
      legalContentOwner: form.legalContentOwner || "HSE / Legal Reviewer",
      complianceReviewedAt: form.complianceReviewedAt || null,
      endDateTime: form.endDateTime || form.expiryDate || "",
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

  const step1Valid = !!(String(form.description || "").trim() && String(form.location || "").trim());
  const step2Valid = trimmedChecklistItems.length > 0;
  const step3Valid = quality.ok;
  const stepNextEnabled =
    wizardStep === 1 ? step1Valid : wizardStep === 2 ? step2Valid : wizardStep === 3 ? step3Valid : true;

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
              {Object.entries(PERMIT_TYPES).map(([k,v])=>(
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

        {/* Step 1 — scope */}
        {wizardStep === 1 && (
        <>
        {permit && (
          <div style={{ marginBottom:12, fontSize:13, padding:"8px 10px", background:def.bg, borderRadius:8, border:`1px solid ${def.color}`, color:def.color }}>
            <strong>Permit type:</strong> {def.label}
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={ss.lbl}>Description of work</label>
            <textarea value={form.description||""} onChange={e=>set("description",e.target.value)} rows={2}
              placeholder="Describe the specific work to be carried out under this permit…" style={{ ...ss.ta, minHeight:50 }} />
          </div>
          <div>
            <label style={ss.lbl}>Location</label>
            <input value={form.location||""} onChange={e=>set("location",e.target.value)} placeholder="Where will work be carried out?" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Project</label>
            <select
              value={form.projectId||""}
              onChange={e=>{
                const nextId = e.target.value;
                set("projectId", nextId);
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
          <div>
            <label style={ss.lbl}>Linked RAMS (optional)</label>
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
          </div>
        </div>
        </>
        )}

        {/* Step 3 — people, timing, authorisation */}
        {wizardStep === 3 && (
        <>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
          <div>
            <label style={ss.lbl}>Permit issued to</label>
            {workers.length > 0 ? (
              <>
                <select value={issuedToPick} onChange={onIssuedToSelect} style={{ ...ss.inp, marginBottom: issuedToPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {permitPersonLabel(w) || w.name}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name)</option>
                </select>
                {issuedToPick === "__custom__" && (
                  <input value={form.issuedTo || ""} onChange={(e) => set("issuedTo", e.target.value)} placeholder="Name of person receiving permit" style={ss.inp} />
                )}
              </>
            ) : (
              <input value={form.issuedTo || ""} onChange={(e) => set("issuedTo", e.target.value)} placeholder="Name of person receiving permit" style={ss.inp} />
            )}
          </div>
          <div>
            <label style={ss.lbl}>Issued by (authorised person)</label>
            {workers.length > 0 ? (
              <>
                <select value={issuedByPick} onChange={onIssuedBySelect} style={{ ...ss.inp, marginBottom: issuedByPick === "__custom__" ? 8 : 0 }}>
                  <option value="">— Select from my workers —</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {permitPersonLabel(w) || w.name}
                    </option>
                  ))}
                  <option value="__custom__">Other (type name)</option>
                </select>
                {issuedByPick === "__custom__" && (
                  <input value={form.issuedBy || ""} onChange={(e) => set("issuedBy", e.target.value)} placeholder="Authorised person name" style={ss.inp} />
                )}
              </>
            ) : (
              <input value={form.issuedBy || ""} onChange={(e) => set("issuedBy", e.target.value)} placeholder="Authorised person name" style={ss.inp} />
            )}
          </div>
          <div>
            <label style={ss.lbl}>Start date / time</label>
            <input type="datetime-local" value={toLocalInput(form.startDateTime)} onChange={e=>set("startDateTime",new Date(e.target.value).toISOString())} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Expiry date / time</label>
            <input type="datetime-local" value={toLocalInput(form.endDateTime)} onChange={e=>set("endDateTime",new Date(e.target.value).toISOString())} style={ss.inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={ss.lbl}>Authorising role / competency reference</label>
            <input value={form.authorisedByRole||""} onChange={(e)=>set("authorisedByRole",e.target.value)} placeholder="e.g. Competent person (electrical), AP lifting" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Briefing confirmed at</label>
            <input type="datetime-local" value={toLocalInput(form.briefingConfirmedAt)} onChange={(e)=>set("briefingConfirmedAt", e.target.value ? new Date(e.target.value).toISOString() : "")} style={ss.inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={ss.lbl}>Site evidence photo URL (optional)</label>
            <input value={form.evidencePhotoUrl||""} onChange={(e)=>set("evidencePhotoUrl",e.target.value)} placeholder="https://…" style={ss.inp} />
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
          <div style={{ gridColumn: "1/-1" }}>
            <label style={ss.lbl}>Evidence notes</label>
            <textarea value={form.evidenceNotes||""} onChange={(e)=>set("evidenceNotes",e.target.value)} rows={2} placeholder="Toolbox talk reference, barrier ID, etc." style={{ ...ss.ta, minHeight:44 }} />
          </div>
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
          {(form.evidencePhotoUrl || form.evidencePhotoStoragePath) && (
            <div style={{ gridColumn: "1/-1" }}>
              <PermitEvidenceImage storagePath={form.evidencePhotoStoragePath} srcUrl={form.evidencePhotoUrl} />
            </div>
          )}
        </div>
        {simopsHits.length > 0 && (
          <div style={{ marginBottom:12, fontSize:12, padding:"8px 10px", borderRadius:8, background:"#FCEBEB", border:"1px solid #f5c7c7", color:"#791F1F" }}>
            <strong>SIMOPS / overlap:</strong> {simopsHits.length} other permit(s) share this location with an overlapping validity window.
            <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
              {simopsHits.slice(0,6).map((p) => (
                <li key={p.id}>{(PERMIT_TYPES[p.type]||PERMIT_TYPES.general).label} · {fmtDateTime(p.startDateTime)} → {fmtDateTime(permitEndIso(p))}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <label style={ss.lbl}>Additional conditions / notes</label>
          <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} rows={2}
            placeholder="Any specific conditions, restrictions or additional requirements…" style={{ ...ss.ta, minHeight:50 }} />
        </div>
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
          </div>
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
                  <input
                    value={item.text}
                    onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                    placeholder="Checklist item"
                    style={{ ...ss.inp, margin:0 }}
                  />
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
            </div>
          )}
        </div>
        </>
        )}

        {wizardStep < 4 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, paddingTop:12, borderTop:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <button type="button" style={ss.btn} disabled={wizardStep<=1} onClick={()=>setWizardStep((s)=>Math.max(1,s-1))}>Back</button>
          <button type="button" style={{ ...ss.btnO, opacity: stepNextEnabled ? 1 : 0.45 }} disabled={!stepNextEnabled} onClick={()=>setWizardStep((s)=>Math.min(4,s+1))}>Next</button>
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
            {simopsHits.length > 0 ? <li style={{ color:"#791F1F" }}>SIMOPS: {simopsHits.length} overlapping permit(s) at this location</li> : null}
          </ul>
          {typeMeta.hseUrl ? (
            <a href={typeMeta.hseUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#0C447C", marginTop:8, display:"inline-block" }}>Open HSE guidance</a>
          ) : null}
        </div>
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
            Complete description, location, issuer/receiver, valid start/end time, and at least one checklist item before issuing.
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
                const pr = buildPermitPayload("pending_review");
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
                const active = buildPermitPayload("active");
                saveFormPrefs(active);
                trackEvent("permit_issued", { permitType: type, legalReady });
                onSave(active);
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
  onNotify,
  onAcknowledge,
  simopsConflicts = [],
  highlight,
  compact = false,
  onLoadCloudAudit,
  selectable = false,
  selected = false,
  onToggleSelect,
  incidents = [],
  onReportIncident,
}) {
  const def = PERMIT_TYPES[permit.type] || PERMIT_TYPES.general;
  const [expanded, setExpanded] = useState(false);
  const [cloudAuditRows, setCloudAuditRows] = useState([]);
  const [cloudAuditLoading, setCloudAuditLoading] = useState(false);
  const [cloudAuditError, setCloudAuditError] = useState("");
  const checklistItems = normalizeChecklistItems(permit.type || "general", permit, checklistStringsForType(permit.type || "general"));
  const checklistState = normalizeChecklistState(permit.checklist, checklistItems);
  const checkedCount = checklistItems.filter((item) => checklistState[item.id]).length;
  const totalChecks = checklistItems.length;
  const endIso = permitEndIso(permit);
  const derived = derivePermitStatus(permit);
  const statusLabel =
    derived === "closed" ? "Closed" :
    derived === "expired" ? "Expired" :
    derived === "draft" ? "Draft" :
    derived === "pending_review" ? "In review" :
    derived === "approved" ? "Approved" :
    "Active";
  const statusBg =
    derived === "closed" ? "var(--color-background-secondary,#f7f7f5)" :
    derived === "expired" ? "#FCEBEB" :
    derived === "draft" ? "#FAEEDA" :
    derived === "pending_review" ? "#FAEEDA" :
    derived === "approved" ? "#E6F1FB" :
    "#EAF3DE";
  const statusColor =
    derived === "closed" ? "var(--color-text-secondary)" :
    derived === "expired" ? "#791F1F" :
    derived === "draft" ? "#633806" :
    derived === "pending_review" ? "#633806" :
    derived === "approved" ? "#0C447C" :
    "#27500A";

  return (
    <div
      id={`permit-row-${permit.id}`}
      className="app-surface-card"
      style={{
        ...ss.card,
        marginBottom:8,
        borderLeft:`3px solid ${def.color}`,
        boxShadow: highlight ? "0 0 0 2px #0d9488, 0 1px 2px rgba(0,0,0,0.06)" : undefined,
        transition: "box-shadow 0.2s ease",
      }}
    >
      <div
        style={{
          display:"grid",
          gridTemplateColumns: compact ? (selectable ? "24px 1fr" : "1fr") : (selectable ? "24px 36px minmax(0,1fr) auto" : "36px minmax(0,1fr) auto"),
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
            <span style={{ fontWeight:500, fontSize:14 }}>{def.label}</span>
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:statusBg, color:statusColor }}>
              {statusLabel}
            </span>
            {simopsConflicts.length > 0 && (
              <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"#FCEBEB", color:"#791F1F" }} title="Overlapping permits at this location">
                SIMOPS ×{simopsConflicts.length}
              </span>
            )}
            {derived === "active" && endIso && (
              <Countdown expiresAt={endIso} />
            )}
          </div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", display:"flex", gap:12, flexWrap:"wrap" }}>
            {permit.location && <span>{permit.location}</span>}
            {permit.issuedTo && <span>To: {permit.issuedTo}</span>}
            <span>Valid: {fmtDateTime(permit.startDateTime)} → {fmtDateTime(endIso)}</span>
          </div>
          {permit.description && (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:4, fontStyle:"italic" }}>
              {permit.description.slice(0,100)}{permit.description.length>100?"…":""}
            </div>
          )}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0, justifyContent: compact ? "flex-start" : "flex-end" }}>
          <button onClick={()=>setExpanded(v=>!v)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>
            {expanded?"▲":"▼"}
          </button>
          <button onClick={()=>onPreview(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>Preview</button>
          <button onClick={()=>onPrint(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>Export PDF</button>
          {onNotify ? <button onClick={()=>onNotify(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>Notify team</button> : null}
          {onAcknowledge ? <button onClick={()=>onAcknowledge(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>Acknowledge</button> : null}
          {onReportIncident ? (
            <button onClick={() => onReportIncident(permit)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>
              Report incident{incidents.length ? ` (${incidents.length})` : ""}
            </button>
          ) : null}
          <button onClick={()=>onEdit(permit)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Edit</button>
          {permit.status==="pending_review" && (
            <>
              <button type="button" onClick={()=>onApprove?.(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}>Approve</button>
              <button type="button" onClick={()=>onActivate?.(permit.id)} style={{ ...ss.btnO, padding:"4px 8px", fontSize:12 }}>Approve & activate</button>
            </>
          )}
          {permit.status==="approved" && (
            <button type="button" onClick={()=>onActivate?.(permit.id)} style={{ ...ss.btnO, padding:"4px 8px", fontSize:12 }}>Activate</button>
          )}
          {derived === "active" && (
            <button onClick={()=>onClose(permit.id)} style={{ ...ss.btnR, padding:"4px 10px", fontSize:12 }}>Close</button>
          )}
          {(derived==="closed"||derived==="expired") && (
            <button onClick={()=>onReopen(permit.id)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Reopen</button>
          )}
          <button onClick={()=>onDelete(permit.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          {simopsConflicts.length > 0 && (
            <div style={{ marginBottom:12, fontSize:12, padding:"8px 10px", borderRadius:8, background:"#FCEBEB", border:"1px solid #f5c7c7", color:"#791F1F" }}>
              <strong>SIMOPS / overlap at this location:</strong>
              <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                {simopsConflicts.slice(0, 8).map((p) => (
                  <li key={p.id}>{(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label} · {fmtDateTime(p.startDateTime)} → {fmtDateTime(permitEndIso(p))}</li>
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
  const [permits, setPermits] = useState(()=>load("permits_v2",[]));
  const [modal, setModal] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [savedViews, setSavedViews] = useState(() => load(PERMIT_SAVED_VIEWS_KEY, []));
  const [selectedPermitIds, setSelectedPermitIds] = useState({});
  const [viewMode, setViewMode] = useState("list");
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
  const advancedViewsEnabled = isFeatureEnabled("permits_board_timeline");
  const liveWallEnabled = isFeatureEnabled("permits_live_wall_v1");
  const permitNotifyEnabled = isFeatureEnabled("permits_notifications_v1");
  const navHandledRef = useRef(false);
  const mirrorTimerRef = useRef(null);
  const workers = load("mysafeops_workers", []);
  const ramsDocs = load("rams_builder_docs", []);

  const isNarrow = viewportWidth < 820;
  const isTablet = viewportWidth < 1024;

  useEffect(()=>{ save("permits_v2",permits); },[permits]);
  useEffect(()=>{ save(PERMIT_SAVED_VIEWS_KEY, savedViews); },[savedViews]);
  useEffect(() => { savePermitIncidents(incidents); }, [incidents]);
  useEffect(() => { saveProjectPlans(projectPlans); }, [projectPlans]);

  useEffect(() => {
    if (navHandledRef.current) return;
    navHandledRef.current = true;
    const t = consumeWorkspaceNavTarget();
    if (t?.viewId === "permits" && t.permitId) {
      setHighlightPermitId(t.permitId);
      setFilterStatus("");
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

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  const simopsMap = useMemo(() => buildSimopsConflictMap(permits), [permits]);

  const savePermit = (p) => {
    setPermits((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      const auditLog = appendPermitAuditEntry(existing, p);
      const next = { ...p, auditLog };
      void logPermitAuditToSupabase(existing, next, getOrgId());
      return existing ? prev.map((x) => (x.id === p.id ? next : x)) : [next, ...prev];
    });
    setModal(null);
  };

  const closePermit = (id) =>
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, status: "closed", closedAt: new Date().toISOString() };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  const reopenPermit = (id) =>
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, status: "active", closedAt: undefined };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  const approvePermit = (id) =>
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, status: "approved", approvedAt: new Date().toISOString() };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  const activatePermit = (id) =>
    setPermits((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, status: "active", closedAt: undefined };
        const withLog = { ...next, auditLog: appendPermitAuditEntry(p, next) };
        void logPermitAuditToSupabase(p, withLog, getOrgId());
        return withLog;
      })
    );
  const deletePermit = (id) => {
    if (!confirm("Delete this permit?")) return;
    setPermits((prev) => {
      const victim = prev.find((p) => p.id === id);
      if (victim) void logPermitDeletedToSupabase(victim, getOrgId());
      return prev.filter((p) => p.id !== id);
    });
  };

  const now = new Date();
  const filtered = permits.filter(p=>{
    const endIso = permitEndIso(p);
    const endDate = endIso ? new Date(endIso) : null;
    if (filterType && p.type!==filterType) return false;
    if (filterStatus==="active" && (p.status!=="active" || !endDate || endDate < now)) return false;
    if (filterStatus==="expired" && !(p.status==="active" && endDate && endDate < now)) return false;
    if (filterStatus==="closed" && p.status!=="closed") return false;
    if (filterStatus==="draft" && p.status!=="draft") return false;
    if (filterStatus==="pending_review" && p.status!=="pending_review") return false;
    if (filterStatus==="approved" && p.status!=="approved") return false;
    if (search) {
      const q = search.toLowerCase();
      const typeLabel = (PERMIT_TYPES[p.type] || PERMIT_TYPES.general)?.label?.toLowerCase() || "";
      const hay = [p.location, p.description, p.issuedTo, p.issuedBy, p.type, typeLabel, p.id].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const stats = buildPermitWarRoomStats(permits, now);
  const selectedPermits = permits.filter((p) => selectedPermitIds[p.id]);
  const hasSelectedPermits = selectedPermits.length > 0;
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedPermitIds[p.id]);
  const heatmapRows = permitsHeatmap(permits, PERMIT_TYPES);
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
      if (status === "expired") {
        push({
          kind: "expired",
          severity: "critical",
          permitId: p.id,
          title: "Expired permit requires closure/reissue",
          detail: `${(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label} · ${p.location || "Unknown location"}`,
        });
      } else if (status === "active" && msToEnd != null && msToEnd < 90 * 60 * 1000) {
        push({
          kind: "expiring",
          severity: msToEnd < 30 * 60 * 1000 ? "critical" : "warning",
          permitId: p.id,
          title: "Active permit expiring soon",
          detail: `${(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label} · ${p.location || "Unknown location"}`,
        });
      } else if (status === "pending_review") {
        push({
          kind: "review",
          severity: "warning",
          permitId: p.id,
          title: "Permit awaiting review/approval",
          detail: `${(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label} · ${p.location || "Unknown location"}`,
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
            detail: `${(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label} · complete people fields`,
          });
        }
      }
      if (status === "active") {
        const hasAck = Array.isArray(p.acknowledgements) && p.acknowledgements.length > 0;
        const ageMs = p.startDateTime ? now.getTime() - new Date(p.startDateTime).getTime() : 0;
        if (!hasAck && ageMs > 30 * 60 * 1000) {
          push({
            kind: "ack_missing",
            severity: "warning",
            permitId: p.id,
            title: "Active permit without acknowledgement",
            detail: `${(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label} · ${p.location || "Unknown location"}`,
          });
        }
      }
    });
    const rank = { critical: 0, warning: 1, info: 2 };
    return list
      .sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3))
      .slice(0, 14);
  }, [permits, now]);
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

  const upsertBulkStatus = (fromStatuses, nextStatus, nextPatch = {}) => {
    const fromSet = new Set(fromStatuses);
    let changed = 0;
    setPermits((prev) =>
      prev.map((p) => {
        if (!selectedPermitIds[p.id]) return p;
        if (!fromSet.has(String(p.status || ""))) return p;
        const next = {
          ...p,
          status: nextStatus,
          ...nextPatch,
        };
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
    const changed = upsertBulkStatus(["pending_review"], "approved", { approvedAt: new Date().toISOString() });
    if (changed === 0) window.alert("No selected permits are in review.");
  };

  const bulkActivateSelected = () => {
    const changed = upsertBulkStatus(["approved", "closed"], "active", { closedAt: undefined });
    if (changed === 0) window.alert("No selected permits can be activated.");
  };

  const bulkCloseSelected = () => {
    const changed = upsertBulkStatus(["active"], "closed", { closedAt: new Date().toISOString() });
    if (changed === 0) window.alert("No selected permits are active.");
  };

  const bulkDeleteSelected = () => {
    if (!hasSelectedPermits) return;
    if (!window.confirm(`Delete ${selectedPermits.length} selected permit(s)?`)) return;
    const selectedIds = new Set(Object.keys(selectedPermitIds));
    setPermits((prev) => {
      prev.forEach((p) => {
        if (selectedIds.has(p.id)) void logPermitDeletedToSupabase(p, getOrgId());
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
          esc((PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label),
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
      const entry = {
        at: new Date().toISOString(),
        channel,
        status: "sent",
        recipientCount: Number(res?.recipientCount || recipients.length),
        note: linkedRams ? "includes RAMS reference" : "",
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
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {modal?.type==="form" && (
        <PermitForm
          permit={modal.data}
          recentPermit={permits[0] || null}
          allPermits={permits}
          onSave={savePermit}
          onClose={()=>setModal(null)}
        />
      )}

      <PageHero
        badgeText="PTW"
        title="Permits to work"
        lead="Fifteen permit types, SIMOPS overlap checks, and change logs. Data stays on device; signed-in users also mirror permits to your cloud workspace when configured."
        right={<button type="button" onClick={() => setModal({ type: "form" })} style={ss.btnO}>+ Issue permit</button>}
      />

      {/* stat cards */}
      {permits.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginBottom:20 }}>
          {[
            { label:"In review", value:stats.pendingReview, bg:"#FAEEDA", color:"#633806", filter:"pending_review" },
            { label:"Approved", value:stats.approved, bg:"#E6F1FB", color:"#0C447C", filter:"approved" },
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

      {permits.length > 0 && (
        <div className="app-panel-surface" style={{ padding:10, borderRadius:10, marginBottom:16 }}>
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
                    ? { border:"#A32D2D", bg:"#FCEBEB", color:"#791F1F" }
                    : item.severity === "warning"
                      ? { border:"#b45309", bg:"#FAEEDA", color:"#633806" }
                      : { border:"#0C447C", bg:"#E6F1FB", color:"#0C447C" };
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
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f || !planProjectId) return;
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

      {/* filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search location, worker, issuer, type…" style={{ ...ss.inp, flex:1, width: isNarrow ? "100%" : "auto", minWidth: isNarrow ? "100%" : 140 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto" }}>
          <option value="">All permit types</option>
          {Object.entries(PERMIT_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...ss.inp, width: isNarrow ? "100%" : "auto" }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="closed">Closed</option>
          <option value="draft">Draft</option>
          <option value="pending_review">In review</option>
          <option value="approved">Approved</option>
        </select>
        {(search||filterType||filterStatus)&&<button type="button" onClick={()=>{setSearch("");setFilterType("");setFilterStatus("");}} style={{ ...ss.btn, fontSize:12, width: isNarrow ? "100%" : "auto" }}>Clear</button>}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <button type="button" onClick={saveCurrentView} style={{ ...ss.btn, fontSize:12 }}>
          Save current view
        </button>
        {savedViews.length === 0 ? (
          <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No saved views yet.</span>
        ) : (
          savedViews.map((v) => (
            <div key={v.id} style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
              <button type="button" onClick={() => applySavedView(v)} style={{ ...ss.btn, fontSize:11, padding:"3px 8px" }}>
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
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <button type="button" onClick={toggleSelectAllFiltered} style={{ ...ss.btn, fontSize:12 }}>
              {allFilteredSelected ? "Unselect filtered" : "Select filtered"}
            </button>
            <button type="button" onClick={clearPermitSelection} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Clear selection
            </button>
            <span style={{ ...ss.chip, fontSize:11 }}>{selectedPermits.length} selected</span>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" onClick={bulkApproveSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Bulk approve
            </button>
            <button type="button" onClick={bulkActivateSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Bulk activate
            </button>
            <button type="button" onClick={bulkCloseSelected} disabled={!hasSelectedPermits} style={{ ...ss.btnR, fontSize:12, minHeight:34, padding:"6px 10px", opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Bulk close
            </button>
            <button type="button" onClick={bulkExportSelectedCsv} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Export selected CSV
            </button>
            <button type="button" onClick={bulkDeleteSelected} disabled={!hasSelectedPermits} style={{ ...ss.btn, fontSize:12, color:"#A32D2D", borderColor:"#F09595", opacity: hasSelectedPermits ? 1 : 0.45 }}>
              Delete selected
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
                      {p.id} - {(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label}
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
                  <strong>{(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label}</strong> · {p.location || "Unknown location"}
                  <div style={{ color:"#A32D2D" }}>{derivePermitStatus(p, now) === "expired" ? "Expired" : "Expires within 1 hour"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {permits.length===0 ? (
        <div style={{ textAlign:"center", padding:"3rem 1rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12 }}>
          <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:12 }}>No permits issued yet.</p>
          <button type="button" onClick={()=>setModal({type:"form"})} style={ss.btnO}>+ Issue first permit</button>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"2rem", border:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius:12, color:"var(--color-text-secondary)", fontSize:13 }}>
          No permits match your filters.
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
              highlight={highlightPermitId === p.id}
              compact={isNarrow}
              selectable={true}
              selected={!!selectedPermitIds[p.id]}
              onToggleSelect={togglePermitSelection}
              onNotify={permitNotifyEnabled ? notifyPermitTeam : undefined}
              onAcknowledge={acknowledgePermit}
              incidents={incidentsByPermit.get(p.id) || []}
              onReportIncident={reportPermitIncident}
              onLoadCloudAudit={loadPermitCloudAudit}
              onEdit={(x)=>setModal({type:"form",data:x})}
              onClose={closePermit}
              onReopen={reopenPermit}
              onDelete={deletePermit}
              onPreview={previewPermit}
              onPrint={exportPermitPdf}
              onApprove={approvePermit}
              onActivate={activatePermit}
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
                <div style={{ fontSize:13, fontWeight:500 }}>{(PERMIT_TYPES[permit.type] || PERMIT_TYPES.general).label}</div>
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
            highlight={highlightPermitId === p.id}
            compact={isNarrow}
            selectable={true}
            selected={!!selectedPermitIds[p.id]}
            onToggleSelect={togglePermitSelection}
            onNotify={permitNotifyEnabled ? notifyPermitTeam : undefined}
            onAcknowledge={acknowledgePermit}
            incidents={incidentsByPermit.get(p.id) || []}
            onReportIncident={reportPermitIncident}
            onLoadCloudAudit={loadPermitCloudAudit}
            onEdit={p=>setModal({type:"form",data:p})}
            onClose={closePermit} onReopen={reopenPermit}
            onDelete={deletePermit}
            onPreview={previewPermit}
            onPrint={exportPermitPdf}
            onApprove={approvePermit}
            onActivate={activatePermit}
          />
        ))
      )}
    </div>
  );
}
