/**
 * FESS Group — 5-page method statement print layout (MC reference structure).
 * Org-exclusive: used when isFessOrg() is true.
 */
import { escapeHtml as escHtml } from "./htmlEscape";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { getFessBrandLogoSrc } from "./fessBranding";
import { getActiveDocumentLocale } from "./countryWorkspaces";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(getActiveDocumentLocale(), { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

const pageStyle = `
  .fess-ms-page { margin-bottom: 18px; }
  .fess-ms-page + .fess-ms-page { page-break-before: always; break-before: page; }
  .fess-ms-brand-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #f97316; }
  .fess-ms-logo { height: 40px; width: auto; max-width: 150px; object-fit: contain; }
  .fess-ms-brand { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #c2410c; }
  .fess-ms-h { font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  .fess-ms-sub { font-size: 10px; color: #64748b; margin: 0 0 10px; }
  .fess-ms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .fess-ms-cell { border: 0.5px solid #e2e8f0; padding: 8px 10px; border-radius: 8px; background: #fff; font-size: 12px; }
  .fess-ms-cell .l { font-size: 10px; color: #64748b; font-weight: 700; margin-bottom: 2px; }
  table.fess-ms { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 12px; }
  table.fess-ms th { background: #0f172a; color: #fff; padding: 6px 8px; font-size: 11px; text-align: left; border: 1px solid #0f172a; }
  table.fess-ms td { padding: 6px 8px; border: 1px solid #e5e5e5; font-size: 11px; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
  table.fess-ms tr { break-inside: avoid-page; page-break-inside: avoid; }
`;

/**
 * @param {object} form MS document
 * @param {string[]} operatives
 * @param {object[]} [coshhItems]
 * @param {object} [linkedRams]
 */
export function buildFessMethodStatementPackHtml(form, operatives = [], coshhItems = [], linkedRams = null) {
  if (!canUseFessExclusiveFeatures()) return "";
  const he = escHtml;
  const steps = Array.isArray(form.steps) ? form.steps : [];
  const coshh = Array.isArray(coshhItems) ? coshhItems : [];
  const ppe = Array.isArray(form.ppeRequired) ? form.ppeRequired : [];

  const stepsRows = steps
    .map(
      (s) => `<tr>
      <td style="text-align:center;font-weight:700;width:36px">${he(String(s.seq || ""))}</td>
      <td style="font-weight:600;width:22%">${he(s.title || "")}</td>
      <td>${he(s.description || "")}</td>
      <td>${he(s.responsible || "")}</td>
      <td>${he(s.duration || "")}</td>
    </tr>`
    )
    .join("");

  const coshhRows = coshh.length
    ? coshh
        .slice(0, 24)
        .map(
          (c) => `<tr>
        <td>${he(c.name || "")}</td>
        <td>${he((c.hazardTypes || []).join(", ") || "—")}</td>
        <td>${he((c.ppeRequired || []).join(", ") || "—")}</td>
        <td>${he(c.storageLocation || "—")}</td>
        <td>${he(c.sdsUrl ? "SDS on file" : "Attach SDS")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="color:#64748b">No substances in COSHH register — add before issue on live food sites.</td></tr>`;

  const sigRows = (() => {
    const rows = Array.isArray(operatives) ? operatives : [];
    if (!rows.length) {
      return `<tr style="height:40px"><td> </td><td></td><td></td><td></td><td></td></tr>`;
    }
    const isRich = rows.some((r) => r && typeof r === "object" && r.name);
    if (isRich) {
      return rows
        .map(
          (r) => `<tr style="height:40px">
        <td>${he(r.name || "—")}</td>
        <td style="font-size:10px">${he(r.certs || "—")}</td>
        <td style="font-size:10px">${he(r.certExpiry || "—")}${r.certAlert ? `<br><span style="color:#b45309">${he(r.certAlert)}</span>` : ""}</td>
        <td></td>
        <td></td>
      </tr>`
        )
        .join("");
    }
    return rows
      .map(
        (n) => `<tr style="height:40px">
      <td>${he(typeof n === "string" ? n : n?.name || " ")}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>`
      )
      .join("");
  })();

  const clientLine = linkedRams?.clientApproval?.at
    ? `<tr>
        <td class="l">Client portal approval</td>
        <td colspan="3">${he(linkedRams.clientApproval.by || "—")} · ${he(fmtDate(linkedRams.clientApproval.at))}${linkedRams.clientApproval.notes ? ` — ${he(linkedRams.clientApproval.notes)}` : ""}</td>
      </tr>`
    : "";

  const logoSrc = getFessBrandLogoSrc();

  return `<style>${pageStyle}</style>
  <div class="fess-ms-pack">
    <div class="fess-ms-page">
      <div class="fess-ms-brand-row">
        <div>
          <div class="fess-ms-brand">FESS Group · Method statement</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">Food factory M&amp;E · controlled issue</div>
        </div>
        <img class="fess-ms-logo" src="${escHtml(logoSrc)}" alt="FESS Group" />
      </div>
      <div class="fess-ms-h">Page 1 — Mobilisation &amp; document control</div>
      <div class="fess-ms-sub">Standard 5-page layout mapped from FESS MC references</div>
      <div class="fess-ms-grid">
        <div class="fess-ms-cell"><div class="l">Title</div>${he(form.title || "Method statement")}</div>
        <div class="fess-ms-cell"><div class="l">Location</div>${he(form.location || "—")}</div>
        <div class="fess-ms-cell"><div class="l">Client</div>${he(form.client || "—")}</div>
        <div class="fess-ms-cell"><div class="l">Job reference</div>${he(form.jobRef || "—")}</div>
        <div class="fess-ms-cell"><div class="l">Date / revision</div>${he(fmtDate(form.date))} · Rev ${he(form.revision || "1A")}</div>
        <div class="fess-ms-cell"><div class="l">Lead engineer</div>${he(form.leadEngineer || "—")}</div>
      </div>
      ${form.scope ? `<p style="font-size:12px;line-height:1.55;margin:0 0 10px"><strong>Scope:</strong> ${he(form.scope)}</p>` : ""}
      ${form.restrictions ? `<p style="font-size:12px;line-height:1.55;margin:0 0 10px"><strong>Restrictions:</strong> ${he(form.restrictions)}</p>` : ""}
      <p style="font-size:11px;color:#475569;line-height:1.5;margin:0">Pre-start: sign in, hygiene checks, RAMS briefing, permit and line clearance confirmed with site permit controller before intrusive work.</p>
    </div>

    <div class="fess-ms-page">
      <div class="fess-ms-h">Page 2 — Sequence of works</div>
      <table class="fess-ms">
        <thead><tr>
          <th>Step</th><th>Activity</th><th>Description</th><th>Responsible</th><th>Duration</th>
        </tr></thead>
        <tbody>${stepsRows || `<tr><td colspan="5">Add work sequence steps in Method Statement editor.</td></tr>`}</tbody>
      </table>
      ${(form.plant || []).length ? `<p style="font-size:11px"><strong>Plant:</strong> ${(form.plant || []).map((p) => he(p)).join(" · ")}</p>` : ""}
      ${(form.materials || []).length ? `<p style="font-size:11px"><strong>Materials:</strong> ${(form.materials || []).map((m) => he(m)).join(" · ")}</p>` : ""}
    </div>

    <div class="fess-ms-page">
      <div class="fess-ms-h">Page 3 — COSHH assessment</div>
      <div class="fess-ms-sub">Substances used or brought on site — SDS must be available before work starts</div>
      <table class="fess-ms">
        <thead><tr>
          <th>Substance</th><th>Hazards</th><th>PPE</th><th>Storage</th><th>SDS</th>
        </tr></thead>
        <tbody>${coshhRows}</tbody>
      </table>
    </div>

    <div class="fess-ms-page">
      <div class="fess-ms-h">Page 4 — Approvals &amp; permit sign-off</div>
      <table class="fess-ms">
        <tbody>
          <tr><td class="l" style="width:28%;font-weight:700;color:#64748b">Prepared by</td><td colspan="3">${he(form.preparedBy || "—")}</td></tr>
          <tr><td class="l" style="font-weight:700;color:#64748b">FESS approved by</td><td colspan="3">${he(form.approvedBy || "—")}</td></tr>
          <tr><td class="l" style="font-weight:700;color:#64748b">Site permit controller</td><td>${he(form.permitControllerName || linkedRams?.permitControllerName || "—")}</td><td class="l" style="font-weight:700;color:#64748b">Sign-off date</td><td>${he(fmtDate(form.permitControllerSignDate || linkedRams?.permitControllerSignDate))}</td></tr>
          ${clientLine}
        </tbody>
      </table>
      <p style="font-size:10px;color:#64748b;margin:8px 0 0">Dual sign-off: FESS supervisor approval plus site permit controller confirmation before production handback.</p>
    </div>

    <div class="fess-ms-page">
      <div class="fess-ms-h">Page 5 — Briefing record</div>
      <div class="fess-ms-sub">Operatives briefed on RAMS, method statement, permit conditions and emergency arrangements</div>
      ${ppe.length ? `<p style="font-size:11px;margin:0 0 10px"><strong>Required PPE:</strong> ${ppe.map((p) => he(p)).join(" · ")}</p>` : ""}
      ${form.emergencyProcedure ? `<p style="font-size:11px;margin:0 0 10px"><strong>Emergency:</strong> ${he(form.emergencyProcedure)}</p>` : ""}
      <table class="fess-ms">
        <thead><tr><th>Name</th><th>Key certs</th><th>Expiry / alert</th><th>Signature</th><th>Date</th></tr></thead>
        <tbody>${sigRows}</tbody>
      </table>
      ${form.briefingNotes ? `<p style="font-size:11px;margin-top:8px"><strong>Briefing notes:</strong> ${he(form.briefingNotes)}</p>` : ""}
    </div>
  </div>`;
}
