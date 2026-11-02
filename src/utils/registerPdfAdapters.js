/**
 * Per-module PDF export adapters — flatten nested registers & full-detail exports.
 */
import { geoPhotoPresetLabel } from "./geoPhotoPresets";
import { geoPhotoDisplayUrl } from "./geoPhotoMedia";
import { formatAreaSqm, formatGeoPhotoArea, geoPhotoAreaOf } from "./geoPhotoArea";
import {
  PDF_PAGE,
  drawPdfMetaStrip,
  buildDocReference,
  setPdfFont,
} from "./pdfBranding.js";
import { getActiveDocumentLocale } from "./countryWorkspaces";

const he = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function briefingTopicsSummary(brief) {
  const parts = [...(brief?.topics || [])];
  if (brief?.customTopics?.trim()) parts.push(String(brief.customTopics).trim());
  return parts.join("; ").slice(0, 240);
}

export function flattenDailyBriefingRow(brief) {
  const attendees = brief?.attendees || [];
  const present = attendees.filter((a) => a.present);
  return {
    location: brief?.location || "—",
    date: brief?.date || "—",
    time: brief?.time || "—",
    conductedBy: brief?.conductedBy || "—",
    present: present.length,
    signed: present.filter((a) => a.sig).length,
    topicsSummary: briefingTopicsSummary(brief) || "—",
    scopeToday: String(brief?.scopeToday || "").slice(0, 120) || "—",
    weather: [brief?.weatherConditions, brief?.temperature ? `${brief.temperature}°C` : ""]
      .filter(Boolean)
      .join(" · ") || "—",
  };
}

export function flattenToolboxTalkRow(row) {
  return {
    topic: row?.topic || "—",
    date: row?.talkDate || row?.date || "—",
    lead: row?.presenter || row?.lead || "—",
    attendees: row?.attendeeCount != null && row.attendeeCount !== "" ? String(row.attendeeCount) : "—",
    project: row?.projectName || "—",
    notes: String(row?.summary || row?.notes || "").slice(0, 100) || "—",
  };
}

export function flattenCdmPackRow(pack) {
  const checked = Object.values(pack?.dutyholderChecks || {}).filter(Boolean).length;
  return {
    projectTitle: pack?.projectTitle || pack?.projectName || "—",
    clientName: pack?.clientName || "—",
    startDate: pack?.startDate || "—",
    cdmChecks: `${checked}/10`,
    status: pack?.status || "draft",
    updatedAt: pack?.updatedAt || pack?.createdAt || "—",
  };
}

const RIDDOR_TYPE_LABELS = {
  fatality: "Death / fatality",
  specified: "Specified injury",
  over7day: "Over-7-day incapacitation",
  dangerous_occurrence: "Dangerous occurrence",
  gas_incident: "Gas incident",
  disease: "Occupational disease",
  public_injury: "Public injury (non-fatal)",
};

export function flattenRiddorRow(row) {
  return {
    type: RIDDOR_TYPE_LABELS[row?.riddorType] || row?.riddorType || "—",
    incidentDate: row?.incidentDate || "—",
    location: row?.location || "—",
    status: row?.status || "—",
    reportedToHSE: row?.reportedToHSE ? "Yes" : "No",
  };
}

export function flattenObservationRow(row) {
  return {
    date: row?.obsDate || "—",
    polarity: row?.polarity === "positive" ? "Positive" : "At risk",
    project: row?.projectName || "—",
    detail: String(row?.detail || "").slice(0, 120) || "—",
    observer: row?.observer || "—",
    action: String(row?.actionTaken || "").slice(0, 80) || "—",
  };
}

