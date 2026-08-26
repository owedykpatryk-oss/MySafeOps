/** Wydruki dla czynników szkodliwych: karta badań i pomiarów oraz zbiorczy rejestr. */
import { escapeHtml as he, openPrintWindowOrWarn, writePrintWindowDocument } from "./htmlEscape";
import { czynnikRodzaj, ocenPomiar, OKRES_PRZECHOWYWANIA } from "./plCzynnikiLibrary";

const STATUS_LABEL = {
  "po-terminie": "po terminie",
  wkrotce: "termin w ciągu 30 dni",
  aktualny: "aktualny",
  odstapiono: "odstąpiono od pomiarów",
  "brak-terminu": "termin nieustalony",
};

const STATUS_COLOR = {
  "po-terminie": "#b91c1c",
  wkrotce: "#b45309",
  aktualny: "#15803d",
  odstapiono: "#475569",
  "brak-terminu": "#475569",
};

const BASE_CSS = `
  body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:18px}
  h1{font-size:15px;background:#0369a1;color:#fff;padding:8px 12px;margin:0 0 4px}
  .lead{font-size:10px;color:#555;margin:0 0 12px}
  h2{font-size:12px;font-weight:bold;background:#f5f5f5;padding:4px 8px;margin:13px 0 6px;border-left:3px solid #0369a1}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
  .cell{border:0.5px solid #ccc;padding:5px 8px}
  .cell .l{font-size:9px;color:#666;font-weight:bold;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:0.5px solid #999;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f1f5f9;font-size:10px}
  .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px}
  .sig-line{border-bottom:0.5px solid #333;height:24px}
  .sig-label{font-size:9px;color:#555;margin-top:3px;text-align:center}
  .foot{margin-top:14px;font-size:9px;color:#666;border-top:0.5px solid #ccc;padding-top:6px}
  @media print{h1,h2,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

function signatures(labels) {
  return `<div class="sigs">${labels
    .map((l) => `<div><div class="sig-line"></div><div class="sig-label">${he(l)}</div></div>`)
    .join("")}</div>`;
}

/**
 * Karta badań i pomiarów jednego czynnika na jednym stanowisku.
 * @param {object} row
 * @param {{ orgName?: string }} [opts]
 */
export function buildKartaBadanHtml(row, opts = {}) {
  if (!row?.nazwa) return "";
  const ocena = ocenPomiar(row);
  const rodzaj = czynnikRodzaj(row.rodzaj);

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/>
  <title>Karta badań i pomiarów — ${he(row.nazwa)}</title>
  <style>${BASE_CSS}</style></head><body>
  <h1>Karta badań i pomiarów czynnika szkodliwego</h1>
  <p class="lead">Rozporządzenie Ministra Zdrowia z 2.02.2011 w sprawie badań i pomiarów czynników szkodliwych dla zdrowia w środowisku pracy</p>

  <div class="grid">
    <div class="cell"><div class="l">Pracodawca</div>${he(opts.orgName || row.pracodawca || "—")}</div>
    <div class="cell"><div class="l">Komórka / budowa</div>${he(row.komorka || "—")}</div>
    <div class="cell"><div class="l">Numer karty</div>${he(row.ref || "—")}</div>
    <div class="cell"><div class="l">Stanowisko pracy</div>${he(row.stanowisko || "—")}</div>
    <div class="cell"><div class="l">Liczba osób narażonych</div>${he(String(row.liczbaOsob ?? "—"))}</div>
    <div class="cell"><div class="l">Rodzaj czynnika</div>${he(rodzaj?.label || row.rodzaj || "—")}</div>
  </div>

  <h2>Czynnik i wynik pomiaru</h2>
  <table>
    <thead><tr>
      <th>Czynnik</th><th>Jednostka</th><th>Wartość dopuszczalna</th><th>Wynik</th><th>Krotność</th><th>Ocena</th>
    </tr></thead>
    <tbody><tr>
      <td>${he(row.nazwa)}</td>
      <td>${he(row.jednostka || "—")}</td>
      <td>${he(String(row.wartoscDopuszczalna ?? "—"))} ${he(rodzaj?.limit && rodzaj.limit !== "—" ? `(${rodzaj.limit})` : "")}</td>
      <td>${he(String(row.wynik ?? "—"))}</td>
      <td>${he(ocena.krotnoscLabel)}</td>
      <td style="color:${ocena.przekroczenie ? "#b91c1c" : "#15803d"};font-weight:bold">${ocena.przekroczenie ? "przekroczenie" : "w granicach"}</td>
    </tr></tbody>
  </table>

  <h2>Badanie</h2>
  <div class="grid">
    <div class="cell"><div class="l">Data pomiaru</div>${he(row.dataPomiaru || "—")}</div>
    <div class="cell"><div class="l">Metoda / norma</div>${he(row.metoda || "—")}</div>
    <div class="cell"><div class="l">Laboratorium</div>${he(row.laboratorium || "—")}</div>
    <div class="cell"><div class="l">Numer sprawozdania</div>${he(row.numerSprawozdania || "—")}</div>
    <div class="cell"><div class="l">Termin kolejnego pomiaru</div>${he(ocena.nastepnyPomiar || "—")}</div>
    <div class="cell"><div class="l">Stan terminu</div><span style="color:${STATUS_COLOR[ocena.status]};font-weight:bold">${he(STATUS_LABEL[ocena.status])}</span></div>
  </div>

  <h2>Środki ograniczające narażenie</h2>
  <p style="margin:0;white-space:pre-wrap">${he(row.srodki || "—")}</p>

  <h2>Uwagi</h2>
  <p style="margin:0;white-space:pre-wrap">${he(row.uwagi || "—")}</p>

  ${
    ocena.wymagaRejestruNarazenia
      ? `<p style="margin-top:10px;font-size:10px;color:#7f1d1d"><strong>Uwaga:</strong> czynnik objęty obowiązkiem prowadzenia rejestru prac oraz rejestru pracowników narażonych.</p>`
      : ""
  }

  ${signatures(["Sporządził", "Służba BHP", "Pracodawca"])}
  <div class="foot">${he(OKRES_PRZECHOWYWANIA)} · Wygenerowano w MySafeOps — wartości dopuszczalne sprawdź w aktualnym rozporządzeniu w sprawie NDS i NDN.</div>
  </body></html>`;
}

