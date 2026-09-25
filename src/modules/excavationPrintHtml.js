import { escapeHtml, openPrintWindowOrWarn, writePrintWindowDocument } from "../utils/htmlEscape";
import { wrapPrintHtmlDocument } from "../utils/pdfBranding.js";
import { getOrgSettings } from "../utils/orgSettingsStorage";

import { todayLocalISO } from "../utils/localDate";
const STATUS_LABEL = {
  open: "Open",
  backfilled: "Backfilled / closed",
  suspended: "Suspended",
};

/**
 * A4 print HTML for a single excavation / permit-to-dig record.
 * @param {object} r
 * @param {{ orgName?: string }} [opts]
 */
export function buildExcavationPrintHtml(r, opts = {}) {
  const org = getOrgSettings();
  const status = STATUS_LABEL[r.status] || r.status || "—";
  const yesNo = (v) => (v ? "Yes" : "No");
  const row = (label, value) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "—")}</td></tr>`;

  const bodyHtml = `
  ${!r.utilitiesConfirmed ? `<div class="rf-callout rf-callout--warn">Underground services / CAT scan not confirmed on this record.</div>` : ""}
  <div class="print-kpi-grid">
    <div class="print-kpi"><div class="print-kpi__l">Permit / PTD ref</div><div class="print-kpi__v">${escapeHtml(r.permitRef || "—")}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Date</div><div class="print-kpi__v">${escapeHtml(r.workDate || "—")}</div></div>
    <div class="print-kpi"><div class="print-kpi__l">Status</div><div class="print-kpi__v">${escapeHtml(status)}</div></div>
  </div>
  <div class="print-section-title">Work</div>
  <table class="rf-kv">
    ${row("Work description", r.workDescription)}
    ${row("Location", r.location)}
    ${row("Project", r.projectName)}
  </table>
  <div class="print-section-title">Ground conditions & support</div>
  <table class="rf-kv">
    ${row("Max depth (m)", r.maxDepth)}
    ${row("Support / battering", r.shoringSystem)}
    ${row("Banksman / spotter", r.banksmanName)}
  </table>
  <div class="print-section-title">Utilities</div>
  <table class="rf-kv">
    ${row("Services search / CAT complete", yesNo(r.utilitiesConfirmed))}
    ${row("Utility search reference", r.utilitySearchRef)}
  </table>
  ${r.notes ? `<div class="print-section-title">Notes</div><div class="rf-notes">${escapeHtml(r.notes)}</div>` : ""}`;

  return wrapPrintHtmlDocument(org, {
    pageTitle: `Excavation — ${r.permitRef || r.id || "record"}`,
    extraCss: `
      .rf-kv { width:100%; border-collapse:collapse; margin:0 0 10px; }
      .rf-kv th, .rf-kv td { border:1px solid #e2e8f0; padding:8px 10px; text-align:left; vertical-align:top; font-size:12px; }
      .rf-kv th { width:34%; background:#f8fafc; color:#475569; font-weight:650; }
      .rf-notes { white-space:pre-wrap; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; background:#f8fafc; font-size:12px; line-height:1.45; }
      .rf-callout { border-radius:8px; padding:10px 12px; margin:0 0 14px; font-size:12px; font-weight:650; }
      .rf-callout--warn { background:#fffbeb; border:1px solid #fde68a; color:#854d0e; }
      @media print { .rf-kv th, .rf-callout, .print-kpi { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    `,
    headerOpts: {
      docTitle: "Excavation / permit-to-dig record",
      docSubtitle: `${opts.orgName || org?.name || "MySafeOps"} · ${r.workDate || todayLocalISO()}`,
      docBadge: "EXCAVATION",
    },
    metaFields: { recordNote: status },
    footerExtra: "Verify live permit-to-dig before intrusive works",
    bodyHtml,
  });
}

/** Open print dialog for a single excavation record. */
export function printExcavationRecord(r, opts = {}) {
  const html = buildExcavationPrintHtml(r, opts);
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
