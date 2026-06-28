/**
 * Per-module PDF export adapters — flatten nested registers & full-detail exports.
 */

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