/**
 * Zbiorczy rejestr czynników szkodliwych dla całej organizacji lub jednej budowy.
 * @param {object[]} rows
 * @param {{ orgName?: string, komorka?: string }} [opts]
 */
export function buildRejestrCzynnikowHtml(rows, opts = {}) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const body = list
    .map((row, i) => {
      const ocena = ocenPomiar(row);
      return `<tr>
        <td>${i + 1}</td>
        <td>${he(row.stanowisko || "—")}</td>
        <td>${he(row.nazwa || "—")}<div style="font-size:9px;color:#555">${he(czynnikRodzaj(row.rodzaj)?.label || "")}</div></td>
        <td>${he(String(row.wynik ?? "—"))} ${he(row.jednostka || "")}</td>
        <td>${he(String(row.wartoscDopuszczalna ?? "—"))}</td>
        <td style="${ocena.przekroczenie ? "color:#b91c1c;font-weight:bold" : ""}">${he(ocena.krotnoscLabel)}</td>
        <td>${he(row.dataPomiaru || "—")}</td>
        <td style="color:${STATUS_COLOR[ocena.status]}">${he(ocena.nastepnyPomiar || "—")}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/>
  <title>Rejestr czynników szkodliwych</title>
  <style>${BASE_CSS}</style></head><body>
  <h1>Rejestr czynników szkodliwych dla zdrowia występujących na stanowiskach pracy</h1>
  <p class="lead">Rozporządzenie Ministra Zdrowia z 2.02.2011 w sprawie badań i pomiarów czynników szkodliwych dla zdrowia w środowisku pracy</p>

  <div class="grid">
    <div class="cell"><div class="l">Pracodawca</div>${he(opts.orgName || "—")}</div>
    <div class="cell"><div class="l">Komórka / budowa</div>${he(opts.komorka || "wszystkie")}</div>
    <div class="cell"><div class="l">Liczba wpisów</div>${list.length}</div>
  </div>

  <table>
    <thead><tr>
      <th style="width:24px">Lp.</th><th>Stanowisko</th><th>Czynnik</th><th>Wynik</th>
      <th>Dopuszczalna</th><th>Krotność</th><th>Data pomiaru</th><th>Kolejny pomiar</th>
    </tr></thead>
    <tbody>${body || `<tr><td colspan="8">Brak wpisów w rejestrze.</td></tr>`}</tbody>
  </table>

  ${signatures(["Sporządził", "Służba BHP", "Pracodawca"])}
  <div class="foot">${he(OKRES_PRZECHOWYWANIA)} · Wygenerowano w MySafeOps.</div>
  </body></html>`;
}

/** @returns {{ ok: boolean, reason?: string }} */
export function printKartaBadan(row, opts = {}) {
  const html = buildKartaBadanHtml(row, opts);
  if (!html) return { ok: false, reason: "missing_row" };
  const win = openPrintWindowOrWarn();
  if (!win) return { ok: false, reason: "popup_blocked" };
  writePrintWindowDocument(win, html);
  return { ok: true };
}

/** @returns {{ ok: boolean, reason?: string }} */
export function printRejestrCzynnikow(rows, opts = {}) {
  const html = buildRejestrCzynnikowHtml(rows, opts);
  const win = openPrintWindowOrWarn();
  if (!win) return { ok: false, reason: "popup_blocked" };
  writePrintWindowDocument(win, html);
  return { ok: true };
}
