/**
 * FESS Group site pack — RAMS + 5-page MS + permits (org-exclusive).
 */
import { loadOrgScoped as load } from "./orgStorage";
import { isFessOrg } from "./fessOrg";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { openPrintWindowOrWarn, writePrintWindowDocument } from "./htmlEscape";
import {
  buildSitePackSummaryHtml,
  wrapRamsPrintDocument,
} from "../modules/rams/ramsPrintHtml";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { buildFessMethodStatementPackHtml } from "./fessMsPrintHtml";
import { buildFessBriefingOperativeRows } from "./fessBriefingRecord";
import { buildFessRamsPrintBodyHTML, fessOrgPrintTheme } from "./fessRamsPrintHtml";
import { escapeHtml as escHtml } from "./htmlEscape";
import { getActiveDocumentLocale } from "./countryWorkspaces";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(getActiveDocumentLocale(), { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
};

/** @param {object} ramsDoc @param {object[]} methodStatements */
export function findLinkedMethodStatement(ramsDoc, methodStatements = []) {
  if (!ramsDoc?.id) return null;
  const list = Array.isArray(methodStatements) ? methodStatements : [];
  const direct = list.find((ms) => ms.relatedRamsId === ramsDoc.id);
  if (direct) return direct;
  if (!ramsDoc.projectId) return null;
  const forProject = list.filter((ms) => ms.projectId === ramsDoc.projectId);
  if (!forProject.length) return null;
  return [...forProject].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
  )[0];
}

function splitPermitDocumentHtml(fullHtml) {
  const styleMatch = String(fullHtml || "").match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const bodyMatch = String(fullHtml || "").match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return {
    style: styleMatch ? styleMatch[1] : "",
    body: bodyMatch ? bodyMatch[1] : fullHtml || "",
  };
}

/**
 * @param {object} form RAMS doc
 * @param {object[]} rows
 * @param {object[]} workers
 * @param {object[]} projects
 * @param {object[]} permits
 * @param {object|null} sitePackMeta
 * @param {object|null} methodStatement
 * @param {object[]} coshhItems
 */
export async function generateFessSitePackHTML(
  form,
  rows,
  workers,
  projects,
  permits,
  sitePackMeta = null,
  methodStatement = null,
  coshhItems = []
) {
  if (!canUseFessExclusiveFeatures()) {
    throw new Error("FESS site pack is only available for FESS Group workspace.");
  }
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const operatives = (form.operativeIds || []).map((id) => workerMap[id]).filter(Boolean);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const ramsInner = buildFessRamsPrintBodyHTML(form, rows || [], operatives, projectMap);

  const ghpItems = load("ghp_register", []);
  const lotoItems = load("loto_register", []);
  const allergenWindows = load("allergen_changeover_windows", []);
  const registersBlock = buildFessSitePackRegistersHtml(form.projectId, { ghpItems, lotoItems, allergenWindows });

  const msOperativeRows = methodStatement
    ? buildFessBriefingOperativeRows(methodStatement, workers)
    : buildFessBriefingOperativeRows({ operativeIds: form.operativeIds, projectId: form.projectId }, workers);
  const msBlock = methodStatement
    ? `<div class="pack-ms" style="page-break-before:always">${buildFessMethodStatementPackHtml(methodStatement, msOperativeRows, coshhItems, form)}</div>`
    : `<div class="pack-ms" style="page-break-before:always;padding:24px;font-size:12px;color:#64748b">No method statement linked to this project — create one in Method Statement module.</div>`;

  const { renderPermitDocumentHtml } = await import("../modules/permits/permitDocumentHtml");
  let permitExtraCss = "";
  const permitBlocks = [];
  for (const p of permits) {
    const full = renderPermitDocumentHtml(p);
    const { style, body } = splitPermitDocumentHtml(full);
    if (!permitExtraCss && style) permitExtraCss = `\n${style}\n`;
    if (body) permitBlocks.push(`<div class="pack-permit-wrap">${body}</div>`);
  }

  const siteSummary = buildSitePackSummaryHtml(
    sitePackMeta,
    permits,
    form.projectId ? projectMap[form.projectId] : ""
  );
  const combinedBody = `<div class="pack-rams">${ramsInner}</div>${msBlock}${registersBlock}${siteSummary}${permitBlocks.join("")}`;
  const pageTitle = `${form.title || "RAMS"} · FESS site pack (RAMS + MS + PTW)`;
  const orgTheme = { orgName: String(loadOrgSettingsRaw()?.name || "MySafeOps") };
  const footer = `${form.documentNo || "RAMS"} · FESS site pack · ${fmtDate(form.issueDate)} · ${orgTheme.orgName}`;
  return wrapRamsPrintDocument(pageTitle, combinedBody, permitExtraCss, footer, fessOrgPrintTheme());
}

