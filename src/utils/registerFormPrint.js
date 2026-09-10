/**
 * Branded A4 site-form print for HSE register records (browser Print → Save as PDF).
 */
import { escapeHtml, escapeAttr, safeImageSrc, openPrintWindowOrWarn, writePrintWindowDocument } from "./htmlEscape.js";
import { getOrgSettings } from "./orgSettingsStorage.js";
import { MODULE_PDF_REGISTRY } from "../navigation/moduleCatalogMeta.js";
import { wrapPrintHtmlDocument } from "./pdfBranding.js";
import { getActiveDocumentLocale } from "./countryWorkspaces";
import { documentText } from "./documentCountryPack";

const SKIP_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "photo",
  "photos",
  "signature",
  "signatureImageDataUrl",
  "sig",
  "attendees",
  "_v",
  "orgId",
]);

export function humanizeFormKey(key) {
  return String(key || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function formatFormValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    if (typeof value[0] === "object") return `${value.length} item(s)`;
    return value.map((x) => String(x)).join(", ");
  }
  if (typeof value === "object") return "—";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    try {
      return new Date(s).toLocaleDateString(getActiveDocumentLocale(), { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return s.slice(0, 32);
    }
  }
  return s;
}

export function formSection(title) {
  return `<div class="rf-section">${escapeHtml(title)}</div>`;
}

export function formKvTable(pairs) {
  const rows = (pairs || [])
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(formatFormValue(value))}</td></tr>`
    )
    .join("");
  if (!rows) return "";
  return `<table class="rf-kv">${rows}</table>`;
}

export function formChips(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return `<div class="rf-muted">None recorded</div>`;
  return `<div class="rf-chips">${list
    .map((x) => `<span class="rf-chip">${escapeHtml(String(x))}</span>`)
    .join("")}</div>`;
}

export function formNotes(text, title = documentText("Notes")) {
  const t = String(text || "").trim();
  if (!t) return "";
  return `${formSection(title)}<div class="rf-notes">${escapeHtml(t)}</div>`;
}

export function formCallout(text, tone = "warn") {
  const t = String(text || "").trim();
  if (!t) return "";
  return `<div class="rf-callout rf-callout--${tone}">${escapeHtml(t)}</div>`;
}

export function formSigBlock(labels = [documentText("Assessed / completed by"), documentText("Reviewed / authorised by")]) {
  const cells = labels
    .map(
      (label) => `<div class="rf-sig">
      <div class="rf-sig__label">${escapeHtml(label)}</div>
      <div class="rf-sig__line"><span>${escapeHtml(documentText("Name"))}</span></div>
      <div class="rf-sig__line"><span>${escapeHtml(documentText("Signature"))}</span></div>
      <div class="rf-sig__line"><span>${escapeHtml(documentText("Date"))}</span></div>
    </div>`
    )
    .join("");
  return `${formSection(documentText("Authorisation"))}<div class="rf-sig-grid">${cells}</div>`;
}

export function formAttendanceGrid(count = 8) {
  const n = Math.max(4, Math.min(24, Number(count) || 8));
  const rows = Array.from({ length: n }, (_, i) => {
    const no = i + 1;
    return `<tr>
      <td class="rf-num">${no}</td>
      <td></td>
      <td></td>
      <td class="rf-sig-cell"></td>
    </tr>`;
  }).join("");
  return `${formSection("Attendance / acknowledgment")}
  <p class="rf-muted">Workers sign to confirm they understood the talk / induction points.</p>
  <table class="rf-attend">
    <thead><tr><th>#</th><th>Name</th><th>Company / role</th><th>Signature</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

const FORM_EXTRA_CSS = `
  .rf-section {
    font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
    color: #64748b; margin: 16px 0 8px;
  }
  .rf-kv { width: 100%; border-collapse: collapse; margin: 0 0 10px; }
  .rf-kv th, .rf-kv td {
    border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 12px;
  }
  .rf-kv th { width: 34%; background: #f8fafc; color: #475569; font-weight: 650; }
  .rf-kv td { color: #0f172a; }
  .rf-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
  .rf-chip {
    display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 650;
    background: #e0f2fe; color: #0c4a6e; border: 1px solid #bae6fd;
  }
  .rf-notes {
    white-space: pre-wrap; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px;
    background: #f8fafc; font-size: 12px; line-height: 1.45; color: #334155;
  }
  .rf-callout {
    border-radius: 8px; padding: 10px 12px; margin: 10px 0 14px; font-size: 12px; font-weight: 650;
  }
  .rf-callout--warn { background: #fffbeb; border: 1px solid #fde68a; color: #854d0e; }
  .rf-callout--danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .rf-callout--ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .rf-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
  .rf-sig {
    border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; min-height: 92px; background: #fff;
  }
  .rf-sig__label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 8px; }
  .rf-sig__line {
    border-bottom: 1px solid #94a3b8; height: 22px; margin-bottom: 10px; position: relative;
  }
  .rf-sig__line span {
    position: absolute; left: 0; bottom: 2px; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .rf-attend { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .rf-attend th, .rf-attend td {
    border: 1px solid #cbd5e1; padding: 8px 8px; font-size: 11px; vertical-align: middle;
  }
  .rf-attend th { background: #0f172a; color: #fff; text-align: left; font-weight: 700; }
  .rf-attend td { height: 28px; }
  .rf-attend .rf-num { width: 28px; text-align: center; color: #64748b; }
  .rf-attend .rf-sig-cell { width: 28%; }
  .rf-muted { font-size: 11px; color: #64748b; margin: 0 0 8px; }
  .rf-hero {
    display: flex; justify-content: space-between; gap: 12px; align-items: flex-start;
    margin: 0 0 12px; padding: 12px 14px; border-radius: 10px; background: #f1f5f9; border: 1px solid #e2e8f0;
  }
  .rf-hero h2 { margin: 0 0 4px; font-size: 16px; color: #0f172a; }
  .rf-hero p { margin: 0; font-size: 11px; color: #64748b; }
  .rf-risk {
    flex-shrink: 0; min-width: 72px; text-align: center; border-radius: 8px; padding: 8px 10px;
    font-weight: 800; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
  }
  .rf-risk--low { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .rf-risk--medium { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
  .rf-risk--high { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .rf-photo { max-width: 100%; max-height: 180px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 6px; }
  @media print {
    .rf-sig-grid { break-inside: avoid; }
    .rf-attend { break-inside: auto; }
    .rf-attend tr { break-inside: avoid; }
  }
  @media (max-width: 640px) {
    .rf-sig-grid { grid-template-columns: 1fr; }
  }
`;

export function buildRegisterFormDocument(org, { pageTitle, docTitle, docSubtitle, docBadge, bodyHtml, footerExtra }) {
  return wrapPrintHtmlDocument(org, {
    pageTitle: pageTitle || docTitle || "Site form",
    bodyHtml: bodyHtml || "",
    extraCss: FORM_EXTRA_CSS,
    headerOpts: {
      docTitle: docTitle || "Site form",
      docSubtitle: docSubtitle || "",
      docBadge: docBadge || "A4 FORM",
    },
    metaFields: {
      moduleLabel: docTitle,
      recordNote: docSubtitle || "Controlled site form",
    },
    footerExtra: footerExtra || "Print → Save as PDF for audit packs",
  });
}

export function openRegisterFormPrint(html) {
  if (typeof window === "undefined") return false;
  const w = openPrintWindowOrWarn();
  if (!w) return false;
  void writePrintWindowDocument(w, html).then(() => {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
    }, 200);
  });
  return true;
}

