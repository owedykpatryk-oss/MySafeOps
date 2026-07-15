import { escapeHtml, openPrintWindowOrWarn, writePrintWindowDocument } from "../utils/htmlEscape";

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
  const org = escapeHtml(opts.orgName || "MySafeOps");
  const status = STATUS_LABEL[r.status] || r.status || "—";
  const yesNo = (v) => (v ? "Yes" : "No");
  const row = (label, value) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "—")}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Excavation — ${escapeHtml(r.permitRef || r.id || "record")}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; margin: 0 0 16px; font-size: 11px; }
  .banner { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 14px; }
  .badge { background: #ccfbf1; color: #115e59; border: 1px solid #5eead4; border-radius: 6px; padding: 4px 8px; font-weight: 700; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { width: 32%; background: #f8fafc; color: #475569; font-weight: 600; }
  .section { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #0f766e; margin: 16px 0 6px; }
  .warn { background: #fffbeb; border: 1px solid #fde68a; color: #854d0e; padding: 8px 10px; border-radius: 8px; margin: 10px 0; }
  .notes { white-space: pre-wrap; }
  .foot { margin-top: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
  <div class="banner">
    <div>
      <h1>Excavation / permit-to-dig record</h1>
      <p class="sub">${org} · ${escapeHtml(r.workDate || "")} · ${escapeHtml(status)}</p>
    </div>
    <div class="badge">EX</div>
  </div>

  ${!r.utilitiesConfirmed ? `<div class="warn">Underground services / CAT scan not confirmed on this record.</div>` : ""}

  <div class="section">Work</div>
  <table>
    ${row("Permit / PTD ref", r.permitRef)}
    ${row("Work description", r.workDescription)}
    ${row("Location", r.location)}
    ${row("Project", r.projectName)}
    ${row("Date", r.workDate)}
    ${row("Status", status)}
  </table>

  <div class="section">Ground conditions & support</div>
  <table>
    ${row("Max depth (m)", r.maxDepth)}
    ${row("Support / battering", r.shoringSystem)}
    ${row("Banksman / spotter", r.banksmanName)}
  </table>

  <div class="section">Utilities</div>
  <table>
    ${row("Services search / CAT complete", yesNo(r.utilitiesConfirmed))}
    ${row("Utility search reference", r.utilitySearchRef)}
  </table>

  ${r.notes ? `<div class="section">Notes</div><div class="notes">${escapeHtml(r.notes)}</div>` : ""}

  <div class="foot">Generated ${escapeHtml(new Date().toISOString().slice(0, 10))} · MySafeOps excavation log — verify live permit-to-dig before intrusive works.</div>
</body>
</html>`;
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