function buildFessSitePackRegistersHtml(projectId, { ghpItems = [], lotoItems = [], allergenWindows = [] } = {}) {
  const pid = String(projectId || "").trim();
  const ghp = (Array.isArray(ghpItems) ? ghpItems : []).filter((g) => !pid || !g.projectId || g.projectId === pid);
  const loto = (Array.isArray(lotoItems) ? lotoItems : []).filter((l) => !pid || !l.projectId || l.projectId === pid);
  const allergens = (Array.isArray(allergenWindows) ? allergenWindows : []).filter(
    (a) => !pid || !a.projectId || a.projectId === pid
  );

  const ghpRows = ghp.length
    ? ghp
        .slice(0, 20)
        .map(
          (g) => `<tr>
        <td>${escHtml(g.itemDescription || g.name || "—")}</td>
        <td>${escHtml(g.zone || "—")}</td>
        <td>${escHtml(g.broughtBy || "—")}</td>
        <td>${escHtml(g.dateIn || "—")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="color:#64748b;padding:8px">No G&amp;HP items on register — add tools/parts before production entry.</td></tr>`;

  const lotoRows = loto.length
    ? loto
        .slice(0, 20)
        .map(
          (l) => `<tr>
        <td>${escHtml(l.equipmentName || l.asset || "—")}</td>
        <td>${escHtml(l.isolationPoint || l.location || "—")}</td>
        <td>${escHtml(l.lockOwner || l.lockedBy || "—")}</td>
        <td>${escHtml(l.status || "—")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="color:#64748b;padding:8px">No LOTO points recorded — confirm isolation register before intrusive work.</td></tr>`;

  const allergenRows = allergens.length
    ? allergens
        .slice(0, 12)
        .map(
          (a) => `<tr>
        <td>${escHtml(a.allergen || a.name || "—")}</td>
        <td>${escHtml(a.zone || a.area || "—")}</td>
        <td>${escHtml(a.startDate || a.windowStart || "—")}</td>
        <td>${escHtml(a.endDate || a.windowEnd || "—")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="color:#64748b;padding:8px">No active allergen changeover windows — confirm with site before entry.</td></tr>`;

  return `<div class="fess-site-pack-registers" style="page-break-before:always;padding:8px 0">
    <div style="font-size:12px;font-weight:700;color:#134e4a;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">Site registers (G&amp;HP · LOTO · Allergen)</div>
    <div style="font-size:11px;font-weight:700;margin:10px 0 4px">Glass &amp; hard plastic (G&amp;HP)</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px">
      <thead><tr style="background:#134e4a;color:#fff"><th style="padding:5px 6px;text-align:left">Item</th><th>Zone</th><th>Brought by</th><th>Date in</th></tr></thead>
      <tbody>${ghpRows}</tbody>
    </table>
    <div style="font-size:11px;font-weight:700;margin:10px 0 4px">LOTO register</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px">
      <thead><tr style="background:#134e4a;color:#fff"><th style="padding:5px 6px;text-align:left">Equipment</th><th>Isolation</th><th>Owner</th><th>Status</th></tr></thead>
      <tbody>${lotoRows}</tbody>
    </table>
    <div style="font-size:11px;font-weight:700;margin:10px 0 4px">Allergen changeover windows</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead><tr style="background:#134e4a;color:#fff"><th style="padding:5px 6px;text-align:left">Allergen</th><th>Zone</th><th>From</th><th>To</th></tr></thead>
      <tbody>${allergenRows}</tbody>
    </table>
  </div>`;
}

/**
 * Open FESS site pack (RAMS + MS + permits) in print window.
 */
export async function openFessSitePackWindow(
  ramsDoc,
  rows,
  workers,
  projects,
  { permits = [], sitePackMeta = null, print = false } = {}
) {
  if (!isFessOrg()) return false;
  const methodStatements = load("method_statements", []);
  const coshhItems = load("coshh_register", []);
  const ms = findLinkedMethodStatement(ramsDoc, methodStatements);
  const html = await generateFessSitePackHTML(
    ramsDoc,
    rows,
    workers,
    projects,
    permits,
    sitePackMeta,
    ms,
    coshhItems
  );
  const win = openPrintWindowOrWarn({
    message: "Could not open print window — allow pop-ups for this site.",
  });
  if (!win) return false;
  await writePrintWindowDocument(win, html);
  if (print) win.print();
  return true;
}