function recordTitle(record) {
  return (
    record?.name ||
    record?.title ||
    record?.topic ||
    record?.courseName ||
    record?.item ||
    record?.assetRef ||
    record?.ladderRef ||
    record?.equipmentRef ||
    record?.tagRef ||
    record?.permitRef ||
    record?.liftRef ||
    record?.registration ||
    record?.visitorName ||
    record?.substanceOrArea ||
    record?.equipmentName ||
    record?.location ||
    record?.ref ||
    "Record"
  );
}

/** COSHH Regs 2002 style assessment sheet */
export function buildCoshhFormBody(item = {}) {
  const risk = String(item.riskLevel || "medium").toLowerCase();
  const riskClass = risk === "high" ? "high" : risk === "low" ? "low" : "medium";
  const qty = [item.quantity, item.unit].filter(Boolean).join(" ");
  return `
    <div class="rf-hero">
      <div>
        <h2>${escapeHtml(item.name || "Substance assessment")}</h2>
        <p>COSHH Regs 2002 · Control of Substances Hazardous to Health assessment sheet</p>
      </div>
      <div class="rf-risk rf-risk--${riskClass}">${escapeHtml(risk)}</div>
    </div>
    ${formKvTable([
      ["Manufacturer", item.manufacturer],
      ["Product / UN code", item.productCode],
      ["Quantity on site", qty || null],
      ["Storage location", item.storageLocation],
      ["Storage conditions", item.storageNotes],
      ["SDS reference", item.sdsUrl],
      ["SDS review date", item.sdsReviewDate],
      ["Assessment date", item.assessedDate],
      ["Assessed by", item.assessedBy],
    ])}
    ${formSection("Hazard classification")}
    ${formChips(item.hazardTypes)}
    ${formSection("Exposure routes")}
    ${formChips(item.exposureRoutes)}
    ${formSection("Required PPE")}
    ${formChips(item.ppeRequired)}
    ${formNotes(item.firstAid, "First aid measures")}
    ${formNotes(item.spillProcedure, "Spill / leak procedure")}
    ${formNotes(item.disposalMethod, "Disposal method")}
    ${formNotes(item.notes, "Additional notes")}
    ${formCallout(
      risk === "high"
        ? "HIGH RISK — ensure hierarchy of control is applied before use; supervisor brief required."
        : "Confirm operatives have read the SDS and this assessment before handling the substance.",
      risk === "high" ? "danger" : "warn"
    )}
    ${formSigBlock(["Assessor", "Site supervisor acknowledgment"])}
  `;
}

