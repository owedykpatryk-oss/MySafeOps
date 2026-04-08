/**
 * Shared RAMS → print HTML + fingerprint (used by builder and public share view).
 */
import { getRiskLevel } from "./ramsAllHazards";
import { normalizePrintSections, RAMS_SECTION_IDS, documentContentHash } from "./ramsSectionConfig";

const RL = {
  high: { bg: "#FCEBEB", color: "#791F1F" },
  medium: { bg: "#FAEEDA", color: "#633806" },
  low: { bg: "#EAF3DE", color: "#27500A" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Human-readable competency line from Workers record (certs text + structured certifications). */
export function formatOperativeCertsLine(w) {
  if (!w) return "";
  const parts = [];
  if (w.certs?.trim()) parts.push(w.certs.trim());
  (w.certifications || []).forEach((c) => {
    if (c?.certType && c?.expiryDate) {
      parts.push(`${c.certType} (exp. ${fmtDate(c.expiryDate)})`);
    } else if (c?.certType) {
      parts.push(c.certType);
    }
  });
  return parts.join(" · ");
}

function escHtml(s) {
  if (s == null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ramsHashPayload(form, rows) {
  return {
    title: form.title,
    location: form.location,
    scope: form.scope,
    date: form.date,
    siteWeatherNote: form.siteWeatherNote,
    siteMapUrl: form.siteMapUrl,
    siteLat: form.siteLat,
    siteLng: form.siteLng,
    nearestHospital: form.nearestHospital,
    hospitalDirectionsUrl: form.hospitalDirectionsUrl,
    printSections: form.printSections,
    operativeIds: form.operativeIds || [],
    rows: (rows || []).map((r) => ({
      id: r.id,
      activity: r.activity,
      hazard: r.hazard,
      initialRisk: r.initialRisk,
      revisedRisk: r.revisedRisk,
      controlMeasures: r.controlMeasures,
    })),
  };
}

export function computeRamsFingerprint(form, rows) {
  return documentContentHash(ramsHashPayload(form, rows));
}

export function generatePrintHTML(form, rows, operatives, projectMap, printFlags, contentFingerprint, workersAll) {
  const rowList = rows || [];
  const opList = operatives || [];
  const pf = printFlags || normalizePrintSections({});
  const projName = form.projectId ? projectMap[form.projectId] || "" : "";

  const rowsHTML = rowList
    .map(
      (r) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e5e5;font-weight:500;vertical-align:top;font-size:12px">${escHtml(r.activity)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:top;font-size:12px">${escHtml(r.hazard)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;vertical-align:top;font-size:12px;background:${RL[getRiskLevel(r.initialRisk)]?.bg}">${r.initialRisk.L}<br/>${r.initialRisk.S}<br/><strong>${r.initialRisk.L * r.initialRisk.S}</strong></td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:top;font-size:11px"><ol style="margin:0;padding-left:16px">${(r.controlMeasures || []).map((cm) => `<li style="margin-bottom:4px">${escHtml(cm)}</li>`).join("")}</ol></td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;vertical-align:top;font-size:12px;background:${RL[getRiskLevel(r.revisedRisk)]?.bg}">${r.revisedRisk.L}<br/>${r.revisedRisk.S}<br/><strong>${r.revisedRisk.L * r.revisedRisk.S}</strong></td>
    </tr>`
    )
    .join("");

  const sigRows = opList
    .map(
      (n) => `
    <tr style="height:40px">
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:12px">${escHtml(n)}</td>
      <td style="border:1px solid #e5e5e5"></td>
      <td style="border:1px solid #e5e5e5"></td>
    </tr>`
    )
    .join("");

  const weatherBlock =
    pf[RAMS_SECTION_IDS.WEATHER] && (form.siteWeatherNote || "").trim()
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Site weather</h2>
         <p style="font-size:12px;white-space:pre-wrap;margin:0 0 12px">${escHtml(form.siteWeatherNote)}</p>`
      : "";

  const mapBlock =
    pf[RAMS_SECTION_IDS.MAP] &&
    ((form.siteMapUrl || "").trim() || ((form.siteLat || "").trim() && (form.siteLng || "").trim()))
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Map / location</h2>
         ${(form.siteMapUrl || "").trim() ? `<p style="font-size:12px;word-break:break-all"><a href="${escHtml(form.siteMapUrl)}">${escHtml(form.siteMapUrl)}</a></p>` : ""}
         ${(form.siteLat || "").trim() && (form.siteLng || "").trim()
        ? `<p style="font-size:12px">Coordinates: ${escHtml(form.siteLat)}, ${escHtml(form.siteLng)}</p>`
        : ""}`
      : "";

  const hospitalBlock =
    pf[RAMS_SECTION_IDS.HOSPITAL] &&
    ((form.nearestHospital || "").trim() || (form.hospitalDirectionsUrl || "").trim())
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Nearest A&amp;E / hospital</h2>
         ${(form.nearestHospital || "").trim() ? `<p style="font-size:12px;margin:4px 0">${escHtml(form.nearestHospital)}</p>` : ""}
         ${(form.hospitalDirectionsUrl || "").trim()
        ? `<p style="font-size:12px;word-break:break-all"><a href="${escHtml(form.hospitalDirectionsUrl)}">Directions</a></p>`
        : ""}`
      : "";

  const operativeCertsBlock =
    pf[RAMS_SECTION_IDS.OPERATIVE_CERTS] &&
    workersAll?.length &&
    (form.operativeIds || []).length > 0
      ? (() => {
          const selected = (form.operativeIds || [])
            .map((id) => workersAll.find((w) => w.id === id))
            .filter(Boolean);
          if (!selected.length) return "";
          const certRows = selected
            .map(
              (w) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:12px;font-weight:500;vertical-align:top">${escHtml(w.name)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;vertical-align:top">${escHtml(w.role || "—")}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;vertical-align:top">${escHtml(formatOperativeCertsLine(w) || "—")}</td>
    </tr>`
            )
            .join("");
          return `<h2 style="font-size:13px;margin:18px 0 8px">Operative competencies</h2>
  <p style="font-size:10px;color:#666;margin:0 0 8px">From Workers module — verify training and expiry on site.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:22%">Name</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:18%">Role</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Certificates / notes</th>
    </tr></thead>
    <tbody>${certRows}</tbody>
  </table>`;
        })()
      : "";

  const riskTable =
    pf[RAMS_SECTION_IDS.HAZARDS] && rowList.length > 0
      ? `<table class="ra">
    <thead><tr>
      <th style="width:18%">Activity</th>
      <th style="width:18%">Additional hazard</th>
      <th style="width:10%">Risk factor<br/>L / S / RF</th>
      <th style="width:40%">Control measures</th>
      <th style="width:10%">Revised RF<br/>L / S / RF</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>`
      : "";

  const sigTable =
    pf[RAMS_SECTION_IDS.SIGNATURES] && opList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Operative signatures</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Name</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Signature</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Date</th>
    </tr></thead>
    <tbody>${sigRows}</tbody>
  </table>`
      : "";

  const integrityBlock =
    pf[RAMS_SECTION_IDS.INTEGRITY] && contentFingerprint
      ? `<p style="font-size:10px;color:#555;margin-top:16px;font-family:Consolas,monospace">Document fingerprint: ${escHtml(contentFingerprint)}</p>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(form.title)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:20px}
    h1{font-size:16px;font-weight:bold;text-align:center;background:#f97316;color:#fff;padding:10px;margin:0 0 16px}
    .header-table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .header-table td{padding:4px 8px;font-size:11px;border:0.5px solid #ccc}
    .header-table .lbl{color:#666;font-weight:bold}
    table.ra{width:100%;border-collapse:collapse;margin-bottom:20px}
    table.ra th{background:#0f172a;color:#fff;padding:8px;font-size:11px;text-align:left;border:1px solid #0f172a}
    @media print{body{padding:10px}h1,h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <table class="header-table"><tr>
    <td><span class="lbl">Location:</span> ${escHtml(form.location)}</td>
    <td><span class="lbl">Project:</span> ${escHtml(projName || "—")}</td>
    <td><span class="lbl">Job reference:</span> ${escHtml(form.jobRef || "—")}</td>
  </tr><tr>
    <td><span class="lbl">Date:</span> ${escHtml(fmtDate(form.date))}</td>
    <td colspan="2"><span class="lbl">Lead engineer:</span> ${escHtml(form.leadEngineer || "—")}</td>
  </tr></table>
  <h1>${escHtml(form.title)}</h1>
  ${form.scope ? `<p style="font-size:12px;margin-bottom:16px">${escHtml(form.scope)}</p>` : ""}
  ${weatherBlock}
  ${mapBlock}
  ${hospitalBlock}
  ${operativeCertsBlock}
  ${riskTable}
  ${sigTable}
  <p style="font-size:10px;color:#888;margin-top:20px">Generated by MySafeOps · REVISION ${escHtml(form.revision || "1A")} · Review due: ${escHtml(fmtDate(form.reviewDate) || "—")}</p>
  ${integrityBlock}
  </body></html>`;
}

/** Open print dialog for a saved RAMS document (same output as builder preview print). */
export function openRamsPrintWindow(form, rows, workers, projects) {
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const operatives = (form.operativeIds || []).map((id) => workerMap[id]).filter(Boolean);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const pf = normalizePrintSections(form.printSections);
  const fp = computeRamsFingerprint(form, rows);
  const win = window.open("", "_blank");
  win.document.write(generatePrintHTML(form, rows || [], operatives, projectMap, pf, fp, workers));
  win.document.close();
  win.print();
}
