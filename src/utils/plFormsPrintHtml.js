/** Wydruk A4 polskich druków BHP (skierowania, karty szkoleń, druki powypadkowe). */
import { escapeHtml as he, openPrintWindowOrWarn, writePrintWindowDocument } from "./htmlEscape";
import { findPlForm } from "./plFormsLibrary";

/** Podpisy pod drukiem — różne dla różnych grup druków. */
const SIGNATURES = {
  skierowanie_badania: ["Pracodawca / osoba upoważniona", "Pieczątka zakładu"],
  karta_szkolenia_wstepnego: ["Podpis pracownika", "Prowadzący instruktaż ogólny", "Prowadzący instruktaż stanowiskowy"],
  zaswiadczenie_okresowe: ["Podpis uczestnika", "Organizator szkolenia", "Przewodniczący komisji"],
  karta_odziezy: ["Podpis pracownika (odbiór)", "Wydał"],
  zgloszenie_wypadku_pracownika: ["Podpis zgłaszającego", "Podpis przyjmującego zgłoszenie"],
  zgloszenie_wypadku_niepracownika: ["Podpis zgłaszającego", "Podpis przyjmującego zgłoszenie"],
  protokol_powypadkowy: ["Członek zespołu powypadkowego", "Członek zespołu powypadkowego", "Zatwierdzam — pracodawca"],
  karta_wypadku: ["Sporządził", "Podpis poszkodowanego", "Pracodawca"],
  karta_wypadku_w_drodze: ["Sporządził", "Podpis poszkodowanego", "Pracodawca"],
  statystyczna_karta: ["Sporządził", "Pracodawca"],
};

function signatureBlock(formKey) {
  const labels = SIGNATURES[formKey] || ["Podpis", "Data"];
  const cells = labels
    .map((l) => `<div class="sig"><div class="sig-line"></div><div class="sig-label">${he(l)}</div></div>`)
    .join("");
  return `<div class="sigs">${cells}</div>`;
}

/** @param {import("./plFormsLibrary").PlFormField} field @param {Record<string, unknown>} values */
function fieldCell(field, values) {
  const raw = values?.[field.key];
  let shown;
  if (field.kind === "check") shown = raw ? "TAK" : "NIE";
  else shown = String(raw ?? "").trim() || "—";
  const cls = field.wide || field.kind === "textarea" ? "cell wide" : "cell";
  const body =
    field.kind === "textarea"
      ? `<div class="v multiline">${he(shown).replace(/\n/g, "<br/>")}</div>`
      : `<div class="v">${he(shown)}</div>`;
  return `<div class="${cls}"><div class="l">${he(field.label)}</div>${body}</div>`;
}

/**
 * @param {object} record zapis druku z rejestru: { formKey, values, ... }
 * @param {{ orgName?: string, projectName?: string }} [opts]
 */
export function buildPlFormPrintHtml(record, opts = {}) {
  const def = findPlForm(record?.formKey);
  if (!def) return "";
  const values = record?.values || {};

  const sections = def.sections
    .map(
      (s) => `
      <h2>${he(s.title)}</h2>
      <div class="grid">${s.fields.map((f) => fieldCell(f, values)).join("")}</div>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/>
  <title>${he(def.label)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:18px}
    h1{font-size:15px;background:#1d4ed8;color:#fff;padding:8px 12px;margin:0 0 4px}
    .sub{font-size:10px;color:#555;margin:0 0 12px}
    h2{font-size:12px;font-weight:bold;background:#f5f5f5;padding:4px 8px;margin:14px 0 6px;border-left:3px solid #1d4ed8}
    .head{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .cell{border:0.5px solid #ccc;padding:5px 8px;min-height:30px}
    .cell.wide{grid-column:1 / -1}
    .l{font-size:9px;color:#666;font-weight:bold;text-transform:uppercase;margin-bottom:2px}
    .v{font-size:11px}
    .v.multiline{white-space:pre-wrap;min-height:26px}
    .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px}
    .sig-line{border-bottom:0.5px solid #333;height:26px}
    .sig-label{font-size:9px;color:#555;margin-top:3px;text-align:center}
    .foot{margin-top:16px;font-size:9px;color:#666;border-top:0.5px solid #ccc;padding-top:6px}
    @media print{h1,h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h1>${he(def.label)}</h1>
  <p class="sub">${he(def.podstawa)}</p>
  <div class="head">
    <div class="cell"><div class="l">Pracodawca</div><div class="v">${he(opts.orgName || record?.pracodawca || "—")}</div></div>
    <div class="cell"><div class="l">Budowa / projekt</div><div class="v">${he(opts.projectName || record?.projectName || "—")}</div></div>
    <div class="cell"><div class="l">Numer druku</div><div class="v">${he(record?.ref || record?.id || "—")}</div></div>
  </div>
  ${sections}
  ${signatureBlock(def.key)}
  <div class="foot">${he(def.stopka || "")} · Wygenerowano w MySafeOps — druk roboczy, zweryfikuj wymagania dla swojego zakładu.</div>
  </body></html>`;
}

/**
 * @param {object} record
 * @param {{ orgName?: string, projectName?: string }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function printPlForm(record, opts = {}) {
  const html = buildPlFormPrintHtml(record, opts);
  if (!html) return { ok: false, reason: "unknown_form" };
  const win = openPrintWindowOrWarn();
  if (!win) return { ok: false, reason: "popup_blocked" };
  writePrintWindowDocument(win, html);
  return { ok: true };
}
