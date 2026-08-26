/** Wydruk instrukcji stanowiskowej BHP wraz z listą zapoznania się pracowników. */
import { escapeHtml as he, openPrintWindowOrWarn, writePrintWindowDocument } from "./htmlEscape";
import { findPlInstrukcja, instrukcjaAcknowledgementText } from "./plInstrukcjeLibrary";

function list(items, ordered = false) {
  const rows = (items || []).filter(Boolean);
  if (!rows.length) return "<p class='empty'>—</p>";
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${rows.map((i) => `<li>${he(i)}</li>`).join("")}</${tag}>`;
}

/** Wiersze listy zapoznania — puste linie, gdy nikt jeszcze nie został przypisany. */
function acknowledgementRows(record) {
  const rows = Array.isArray(record?.zapoznani) ? record.zapoznani.filter(Boolean) : [];
  const filled = rows.map(
    (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${he(r.imieNazwisko || "")}</td>
        <td>${he(r.stanowisko || "")}</td>
        <td>${he(r.data || "")}</td>
        <td></td>
      </tr>`
  );
  // Zawsze zostaw kilka pustych wierszy — instrukcję podpisuje się też na budowie, na papierze.
  const blanks = Array.from({ length: Math.max(4, 8 - filled.length) }, (_, i) => `
      <tr>
        <td>${filled.length + i + 1}</td>
        <td></td><td></td><td></td><td></td>
      </tr>`);
  return [...filled, ...blanks].join("");
}

/**
 * @param {object} record zapis instrukcji z rejestru (snapshot biblioteki + dane organizacji)
 * @param {{ orgName?: string }} [opts]
 */
export function buildInstrukcjaPrintHtml(record, opts = {}) {
  const src = findPlInstrukcja(record?.libraryKey);
  const doc = { ...(src || {}), ...(record || {}) };
  if (!doc.tytul) return "";

  const oswiadczenie = instrukcjaAcknowledgementText(doc.tytul, record?.dataWydania || "")
    .map((line) => `<p style="margin:0 0 5px">${he(line)}</p>`)
    .join("");

  const pytania = (doc.pytania || []).length
    ? `<h2>Pytania sprawdzające</h2>${list(doc.pytania, true)}`
    : "";

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/>
  <title>Instrukcja stanowiskowa BHP — ${he(doc.tytul)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:18px}
    h1{font-size:15px;background:#7c3aed;color:#fff;padding:8px 12px;margin:0 0 4px}
    .lead{font-size:10px;color:#555;margin:0 0 12px}
    h2{font-size:12px;font-weight:bold;background:#f5f5f5;padding:4px 8px;margin:13px 0 5px;border-left:3px solid #7c3aed}
    h2.warn{border-left-color:#b91c1c;color:#7f1d1d}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
    .cell{border:0.5px solid #ccc;padding:5px 8px}
    .cell .l{font-size:9px;color:#666;font-weight:bold;text-transform:uppercase}
    ul,ol{margin:0;padding-left:17px}
    li{margin-bottom:2px}
    .empty{margin:0;color:#777}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{border:0.5px solid #999;padding:4px 6px;text-align:left;height:16px}
    th{background:#f1f5f9;font-size:10px}
    .ack{margin-top:12px;border:0.5px solid #999;padding:8px}
    .foot{margin-top:14px;font-size:9px;color:#666;border-top:0.5px solid #ccc;padding-top:6px}
    @media print{h1,h2,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h1>Instrukcja stanowiskowa BHP — ${he(doc.tytul)}</h1>
  <p class="lead">${he(doc.opis || "")}</p>

  <div class="grid">
    <div class="cell"><div class="l">Pracodawca</div>${he(opts.orgName || record?.pracodawca || "—")}</div>
    <div class="cell"><div class="l">Komórka / budowa</div>${he(record?.komorka || "—")}</div>
    <div class="cell"><div class="l">Data wydania</div>${he(record?.dataWydania || "—")}</div>
    <div class="cell"><div class="l">Numer instrukcji</div>${he(record?.ref || "—")}</div>
    <div class="cell"><div class="l">Zatwierdził</div>${he(record?.zatwierdzil || "—")}</div>
    <div class="cell"><div class="l">Wymagane uprawnienia</div>${he((doc.uprawnienia || []).join(", ") || "—")}</div>
  </div>

  <h2>1. Uwagi ogólne — kto może wykonywać pracę</h2>
  ${list(doc.uwagiOgolne)}

  <h2>2. Czynności przed rozpoczęciem pracy</h2>
  ${list(doc.przedPraca, true)}

  <h2>3. Czynności podczas pracy</h2>
  ${list(doc.wTrakcie, true)}

  <h2>4. Czynności po zakończeniu pracy</h2>
  ${list(doc.poPracy, true)}

  <h2 class="warn">5. Czynności zabronione</h2>
  ${list(doc.zabronione)}

  <h2 class="warn">6. Postępowanie w sytuacjach awaryjnych</h2>
  ${list(doc.awaria, true)}

  <div class="two">
    <div>
      <h2>7. Środki ochrony indywidualnej</h2>
      ${list(doc.soi)}
    </div>
    <div>
      <h2>Podstawa prawna</h2>
      ${list(doc.podstawa)}
    </div>
  </div>

  ${pytania}

  <div class="ack">
    <strong style="font-size:12px">Oświadczenie o zapoznaniu się z instrukcją</strong>
    <div style="margin-top:5px">${oswiadczenie}</div>
    <table>
      <thead><tr><th style="width:24px">Lp.</th><th>Imię i nazwisko</th><th>Stanowisko</th><th style="width:80px">Data</th><th style="width:150px">Podpis</th></tr></thead>
      <tbody>${acknowledgementRows(record)}</tbody>
    </table>
  </div>

  <div class="foot">Wygenerowano w MySafeOps · instrukcja stanowiskowa wg Kodeksu pracy art. 2374 § 2 — zweryfikuj zgodność z instrukcją obsługi producenta i warunkami swojego zakładu.</div>
  </body></html>`;
}

/**
 * @param {object} record
 * @param {{ orgName?: string }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function printInstrukcja(record, opts = {}) {
  const html = buildInstrukcjaPrintHtml(record, opts);
  if (!html) return { ok: false, reason: "unknown_instruction" };
  const win = openPrintWindowOrWarn();
  if (!win) return { ok: false, reason: "popup_blocked" };
  writePrintWindowDocument(win, html);
  return { ok: true };
}