/** Toolbox talk delivery + blank attendance signature sheet */
export function buildToolboxFormBody(item = {}) {
  const attendeeHint = Number(item.attendeeCount) || 10;
  return `
    <div class="rf-hero">
      <div>
        <h2>${escapeHtml(item.topic || "Toolbox talk")}</h2>
        <p>Site toolbox talk record · knowledge brief & attendance</p>
      </div>
    </div>
    ${formKvTable([
      ["Date delivered", item.talkDate || item.date],
      ["Presenter / lead", item.presenter || item.lead],
      ["Project", item.projectName],
      ["Approx. attendees", item.attendeeCount],
    ])}
    ${formNotes(item.summary || item.notes, "Key points covered")}
    ${formCallout("All attendees must sign below. Keep with site safety file.", "ok")}
    ${formAttendanceGrid(attendeeHint)}
    ${formSigBlock(["Presenter", "Site manager"])}
  `;
}

const INSPECTION_TYPE_LABELS = {
  loler: "LOLER thorough examination",
  pat: "PAT (portable appliance test)",
  puwer: "PUWER inspection",
  pssr: "PSSR written scheme",
  eicr: "EICR (electrical installation)",
  ladder: "Ladder inspection",
  mewp: "MEWP inspection (LOLER)",
  scaffold: "Scaffold inspection",
  fire_ext: "Fire extinguisher service",
  eyewash: "Eye wash station check",
  harness: "Harness & fall arrest inspection",
  other: "Equipment inspection",
};

export function buildInspectionFormBody(item = {}) {
  const typeLabel = INSPECTION_TYPE_LABELS[item.type] || item.type || "Inspection";
  const result = String(item.result || "").toLowerCase();
  const tone = result === "fail" || result === "fail_quarantine" ? "danger" : result === "pass" ? "ok" : "warn";
  const photoSrc = safeImageSrc(item.photo);
  const photo = photoSrc
      ? `<div>${formSection("Evidence photo")}<img class="rf-photo" src="${escapeAttr(photoSrc)}" alt="Inspection evidence"/></div>`
      : "";
  return `
    <div class="rf-hero">
      <div>
        <h2>${escapeHtml(item.name || "Inspection record")}</h2>
        <p>${escapeHtml(typeLabel)} · equipment compliance form</p>
      </div>
    </div>
    ${formCallout(
      result ? `Result: ${formatFormValue(item.result)}` : "Record inspection result before returning equipment to service.",
      tone
    )}
    ${formKvTable([
      ["Inspection type", typeLabel],
      ["Serial / asset no.", item.serialNo],
      ["Manufacturer / model", [item.manufacturer, item.model].filter(Boolean).join(" · ") || null],
      ["SWL", item.swl],
      ["Location", item.location],
      ["Last inspection", item.lastInspectionDate],
      ["Next due", item.nextInspectionDate],
      ["Inspected by", item.inspectedBy],
      ["Certificate / report no.", item.certNumber],
      ["Result", item.result],
    ])}
    ${formNotes(item.notes)}
    ${photo}
    ${formSigBlock(["Inspector / competent person", "Site supervisor"])}
  `;
}