function formatCoords(photo) {
  if (photo?.latitude == null || photo?.longitude == null || photo.latitude === "" || photo.longitude === "") return "—";
  const lat = Number(photo?.latitude);
  const lng = Number(photo?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "—";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function flattenGeoPhotoRow(photo) {
  return {
    type: geoPhotoPresetLabel(photo?.type),
    project: photo?.projectName || "—",
    captured: photo?.timestampUtc
      ? new Date(photo.timestampUtc).toLocaleString(getActiveDocumentLocale(), {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    coordinates: formatCoords(photo),
    bearing:
      photo?.bearing != null && !Number.isNaN(Number(photo.bearing)) ? `${Math.round(Number(photo.bearing))}°` : "—",
    extent: formatAreaSqm(geoPhotoAreaOf(photo)?.sqm) || "—",
    inReport: photo?.includeInReport ? "Yes" : "No",
    notes: String(photo?.notes || "").slice(0, 100) || "—",
  };
}

function geoPhotoImageFormat(url) {
  const s = String(url || "").toLowerCase();
  if (s.includes("image/jpeg") || s.includes("image/jpg") || s.includes(".jpg") || s.includes(".jpeg")) return "JPEG";
  if (s.includes("image/webp")) return "WEBP";
  return "PNG";
}

function tryAddGeoPhotoImage(pdf, url, x, y, w, h) {
  if (!url || !String(url).startsWith("data:image")) return false;
  try {
    const { width, height } = pdf.getImageProperties(String(url));
    if (!(width > 0) || !(height > 0)) return false;
    const portrait = height > width * 1.08;
    const frameW = portrait ? 148 : w;
    const frameH = portrait ? 155 : h;
    const frameX = portrait ? (PDF_PAGE.W - frameW) / 2 : x;
    const frameScale = Math.min(frameW / width, frameH / height);
    const fittedW = width * frameScale;
    const fittedH = height * frameScale;
    const imageX = frameX + (frameW - fittedW) / 2;
    const imageY = y + (frameH - fittedH) / 2;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(frameX, y, frameW, frameH, 2, 2, "FD");
    pdf.addImage(String(url), geoPhotoImageFormat(url), imageX, imageY, fittedW, fittedH, undefined, "FAST");
    return { height: frameH };
  } catch {
    return false;
  }
}

/** @type {Record<string, { flatten?: (rows: object[]) => object[]; columns: { k: string; l: string }[]; detailExport?: boolean }>} */
export const REGISTER_PDF_ADAPTERS = {
  coshh: {
    detailExport: true,
    fields: ["name", "manufacturer", "productCode", "riskLevel", "hazardTypes", "quantity", "unit", "storageLocation", "storageNotes", "ppeRequired", "firstAid", "spillProcedure", "disposalMethod", "sdsUrl", "sdsReviewDate", "assessedBy", "assessedDate"],
    columns: [{ k: "name", l: "Substance" }, { k: "hazardTypes", l: "Hazards" }, { k: "ppeRequired", l: "PPE" }, { k: "quantity", l: "Quantity" }, { k: "sdsUrl", l: "SDS" }],
  },
  ppe: {
    detailExport: true,
    fields: ["item", "workerName", "issuedDate", "conditionOk", "notes"],
    columns: [{ k: "item", l: "PPE" }, { k: "workerName", l: "Worker" }, { k: "issuedDate", l: "Issued" }, { k: "conditionOk", l: "OK" }, { k: "notes", l: "Notes" }],
  },
  loto: {
    detailExport: true,
    fields: ["equipmentName", "equipmentTag", "equipmentId", "projectName", "phase", "status", "isolationPoints", "isolationPoint", "appliedBy", "appliedDate", "removedBy", "removedDate", "zeroEnergyVerified", "zeroEnergyMethod", "zeroEnergyVerifiedBy", "notes"],
    columns: [{ k: "equipmentName", l: "Equipment" }, { k: "phase", l: "Phase" }, { k: "isolationPoints", l: "Isolation points" }, { k: "zeroEnergyMethod", l: "Verification method" }, { k: "zeroEnergyVerifiedBy", l: "Verified by" }],
  },
  "cip-signoff": {
    detailExport: true,
    fields: ["equipmentId", "workOrderRef", "projectName", "cipRunAt", "cipProgram", "cipTemperaturePeakC", "cipDurationMinutes", "swabResults", "visualInspectionPassed", "signedOffBy", "releasedToProductionAt"],
    columns: [{ k: "equipmentId", l: "Equipment" }, { k: "cipProgram", l: "Program" }, { k: "swabResults", l: "ATP / swabs" }, { k: "signedOffBy", l: "Signed off by" }, { k: "releasedToProductionAt", l: "Released" }],
  },
  "gmp-deviations": {
    detailExport: true,
    fields: ["batchRef", "deviationType", "siteLabel", "projectName", "description", "immediateAction", "qualityNotifiedAt", "qualityContact", "capaRef", "closedAt"],
    columns: [{ k: "batchRef", l: "Batch" }, { k: "deviationType", l: "Type" }, { k: "description", l: "Description" }, { k: "capaRef", l: "CAPA" }, { k: "closedAt", l: "Closed" }],
  },
  "high-care-access": {
    detailExport: true,
    fields: ["zoneName", "zoneClass", "projectName", "visitorName", "visitorCompany", "purpose", "entryTimestamp", "exitTimestamp", "toolsIn", "toolsOut", "toolReconciliationOk", "hygieneChecks", "escortedBy"],
    columns: [{ k: "zoneName", l: "Zone" }, { k: "visitorName", l: "Visitor" }, { k: "zoneClass", l: "Class" }, { k: "toolsIn", l: "Tools in" }, { k: "toolsOut", l: "Tools out" }],
  },
  "allergen-changeovers": {
    detailExport: true,
    fields: ["label", "siteLabel", "projectName", "fromAllergen", "toAllergen", "startAt", "endAt", "extraPpeHint", "notes"],
    columns: [{ k: "label", l: "Window" }, { k: "fromAllergen", l: "From" }, { k: "toAllergen", l: "To" }, { k: "startAt", l: "Start" }, { k: "endAt", l: "End" }],
  },
  signatures: {
    detailExport: true,
    fields: ["documentTitle", "signerName", "signerRole", "timestamp", "gps", "device"],
    imageField: "dataUrl",
    columns: [{ k: "documentTitle", l: "Document" }, { k: "signerName", l: "Signer" }, { k: "signerRole", l: "Role" }, { k: "timestamp", l: "Signed at" }],
  },
  induction: {
    detailExport: true,
    fields: ["name", "company", "role", "siteName", "timestamp", "gps"],
    imageField: "sig",
    columns: [{ k: "name", l: "Name" }, { k: "company", l: "Company" }, { k: "role", l: "Role" }, { k: "siteName", l: "Site" }, { k: "timestamp", l: "Signed at" }],
  },
  timesheets: {
    flatten: (rows) => rows.map((row) => ({ ...row, hours: Object.values(row.days || {}).reduce((sum, value) => sum + (parseFloat(value) || 0), 0) })),
    columns: [{ k: "workerName", l: "Worker" }, { k: "projectName", l: "Project" }, { k: "weekKey", l: "Week beginning" }, { k: "task", l: "Task" }, { k: "hours", l: "Hours" }, { k: "status", l: "Status" }],
  },
  snags: {
    columns: [{ k: "ref", l: "Ref" }, { k: "title", l: "Title" }, { k: "projectName", l: "Project" }, { k: "assignedToName", l: "Assigned to" }, { k: "status", l: "Status" }, { k: "dueDate", l: "Due" }],
  },
  "daily-briefing": {
    detailExport: true,
    flatten: (rows) => (rows || []).map(flattenDailyBriefingRow),
    columns: [
      { k: "location", l: "Location" },
      { k: "date", l: "Date" },
      { k: "time", l: "Time" },
      { k: "conductedBy", l: "Conducted by" },
      { k: "present", l: "Present" },
      { k: "signed", l: "Signed" },
      { k: "topicsSummary", l: "Topics" },
    ],
  },
  "toolbox-reg": {
    flatten: (rows) => (rows || []).map(flattenToolboxTalkRow),
    columns: [
      { k: "topic", l: "Topic" },
      { k: "date", l: "Date" },
      { k: "lead", l: "Presenter" },
      { k: "attendees", l: "Attendees" },
      { k: "project", l: "Project" },
    ],
  },
  cdm: {
    flatten: (rows) => (rows || []).map(flattenCdmPackRow),
    columns: [
      { k: "projectTitle", l: "Project" },
      { k: "clientName", l: "Client" },
      { k: "startDate", l: "Start" },
      { k: "cdmChecks", l: "CDM checks" },
      { k: "status", l: "Status" },
    ],
  },
  riddor: {
    flatten: (rows) => (rows || []).map(flattenRiddorRow),
    columns: [
      { k: "type", l: "Type" },
      { k: "incidentDate", l: "Incident date" },
      { k: "location", l: "Location" },
      { k: "status", l: "Status" },
      { k: "reportedToHSE", l: "Reported to HSE" },
    ],
  },
  observations: {
    flatten: (rows) => (rows || []).map(flattenObservationRow),
    columns: [
      { k: "date", l: "Date" },
      { k: "polarity", l: "Type" },
      { k: "project", l: "Project" },
      { k: "detail", l: "Observation" },
      { k: "observer", l: "Observer" },
    ],
  },
  "geo-photos": {
    detailExport: true,
    flatten: (rows) => (rows || []).map(flattenGeoPhotoRow),
    columns: [
      { k: "type", l: "Type" },
      { k: "project", l: "Project" },
      { k: "captured", l: "Captured" },
      { k: "coordinates", l: "Coordinates" },
      { k: "bearing", l: "Bearing" },
      { k: "extent", l: "Extent" },
      { k: "inReport", l: "In report" },
    ],
  },
};

export function prepareRegisterExport(moduleId, rawRows, { summary = false } = {}) {
  const adapter = REGISTER_PDF_ADAPTERS[moduleId];
  if (adapter?.flatten && (summary || !adapter.detailExport)) {
    return {
      mode: "table",
      rows: adapter.flatten(rawRows),
      columns: adapter.columns,
    };
  }
  if (adapter?.detailExport && !summary) {
    return { mode: "detail", moduleId, rows: rawRows || [] };
  }
  return { mode: "table", rows: rawRows || [], columns: adapter?.columns || null };
}

const fieldLabel = (key) => String(key).replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Full values for evidence pages; internal IDs and raw image bytes are excluded. */
export function formatRegisterDetailValue(value, key = "") {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item, index) => typeof item === "object" ? `${index + 1}. ${formatRegisterDetailValue(item)}` : String(item)).join("\n") || "—";
  if (typeof value === "object") return Object.entries(value).filter(([k]) => !["id", "deletedAt"].includes(k)).map(([k, v]) => `${fieldLabel(k)}: ${formatRegisterDetailValue(v, k)}`).join("\n") || "—";
  const text = String(value);
  if (text.startsWith("data:image/")) return "Image recorded";
  const isTimestamp = typeof value === "number" && /(?:At|Timestamp|timestamp)$/.test(key);
  if (isTimestamp || /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(text)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return text.length === 10 && !isTimestamp
      ? date.toLocaleDateString(getActiveDocumentLocale())
      : date.toLocaleString(getActiveDocumentLocale());
  }
  return /^[a-z]+(?:_[a-z]+)+$/.test(text) ? fieldLabel(text) : text;
}

/** One record per page, continuing long fields before the footer. */
export function renderRegisterRecordDetailPages(pdf, moduleId, rows, helpers) {
  const adapter = REGISTER_PDF_ADAPTERS[moduleId];
  const { drawPdfPageHeader, org, rgb, accentRgb, theme, label } = helpers;
  const margin = PDF_PAGE.MARGIN;
  const width = PDF_PAGE.W - margin * 2;
  let y;
  const startPage = (subtitle) => {
    y = drawPdfPageHeader(pdf, { org, title: label, subtitle, rgb, accentRgb, theme });
    y += 6;
  };
  const ensureSpace = (height) => {
    if (y + height <= PDF_PAGE.CONTENT_BOTTOM) return;
    pdf.addPage();
    startPage("Continued");
  };
  if (!rows.length) {
    startPage("No records");
    setPdfFont(pdf, "normal");
    pdf.setFontSize(9);
    pdf.text("No records in this export.", margin, y);
    return;
  }
  rows.forEach((row, index) => {
    if (index) pdf.addPage();
    startPage(row.name || row.item || row.equipmentName || row.equipmentId || row.batchRef || row.signerName || row.label || row.visitorName || `${index + 1} of ${rows.length}`);
    adapter.fields.forEach((key) => {
      if (row[key] == null || row[key] === "") return;
      ensureSpace(15);
      setPdfFont(pdf, "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...rgb);
      pdf.text(fieldLabel(key), margin, y);
      y += 5;
      setPdfFont(pdf, "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
      const lines = pdf.splitTextToSize(formatRegisterDetailValue(row[key], key), width - 4);
      for (const line of lines) {
        ensureSpace(5);
        setPdfFont(pdf, "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(30, 41, 59);
        pdf.text(String(line), margin + 2, y);
        y += 4.5;
      }
      y += 4;
    });
    const image = adapter.imageField && row[adapter.imageField];
    if (typeof image === "string" && image.startsWith("data:image/")) {
      ensureSpace(29);
      setPdfFont(pdf, "bold");
      pdf.setFontSize(8);
      pdf.text("Signature", margin, y);
      y += 4;
      try {
        const dimensions = pdf.getImageProperties(image);
        const scale = Math.min(80 / dimensions.width, 20 / dimensions.height);
        pdf.addImage(image, undefined, margin, y, dimensions.width * scale, dimensions.height * scale);
      } catch {
        pdf.text("Signature image could not be embedded.", margin, y + 5);
      }
      y += 25;
    }
  });
}

/**
 * Full A4 pages per briefing — attendance table with signature images.
 * @param {import("jspdf").jsPDF} pdf
 */
export function renderDailyBriefingDetailPages(pdf, briefings, helpers) {
  const { drawPdfPageHeader, org, rgb, accentRgb, theme, label } = helpers;
  const rows = briefings || [];
  const margin = PDF_PAGE.MARGIN;
  const contentW = PDF_PAGE.W - margin * 2;
  const bottomY = PDF_PAGE.CONTENT_BOTTOM;

  const fitLines = (value, width, maxLines) => {
    const text = String(value ?? "—");
    const lines = pdf.splitTextToSize(text, width);
    if (lines.length <= maxLines) return lines;
    const visible = lines.slice(0, maxLines);
    let last = visible[maxLines - 1];
    while (last && pdf.getTextWidth(`${last}…`) > width) last = last.slice(0, -1);
    visible[maxLines - 1] = `${last.trimEnd()}…`;
    return visible;
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(getActiveDocumentLocale(), { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return String(iso);
    }
  };

  const drawInfoGrid = (brief, yStart) => {
    const pairs = [
      ["Location", brief.location || "—"],
      ["Date", fmtDate(brief.date)],
      ["Time", brief.time || "—"],
      ["Conducted by", brief.conductedBy || "—"],
    ];
    if (brief.weatherConditions || brief.temperature) {
      pairs.push([
        "Weather",
        [brief.weatherConditions, brief.temperature ? `${brief.temperature}°C` : ""].filter(Boolean).join(" · "),
      ]);
    }
    const colW = contentW / 2;
    let y = yStart;
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    const gridH = Math.ceil(pairs.length / 2) * 11 + 4;
    pdf.roundedRect(margin, y, contentW, gridH, 2, 2, "FD");
    pairs.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + 4 + col * colW;
      const cy = y + 5 + row * 11;
      setPdfFont(pdf, "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...rgb);
      pdf.text(String(k).toUpperCase(), x, cy);
      setPdfFont(pdf, "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      pdf.text(fitLines(v, colW - 8, 2), x, cy + 3.8);
    });
    return y + gridH + 5;
  };

  const ensureSpace = (y, need, brief, docRef) => {
    if (y + need <= bottomY) return { y, continued: false };
    pdf.addPage();
    let ny = drawPdfPageHeader(pdf, {
      org,
      title: "Daily safety briefing (continued)",
      subtitle: brief.location || "",
      rgb,
      accentRgb,
      theme,
      docRef,
    });
    ny = drawPdfMetaStrip(pdf, org, { moduleLabel: "Daily briefing", docRef, recordNote: brief.location || "" }, rgb, ny);
    return { y: ny + 2, continued: true };
  };

  if (!rows.length) {
    const docRef = buildDocReference(org, label);
    let y = drawPdfPageHeader(pdf, {
      org,
      title: label,
      subtitle: "No briefing records",
      rgb,
      accentRgb,
      theme,
      docRef,
    });
    drawPdfMetaStrip(pdf, org, { moduleLabel: label, docRef, recordNote: "0 records" }, rgb, y);
    return;
  }

  rows.forEach((brief, index) => {
    if (index > 0) pdf.addPage();
    const docRef = buildDocReference(org, `Brief-${brief.date || index + 1}`);
    let y = drawPdfPageHeader(pdf, {
      org,
      title: "Daily safety briefing",
      subtitle: `${brief.location || "Site"} · ${fmtDate(brief.date)} · ${brief.time || ""}`.trim(),
      rgb,
      accentRgb,
      theme,
      docRef,
    });
    y = drawPdfMetaStrip(
      pdf,
      org,
      {
        moduleLabel: "Daily safety briefing",
        docRef,
        recordNote: `${(brief.attendees || []).filter((a) => a.present).length} attendees · ${brief.conductedBy || "—"}`,
      },
      rgb,
      y
    );
    y = drawInfoGrid(brief, y);

    const drawSectionHeading = (title, yy, continued = false) => {
      pdf.setFillColor(...rgb);
      pdf.rect(margin, yy, 2, 6, "F");
      setPdfFont(pdf, "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...rgb);
      pdf.text(continued ? `${title} (continued)` : title, margin + 4, yy + 4.5);
      return yy + 8;
    };

    const section = (title, bodyLines, yStart) => {
      let yy = yStart;
      let lineIndex = 0;
      let firstChunk = true;
      setPdfFont(pdf, "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      do {
        const remaining = bodyLines.length - lineIndex;
        const minimumNeed = Math.min(remaining, 1) * 3.8 + 14;
        const ensured = ensureSpace(yy, minimumNeed, brief, docRef);
        yy = ensured.y;
        if (!firstChunk || ensured.continued) yy = drawSectionHeading(`${title}`, yy, !firstChunk || ensured.continued);
        else yy = drawSectionHeading(title, yy);
        const capacity = Math.max(1, Math.floor((bottomY - yy - 5) / 3.8));
        const chunk = bodyLines.slice(lineIndex, lineIndex + capacity);
        pdf.text(chunk, margin + 2, yy);
        lineIndex += chunk.length;
        yy += chunk.length * 3.8 + 5;
        firstChunk = false;
      } while (lineIndex < bodyLines.length);
      return yy;
    };

    if (brief.scopeToday) {
      const scopeLines = pdf.splitTextToSize(String(brief.scopeToday), contentW - 4);
      y = section("TODAY'S SCOPE", scopeLines, y);
    }

    const topics = [...(brief.topics || [])];
    if (brief.customTopics?.trim()) topics.push(String(brief.customTopics).trim());
    if (topics.length) {
      const topicLines = topics.flatMap((t) => pdf.splitTextToSize(`• ${t}`, contentW - 6));
      y = section("TOPICS COVERED", topicLines, y);
    }

    if (brief.notes) {
      const noteLines = pdf.splitTextToSize(String(brief.notes), contentW - 4);
      y = section("NOTES / ACTIONS", noteLines, y);
    }

    y = ensureSpace(y, 20, brief, docRef).y;
    setPdfFont(pdf, "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...rgb);
    pdf.text("ATTENDANCE & SIGNATURES", margin, y);
    y += 6;

    const colW = [48, 30, 76, 32];
    const startX = margin;
    const drawAttendanceHeader = () => {
      pdf.setFillColor(...rgb);
      pdf.rect(startX, y, contentW, 7, "F");
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      ["Name", "Role", "Signature", "Time"].forEach((h, i) => {
        pdf.text(h, startX + colW.slice(0, i).reduce((s, w) => s + w, 0) + 2, y + 4.8);
      });
      y += 8;
    };
    drawAttendanceHeader();

    const present = (brief.attendees || []).filter((a) => a.present);
    present.forEach((att) => {
      const ensured = ensureSpace(y, 16, brief, docRef);
      y = ensured.y;
      if (ensured.continued) drawAttendanceHeader();
      const rowH = 15;
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(startX, y, contentW, rowH, "FD");
      setPdfFont(pdf, "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      let cx = startX + 2;
      pdf.text(fitLines(att.name || "—", colW[0] - 4, 2), cx, y + 5);
      cx += colW[0];
      pdf.text(fitLines(att.role || "—", colW[1] - 4, 2), cx, y + 5);
      cx += colW[1];
      if (att.sig && String(att.sig).startsWith("data:image")) {
        try {
          pdf.addImage(String(att.sig), "PNG", cx + 1, y + 2, 40, 11, undefined, "FAST");
        } catch {
          pdf.setFontSize(7);
          pdf.setTextColor(100, 116, 139);
          pdf.text("Signed", cx + 2, y + 8);
        }
      } else {
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text("—", cx + 2, y + 8);
      }
      cx += colW[2];
      if (att.sigTime) {
        try {
          const t = new Date(att.sigTime).toLocaleTimeString(getActiveDocumentLocale(), { hour: "2-digit", minute: "2-digit" });
          pdf.setFontSize(7.5);
          pdf.setTextColor(30, 41, 59);
          pdf.text(t, cx + 1, y + 8);
        } catch {
          /* ignore */
        }
      }
      y += rowH + 1;
    });

    if (!present.length) {
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("No attendees marked present.", startX + 2, y + 4);
    }
  });
}

/**
 * Geo-photo gallery PDF — up to two photos per A4 page with image, GPS and bearing.
 * @param {import("jspdf").jsPDF} pdf
 */
export function renderGeoPhotoDetailPages(pdf, photos, helpers) {
  const { drawPdfPageHeader, renderRegisterTable, org, rgb, theme, label } = helpers;
  const rows = photos || [];

  if (!rows.length) {
    let y = drawPdfPageHeader(pdf, {
      org,
      title: label,
      subtitle: "No geo-photos in this export",
      rgb,
      theme,
    });
    renderRegisterTable(pdf, {
      rows: [],
      columns: REGISTER_PDF_ADAPTERS["geo-photos"].columns,
      sectionTitle: label,
      org,
      rgb,
      theme,
      startY: y + 2,
    });
    return;
  }

  rows.forEach((photo, index) => {
    if (index > 0) pdf.addPage();
    const preset = geoPhotoPresetLabel(photo.type);
    const subtitle = `${photo.projectName || "Site"} · ${preset}`;
    let y = drawPdfPageHeader(pdf, {
      org,
      title: "Geo-photo",
      subtitle,
      rgb,
      theme,
    });
    y += 4;

    const imgUrl = geoPhotoDisplayUrl(photo);
    const imgW = 186;
    const imgH = 105;
    if (imgUrl) {
      const added = tryAddGeoPhotoImage(pdf, imgUrl, 12, y, imgW, imgH);
      if (!added) {
        setPdfFont(pdf, "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text("Image could not be embedded (use on-device capture or synced URL).", 12, y + 8);
      }
      y += (added?.height || imgH) + 6;
    }

    setPdfFont(pdf, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const meta = [
      `Captured: ${photo.timestampUtc ? new Date(photo.timestampUtc).toLocaleString(getActiveDocumentLocale()) : "—"}`,
      photo.capturedBy ? `By: ${photo.capturedBy}` : "",
      `Coordinates: ${formatCoords(photo)}`,
      photo.bearing != null && !Number.isNaN(Number(photo.bearing))
        ? `Bearing: ${Math.round(Number(photo.bearing))}°`
        : "",
      geoPhotoAreaOf(photo) ? `Extent traced on site: ${formatGeoPhotoArea(photo.area)}` : "",
      photo.includeInReport ? "Included in survey report pack" : "",
    ].filter(Boolean);
    const contentBottom = PDF_PAGE.CONTENT_BOTTOM - 2;
    const lineHeight = 4.2;
    const startContinuationPage = (title = "Geo-photo (continued)") => {
      pdf.addPage();
      y = drawPdfPageHeader(pdf, { org, title, subtitle, rgb, theme }) + 4;
    };
    const drawWrappedLines = (lines, { fontSize = 8.5, bold = false } = {}) => {
      setPdfFont(pdf, bold ? "bold" : "normal");
      pdf.setFontSize(fontSize);
      let cursor = 0;
      while (cursor < lines.length) {
        const room = Math.floor((contentBottom - y) / lineHeight);
        if (room < 1) {
          startContinuationPage();
          continue;
        }
        const chunk = lines.slice(cursor, cursor + room);
        pdf.text(chunk, 12, y, { lineHeightFactor: 1.25 });
        y += chunk.length * lineHeight;
        cursor += chunk.length;
        if (cursor < lines.length) startContinuationPage();
      }
    };
    meta.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, 186);
      drawWrappedLines(Array.isArray(wrapped) ? wrapped : [wrapped], { fontSize: 9 });
    });

    if (photo.notes?.trim()) {
      const noteLines = pdf.splitTextToSize(String(photo.notes).trim(), 186);
      const wrappedNoteLines = Array.isArray(noteLines) ? noteLines : [noteLines];
      const availableNoteLines = Math.floor((contentBottom - y - 3) / lineHeight);
      if (wrappedNoteLines.length + 1 > availableNoteLines) startContinuationPage();
      y += 2;
      drawWrappedLines(["NOTES"], { fontSize: 8, bold: true });
      y += 1;
      drawWrappedLines(wrappedNoteLines);
    }
  });
}

export function dailyBriefingHtmlForPrint(brief) {
  const topicsHTML = (brief.topics || []).map((t) => `<li>${he(t)}</li>`).join("");
  const customTopicHTML = brief.customTopics ? `<li><em>${he(brief.customTopics)}</em></li>` : "";
  const attendeeRows = (brief.attendees || [])
    .filter((a) => a.present)
    .map((a) => {
      const sig = a.sig && String(a.sig).startsWith("data:image") ? a.sig : "";
      return `<tr><td>${he(a.name)}</td><td>${he(a.role || "")}</td><td>${sig ? `<img src="${sig}" style="height:36px;max-width:140px"/>` : ""}</td><td>${a.sigTime ? he(new Date(a.sigTime).toLocaleTimeString(getActiveDocumentLocale(), { hour: "2-digit", minute: "2-digit" })) : ""}</td></tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Briefing ${he(brief.date)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;font-size:11px}th{background:#f5f5f5}</style></head><body>
  <h1>Daily Safety Briefing</h1>
  <p><strong>Location:</strong> ${he(brief.location)} · <strong>Date:</strong> ${he(brief.date)} ${he(brief.time || "")}<br/>
  <strong>Conducted by:</strong> ${he(brief.conductedBy || "—")}</p>
  ${brief.scopeToday ? `<h3>Scope</h3><p>${he(brief.scopeToday)}</p>` : ""}
  <h3>Topics</h3><ul>${topicsHTML}${customTopicHTML}</ul>
  ${brief.notes ? `<h3>Notes</h3><p>${he(brief.notes)}</p>` : ""}
  <h3>Attendance</h3><table><thead><tr><th>Name</th><th>Role</th><th>Signature</th><th>Time</th></tr></thead><tbody>${attendeeRows}</tbody></table>
  </body></html>`;
}
