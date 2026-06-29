/**
 * Per-module PDF export adapters — flatten nested registers & full-detail exports.
 */
import { geoPhotoPresetLabel } from "./geoPhotoPresets";
import { geoPhotoDisplayUrl } from "./geoPhotoMedia";

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
      ? new Date(photo.timestampUtc).toLocaleString("en-GB", {
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
    pdf.addImage(String(url), geoPhotoImageFormat(url), x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

/** @type {Record<string, { flatten?: (rows: object[]) => object[]; columns: { k: string; l: string }[]; detailExport?: boolean }>} */
export const REGISTER_PDF_ADAPTERS = {
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
  return { mode: "table", rows: rawRows || [], columns: null };
}

/**
 * Full A4 pages per briefing — attendance table with signature images.
 * @param {import("jspdf").jsPDF} pdf
 */
export function renderDailyBriefingDetailPages(pdf, briefings, helpers) {
  const { drawPdfPageHeader, renderRegisterTable, org, rgb, theme, label } = helpers;
  const rows = briefings || [];

  if (!rows.length) {
    let y = drawPdfPageHeader(pdf, {
      org,
      title: label,
      subtitle: "No briefing records",
      rgb,
      theme,
    });
    renderRegisterTable(pdf, {
      rows: [],
      columns: REGISTER_PDF_ADAPTERS["daily-briefing"].columns,
      sectionTitle: label,
      org,
      rgb,
      theme,
      startY: y + 2,
    });
    return;
  }

  rows.forEach((brief, index) => {
    if (index > 0) pdf.addPage();
    let y = drawPdfPageHeader(pdf, {
      org,
      title: "Daily safety briefing",
      subtitle: `${brief.location || "Site"} · ${brief.date || ""} ${brief.time || ""}`.trim(),
      rgb,
      theme,
    });
    y += 2;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const meta = [
      `Conducted by: ${brief.conductedBy || "—"}`,
      brief.weatherConditions ? `Weather: ${brief.weatherConditions}${brief.temperature ? ` · ${brief.temperature}°C` : ""}` : "",
    ].filter(Boolean);
    meta.forEach((line) => {
      pdf.text(line, 12, y);
      y += 4.5;
    });
    y += 2;

    if (brief.scopeToday) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("TODAY'S SCOPE", 12, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      const scopeLines = pdf.splitTextToSize(String(brief.scopeToday), 186);
      pdf.text(scopeLines, 12, y);
      y += scopeLines.length * 3.8 + 4;
    }

    const topics = [...(brief.topics || [])];
    if (brief.customTopics?.trim()) topics.push(String(brief.customTopics).trim());
    if (topics.length) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("TOPICS COVERED", 12, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      topics.forEach((t) => {
        const lines = pdf.splitTextToSize(`• ${t}`, 184);
        pdf.text(lines, 12, y);
        y += lines.length * 3.6;
      });
      y += 3;
    }

    if (brief.notes) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("NOTES / ACTIONS", 12, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      const noteLines = pdf.splitTextToSize(String(brief.notes), 186);
      pdf.text(noteLines, 12, y);
      y += noteLines.length * 3.6 + 4;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("ATTENDANCE & SIGNATURES", 12, y);
    y += 5;

    const present = (brief.attendees || []).filter((a) => a.present);
    const colW = [52, 32, 78, 28];
    const startX = 12;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(startX, y, 186, 6, "F");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    ["Name", "Role", "Signature", "Time"].forEach((h, i) => {
      pdf.text(h, startX + colW.slice(0, i).reduce((s, w) => s + w, 0) + 1.5, y + 4.2);
    });
    y += 7;

    present.forEach((att) => {
      if (y > 268) {
        pdf.addPage();
        y = drawPdfPageHeader(pdf, {
          org,
          title: "Daily safety briefing (continued)",
          subtitle: brief.location || "",
          rgb,
          theme,
        });
        y += 8;
      }
      const rowH = 14;
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(startX, y, 186, rowH);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      pdf.text(String(att.name || "").slice(0, 28), startX + 2, y + 5);
      pdf.text(String(att.role || "").slice(0, 18), startX + colW[0] + 2, y + 5);
      if (att.sig && String(att.sig).startsWith("data:image")) {
        try {
          pdf.addImage(String(att.sig), "PNG", startX + colW[0] + colW[1] + 2, y + 2, 36, 10, undefined, "FAST");
        } catch {
          pdf.text("Signed", startX + colW[0] + colW[1] + 2, y + 5);
        }
      }
      if (att.sigTime) {
        try {
          const t = new Date(att.sigTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          pdf.text(t, startX + colW[0] + colW[1] + colW[2] + 2, y + 5);
        } catch {
          /* ignore */
        }
      }
      y += rowH;
    });

    if (!present.length) {
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("No attendees marked present.", startX, y + 3);
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
    let y = drawPdfPageHeader(pdf, {
      org,
      title: "Geo-photo",
      subtitle: `${photo.projectName || "Site"} · ${preset}`,
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
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text("Image could not be embedded (use on-device capture or synced URL).", 12, y + 8);
      }
      y += imgH + 6;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const meta = [
      `Captured: ${photo.timestampUtc ? new Date(photo.timestampUtc).toLocaleString("en-GB") : "—"}`,
      photo.capturedBy ? `By: ${photo.capturedBy}` : "",
      `Coordinates: ${formatCoords(photo)}`,
      photo.bearing != null && !Number.isNaN(Number(photo.bearing))
        ? `Bearing: ${Math.round(Number(photo.bearing))}°`
        : "",
      photo.includeInReport ? "Included in survey report pack" : "",
    ].filter(Boolean);
    meta.forEach((line) => {
      pdf.text(line, 12, y);
      y += 4.5;
    });

    if (photo.notes?.trim()) {
      y += 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("NOTES", 12, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      const noteLines = pdf.splitTextToSize(String(photo.notes).trim(), 186);
      pdf.text(noteLines, 12, y);
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
      return `<tr><td>${he(a.name)}</td><td>${he(a.role || "")}</td><td>${sig ? `<img src="${sig}" style="height:36px;max-width:140px"/>` : ""}</td><td>${a.sigTime ? he(new Date(a.sigTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })) : ""}</td></tr>`;
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