export function buildTrainingFormBody(item = {}) {
  return `
    <div class="rf-hero">
      <div>
        <h2>${escapeHtml(item.courseName || "Training / competence record")}</h2>
        <p>Worker competence evidence · training matrix form</p>
      </div>
    </div>
    ${formKvTable([
      ["Worker", item.workerName],
      ["Course / qualification", item.courseName],
      ["Provider", item.provider],
      ["Completed", item.completedDate],
      ["Expiry", item.expiryDate],
    ])}
    ${formNotes(item.notes)}
    ${formCallout("Retain certificate copy with this form where required by client / principal contractor.", "ok")}
    ${formSigBlock(["Worker acknowledgment", "Competence verifier"])}
  `;
}

/** Column-aware generic A4 form for any register row */
export function buildGenericRegisterFormBody(record = {}, columns = [], { headline, subtitle } = {}) {
  const title = headline || recordTitle(record);
  const preferred = (columns || []).map((c) => [c.l || humanizeFormKey(c.k), record?.[c.k]]);
  const used = new Set((columns || []).map((c) => c.k));
  const extras = Object.keys(record || {})
    .filter((k) => !used.has(k) && !SKIP_KEYS.has(k))
    .map((k) => [humanizeFormKey(k), record[k]])
    .filter(([, v]) => v != null && v !== "" && typeof v !== "object");

  const photoSrc = safeImageSrc(record.photo);
  const photo = photoSrc
      ? `${formSection("Evidence")}<img class="rf-photo" src="${escapeAttr(photoSrc)}" alt=""/>`
      : "";

  return `
    <div class="rf-hero">
      <div>
        <h2>${escapeHtml(String(title))}</h2>
        <p>${escapeHtml(subtitle || "Site compliance form")}</p>
      </div>
    </div>
    ${formKvTable([...preferred, ...extras])}
    ${formNotes(record.notes || record.summary || record.description || record.detail)}
    ${photo}
    ${formSigBlock()}
  `;
}

const MODULE_FORM_META = {
  coshh: { title: "COSHH assessment", badge: "COSHH", builder: "coshh" },
  "toolbox-reg": { title: "Toolbox talk record", badge: "TT", builder: "toolbox" },
  inspections: { title: "Inspection record", badge: "INSP", builder: "inspection" },
  training: { title: "Training / competence record", badge: "TRN", builder: "training" },
  ppe: { title: "PPE issue record", badge: "PPE", builder: "generic", subtitle: "Personal protective equipment issue / check" },
  plant: { title: "Plant & equipment check", badge: "PLT", builder: "generic", subtitle: "Plant inspection form" },
  vehicles: { title: "Vehicle compliance record", badge: "VEH", builder: "generic" },
  fire: { title: "Fire safety check", badge: "FIRE", builder: "generic" },
  "hot-work": { title: "Hot work register form", badge: "HW", builder: "generic" },
  visitors: { title: "Visitor induction / log", badge: "VIS", builder: "generic", attend: true },
  "first-aid": { title: "First aider register form", badge: "FA", builder: "generic" },
  "lone-working": { title: "Lone working check", badge: "LW", builder: "generic" },
  environmental: { title: "Environmental incident / log", badge: "ENV", builder: "generic" },
  observations: { title: "Safety observation", badge: "OBS", builder: "generic" },
  ladders: { title: "Ladder inspection form", badge: "LAD", builder: "generic" },
  mewp: { title: "MEWP daily / period check", badge: "MEWP", builder: "generic" },
  gate: { title: "Gate book entry", badge: "GATE", builder: "generic" },
  asbestos: { title: "Asbestos register entry", badge: "ACM", builder: "generic" },
  "confined-space": { title: "Confined space entry record", badge: "CS", builder: "generic" },
  loto: { title: "Lock-out / tag-out record", badge: "LOTO", builder: "generic" },
  "electrical-pat": { title: "Electrical PAT record", badge: "PAT", builder: "generic" },
  lifting: { title: "Lifting plan / lift record", badge: "LIFT", builder: "generic" },
  dsear: { title: "DSEAR assessment entry", badge: "DSEAR", builder: "generic" },
  noise: { title: "Noise / vibration log", badge: "NV", builder: "generic" },
  scaffold: { title: "Scaffold inspection form", badge: "SCF", builder: "generic" },
  excavation: { title: "Excavation / permit-to-dig", badge: "EX", builder: "generic" },
  "temp-works": { title: "Temporary works record", badge: "TW", builder: "generic" },
  welfare: { title: "Welfare check form", badge: "WEL", builder: "generic" },
  "water-hygiene": { title: "Water hygiene check", badge: "H2O", builder: "generic" },
  waste: { title: "Waste transfer record", badge: "WST", builder: "generic" },
  snags: { title: "Snag / defect record", badge: "SNAG", builder: "generic" },
  incidents: { title: "Incident / near miss", badge: "INC", builder: "generic" },
  "incident-actions": { title: "Incident action", badge: "ACT", builder: "generic" },
  emergency: { title: "Emergency contact card", badge: "EM", builder: "generic" },
  riddor: { title: "RIDDOR / notifiable draft", badge: "RID", builder: "generic" },
  "notifiable-incidents": { title: "Notifiable incident draft", badge: "NI", builder: "generic" },
  "method-statement": { title: "Method statement summary", badge: "MS", builder: "generic" },
  "daily-briefing": { title: "Daily briefing form", badge: "DB", builder: "generic", attend: true },
  "whs-plan": { title: "WHS / CDM pack summary", badge: "WHS", builder: "generic" },
  "bhp-plan": { title: "Plan BHP summary", badge: "BHP", builder: "generic" },
  cdm: { title: "CDM pack summary", badge: "CDM", builder: "generic" },
};

