/**
 * FESS Group — Excel-style RAMS print layout (MC reference structure).
 * Org-exclusive: used when isFessOrg() is true.
 */
import { escapeHtml as escHtml } from "./htmlEscape";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { getRiskLevel, RISK_COLORS } from "../modules/rams/ramsRiskLevel.js";
import { wrapRamsPrintDocument } from "../modules/rams/ramsPrintDocument.js";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { getFessBrandLogoSrc } from "./fessBranding";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

export function fessOrgPrintTheme() {
  const org = loadOrgSettingsRaw();
  return {
    org,
    primaryColor: org.primaryColor,
    accentColor: org.accentColor,
    complianceLine: org.pdfComplianceLine,
  };
}

function riskScore(risk) {
  if (!risk || typeof risk !== "object") return 0;
  if (risk.RF != null) return Number(risk.RF) || 0;
  return (Number(risk.L) || 0) * (Number(risk.S) || 0);
}

const fessPrintCss = `
  .fess-rams-cover { border: 2px solid #f97316; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; background: linear-gradient(165deg, #fff7ed 0%, #fff 60%); }
  .fess-rams-cover-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .fess-rams-logo { height: 44px; width: auto; max-width: 160px; object-fit: contain; }
  .fess-rams-brand { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #c2410c; margin-bottom: 6px; }
  .fess-rams-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
  .fess-rams-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .fess-rams-cell { border: 0.5px solid #fed7aa; border-radius: 6px; padding: 6px 8px; background: #fff; font-size: 11px; }
  .fess-rams-cell .l { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .fess-rams-h2 { font-size: 12px; font-weight: 700; color: #0f172a; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table.fess-rams-ra { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
  table.fess-rams-ra th { background: #0f172a; color: #fff; padding: 5px 6px; text-align: left; border: 1px solid #0f172a; font-size: 9px; }
  table.fess-rams-ra td { padding: 5px 6px; border: 1px solid #e5e5e5; vertical-align: top; }
  table.fess-rams-ra .risk-cell { text-align: center; font-weight: 700; width: 42px; }
  .fess-rams-ms { font-size: 11px; white-space: pre-wrap; line-height: 1.45; margin: 0 0 12px; }
  .fess-rams-ppe { font-size: 11px; margin: 0 0 12px; }
  @media print {
    .fess-rams-cover, table.fess-rams-ra th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/**
 * RAMS body HTML in FESS Excel layout (no html/head wrapper).
 */
export function buildFessRamsPrintBodyHTML(form, rows, operatives, projectMap) {
  if (!canUseFessExclusiveFeatures()) return "";
  const rowList = Array.isArray(rows) ? rows : [];
  const opList = Array.isArray(operatives) ? operatives : [];
  const projName = form.projectId ? projectMap[form.projectId] || "" : "";
  const statusLabel = String(form.documentStatus || form.status || "draft").replace(/_/g, " ");

  const ppeRollup = [
    ...new Set(
      rowList
        .flatMap((r) => r.ppeRequired || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    ),
  ].sort();

  const rowsHTML = rowList
    .map((r, idx) => {
      const initLevel = getRiskLevel(r.initialRisk || {});
      const revLevel = getRiskLevel(r.revisedRisk || {});
      const initStyle = RISK_COLORS[initLevel] || RISK_COLORS.low;
      const revStyle = RISK_COLORS[revLevel] || RISK_COLORS.low;
      const controls = (r.controlMeasures || [])
        .filter(Boolean)
        .map((cm, i) => `<div style="margin-bottom:3px">${i + 1}. ${escHtml(cm)}</div>`)
        .join("");
      return `<tr>
        <td style="text-align:center;font-weight:700;width:28px">${idx + 1}</td>
        <td style="font-weight:600;width:18%">${escHtml(r.activity || "")}</td>
        <td>${escHtml(r.hazard || "")}</td>
        <td class="risk-cell" style="background:${initStyle.bg};color:${initStyle.color}">${escHtml(String(r.initialRisk?.L ?? "—"))}</td>
        <td class="risk-cell" style="background:${initStyle.bg};color:${initStyle.color}">${escHtml(String(r.initialRisk?.S ?? "—"))}</td>
        <td class="risk-cell" style="background:${initStyle.bg};color:${initStyle.color}">${riskScore(r.initialRisk)}</td>
        <td>${controls || "—"}</td>
        <td class="risk-cell" style="background:${revStyle.bg};color:${revStyle.color}">${escHtml(String(r.revisedRisk?.L ?? "—"))}</td>
        <td class="risk-cell" style="background:${revStyle.bg};color:${revStyle.color}">${escHtml(String(r.revisedRisk?.S ?? "—"))}</td>
        <td class="risk-cell" style="background:${revStyle.bg};color:${revStyle.color}">${riskScore(r.revisedRisk)}</td>
      </tr>`;
    })
    .join("");

  const sigRows = opList.length
    ? opList
        .map(
          (n) => `<tr style="height:36px">
        <td style="padding:6px;border:1px solid #e5e5e5">${escHtml(n)}</td>
        <td style="border:1px solid #e5e5e5"></td>
        <td style="border:1px solid #e5e5e5"></td>
        <td style="border:1px solid #e5e5e5"></td>
      </tr>`
        )
        .join("")
    : `<tr style="height:36px"><td colspan="4" style="border:1px solid #e5e5e5;color:#64748b;padding:6px">Operatives to sign on site briefing</td></tr>`;

  const allergenBlock =
    form.allergenChangeoverRef || form.allergenControlsNote
      ? `<div class="fess-rams-h2">Allergen & hygiene</div>
         <div class="fess-rams-ms">${escHtml(
           [form.allergenChangeoverRef ? `Changeover: ${form.allergenChangeoverRef}` : "", form.allergenControlsNote || ""]
             .filter(Boolean)
             .join("\n\n")
         )}</div>`
      : "";

  const permitBlock = form.permitControllerContact || form.permitControllerHint
    ? `<div class="fess-rams-h2">Permit controller</div>
       <div class="fess-rams-ms">${escHtml(
         [form.permitControllerContact, form.permitControllerHint].filter(Boolean).join(" — ")
       )}</div>`
    : "";

  const logoSrc = getFessBrandLogoSrc();

  return `<style>${fessPrintCss}</style>
  <div class="fess-rams-cover">
    <div class="fess-rams-cover-top">
      <div>
        <div class="fess-rams-brand">FESS Group · Risk Assessment & Method Statement</div>
        <div style="font-size:10px;color:#64748b">Controlled document · food factory M&amp;E</div>
      </div>
      <img class="fess-rams-logo" src="${escHtml(logoSrc)}" alt="FESS Group" />
    </div>
    <h1 class="fess-rams-title">${escHtml(form.title || "RAMS")}</h1>
    <div class="fess-rams-meta">
      <div class="fess-rams-cell"><div class="l">Document no.</div>${escHtml(form.documentNo || "—")}</div>
      <div class="fess-rams-cell"><div class="l">Revision</div>${escHtml(form.revision || "1A")}</div>
      <div class="fess-rams-cell"><div class="l">Issue date</div>${escHtml(fmtDate(form.issueDate))}</div>
      <div class="fess-rams-cell"><div class="l">Status</div>${escHtml(statusLabel)}</div>
      <div class="fess-rams-cell"><div class="l">Job ref</div>${escHtml(form.jobRef || "—")}</div>
      <div class="fess-rams-cell"><div class="l">Project</div>${escHtml(projName || "—")}</div>
      <div class="fess-rams-cell"><div class="l">Client</div>${escHtml(form.client || "—")}</div>
      <div class="fess-rams-cell"><div class="l">Location / site</div>${escHtml(form.location || "—")}</div>
      <div class="fess-rams-cell"><div class="l">Job type</div>${escHtml(form.fessJobStarterLabel || form.fessJobStarterKey || "—")}</div>
    </div>
  </div>

  <div class="fess-rams-h2">1. Scope of works</div>
  <div class="fess-rams-ms">${escHtml(form.scope || "—")}</div>

  <div class="fess-rams-h2">2. Method statement</div>
  <div class="fess-rams-ms">${escHtml(form.surveyMethodStatement || form.methodStatement || "—")}</div>

  ${permitBlock}
  ${allergenBlock}

  <div class="fess-rams-h2">3. Risk assessment</div>
  <table class="fess-rams-ra">
    <colgroup>
      <col style="width:4%"/><col style="width:16%"/><col style="width:19%"/>
      <col style="width:5%"/><col style="width:5%"/><col style="width:6%"/>
      <col style="width:28%"/>
      <col style="width:5%"/><col style="width:5%"/><col style="width:7%"/>
    </colgroup>
    <thead>
      <tr>
        <th>Ref</th>
        <th>Activity</th>
        <th>Hazard</th>
        <th>L</th>
        <th>S</th>
        <th>Risk</th>
        <th>Control measures</th>
        <th>L</th>
        <th>S</th>
        <th>Residual</th>
      </tr>
    </thead>
    <tbody>${rowsHTML || `<tr><td colspan="10" style="color:#64748b;padding:8px">No hazard rows — add standard site RA baseline before issue.</td></tr>`}</tbody>
  </table>

  <div class="fess-rams-h2">4. PPE (rollup)</div>
  <div class="fess-rams-ppe">${ppeRollup.length ? escHtml(ppeRollup.join(", ")) : "As identified per activity above."}</div>

  <div class="fess-rams-h2">5. Operative signatures</div>
  <table class="fess-rams-ra" style="margin-bottom:8px">
    <thead><tr><th>Name</th><th>Signature</th><th>Date</th><th>Time</th></tr></thead>
    <tbody>${sigRows}</tbody>
  </table>

  ${
    form.handoverNotes || form.communicationPlan
      ? `<div class="fess-rams-h2">6. Communication & handover</div>
         <div class="fess-rams-ms">${escHtml([form.communicationPlan, form.handoverNotes].filter(Boolean).join("\n\n"))}</div>`
      : ""
  }`;
}

/** Full HTML document for FESS RAMS print/preview. */
export function generateFessPrintHTML(form, rows, operatives, projectMap) {
  if (!canUseFessExclusiveFeatures()) return "";
  const inner = buildFessRamsPrintBodyHTML(form, rows, operatives, projectMap);
  const orgName = String(loadOrgSettingsRaw()?.name || "FESS Group");
  const footer = `${form.documentNo || "RAMS"} · FESS layout · ${fmtDate(form.issueDate)} · ${orgName}`;
  return wrapRamsPrintDocument(form.title || "RAMS", inner, "", footer, fessOrgPrintTheme());
}