function buildBodyForModule(moduleId, record) {
  const meta = MODULE_FORM_META[moduleId] || { title: "Site form", badge: "FORM", builder: "generic" };
  const columns = MODULE_PDF_REGISTRY[moduleId]?.columns || [];
  if (meta.builder === "coshh") return buildCoshhFormBody(record);
  if (meta.builder === "toolbox") return buildToolboxFormBody(record);
  if (meta.builder === "inspection") return buildInspectionFormBody(record);
  if (meta.builder === "training") return buildTrainingFormBody(record);
  let body = buildGenericRegisterFormBody(record, columns, {
    headline: recordTitle(record),
    subtitle: meta.subtitle || meta.title,
  });
  if (meta.attend) {
    body += formAttendanceGrid(Number(record?.attendeeCount) || 8);
  }
  return body;
}

/**
 * Open branded A4 print for a register record.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function printRegisterForm(moduleId, record, opts = {}) {
  if (!record || typeof record !== "object") {
    return { ok: false, reason: "missing_record" };
  }
  const org = opts.org || getOrgSettings() || {};
  const meta = MODULE_FORM_META[moduleId] || {
    title: opts.docTitle || "Site form",
    badge: opts.docBadge || "FORM",
  };
  const subtitle = String(recordTitle(record));
  const bodyHtml = buildBodyForModule(moduleId, record);
  const html = buildRegisterFormDocument(org, {
    pageTitle: `${meta.title} — ${subtitle}`,
    docTitle: meta.title,
    docSubtitle: subtitle,
    docBadge: meta.badge,
    bodyHtml,
  });
  const opened = openRegisterFormPrint(html);
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}

/**
 * Print multiple records as a multi-page A4 pack (page-break between forms).
 * @returns {{ ok: boolean, reason?: string, count?: number }}
 */
export function printRegisterFormPack(moduleId, records, opts = {}) {
  const list = Array.isArray(records) ? records.filter((r) => r && typeof r === "object") : [];
  if (!list.length) return { ok: false, reason: "empty" };
  const org = opts.org || getOrgSettings() || {};
  const meta = MODULE_FORM_META[moduleId] || {
    title: opts.docTitle || "Site form pack",
    badge: opts.docBadge || "PACK",
  };
  const pages = list
    .map((record, idx) => {
      const body = buildBodyForModule(moduleId, record);
      const breakCss = idx < list.length - 1 ? ' style="page-break-after: always;"' : "";
      return `<section class="rf-pack-page"${breakCss}>
        <div class="rf-muted">Form ${idx + 1} of ${list.length}</div>
        ${body}
      </section>`;
    })
    .join("\n");
  const html = buildRegisterFormDocument(org, {
    pageTitle: `${meta.title} pack (${list.length})`,
    docTitle: `${meta.title} pack`,
    docSubtitle: `${list.length} form(s)`,
    docBadge: meta.badge || "PACK",
    bodyHtml: pages,
    footerExtra: "Multi-form pack · Print → Save as PDF",
  });
  const opened = openRegisterFormPrint(html);
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true, count: list.length };
}

/** List of module ids with dedicated / generic A4 form support */
export function listRegisterFormModules() {
  return Object.keys(MODULE_FORM_META);
}
