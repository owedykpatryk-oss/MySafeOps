/** Wydruk karty oceny ryzyka zawodowego (ORZ) wraz z oświadczeniem pracownika. */
import { escapeHtml as he, openPrintWindowOrWarn, writePrintWindowDocument } from "./htmlEscape";
import { assessOrzCard, orzAcknowledgementText } from "./plOrzLibrary";

const LEVEL_COLOR = { małe: "#15803d", średnie: "#b45309", duże: "#b91c1c" };

function list(items) {
  const rows = (items || []).filter(Boolean);
  if (!rows.length) return "—";
  return `<ul style="margin:0;padding-left:16px">${rows.map((i) => `<li>${he(i)}</li>`).join("")}</ul>`;
}

/**
 * @param {object} record karta zapisana w rejestrze (snapshot biblioteki + dane organizacji)
 * @param {{ orgName?: string }} [opts]
 */
export function buildOrzPrintHtml(record, opts = {}) {
  const card = assessOrzCard(record);
  const color = LEVEL_COLOR[card.najwyzszePoziomRyzyka] || "#475569";
  const rows = card.zagrozenia
    .map(
      (z, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${he(z.czynnik)}</strong><div class="sub">${he(z.zrodlo)}</div></td>
        <td>${he(z.skutki)}</td>
        <td>${he(z.prawdopodobienstwo)}</td>
        <td>${he(z.ciezkosc)}</td>
        <td style="color:${LEVEL_COLOR[z.poziom] || "#000"};font-weight:bold">${he(z.poziom || "—")}</td>
        <td>${list(z.srodki)}</td>
      </tr>`
    )
    .join("");

  const oswiadczenie = orzAcknowledgementText(card.stanowisko, card.dataOceny || "")
    .map((line) => `<p style="margin:0 0 6px">${he(line)}</p>`)
    .join("");

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/>
  <title>Ocena ryzyka zawodowego — ${he(card.stanowisko)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:18px}
    h1{font-size:15px;background:#0d9488;color:#fff;padding:8px 12px;margin:0 0 12px}
    h2{font-size:12px;font-weight:bold;background:#f5f5f5;padding:4px 8px;margin:14px 0 6px;border-left:3px solid #0d9488}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
    .cell{border:0.5px solid #ccc;padding:5px 8px}.cell .l{font-size:9px;color:#666;font-weight:bold;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    th,td{border:0.5px solid #999;padding:4px 6px;vertical-align:top;text-align:left}
    th{background:#f1f5f9;font-size:10px}
    .sub{font-size:10px;color:#555;margin-top:2px}
    .sign{margin-top:10px;border:0.5px solid #999;padding:8px}
    .sign-lines{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px;font-size:10px;color:#555}
    .foot{margin-top:14px;font-size:9px;color:#666;border-top:0.5px solid #ccc;padding-top:6px}
    @media print{h1,h2,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h1>Ocena ryzyka zawodowego — ${he(card.stanowisko)}</h1>
  <div class="grid">
    <div class="cell"><div class="l">Pracodawca</div>${he(opts.orgName || record.pracodawca || "—")}</div>
    <div class="cell"><div class="l">Komórka / budowa</div>${he(record.komorka || "—")}</div>
    <div class="cell"><div class="l">Data oceny</div>${he(record.dataOceny || "—")}</div>
    <div class="cell"><div class="l">Ocenę sporządził</div>${he(record.oceniajacy || "—")}</div>
    <div class="cell"><div class="l">Metoda oceny</div>Skala trójstopniowa wg PN-N-18002</div>
    <div class="cell"><div class="l">Najwyższe ryzyko</div><span style="color:${color};font-weight:bold">${he(card.najwyzszePoziomRyzyka || "—")}</span></div>
  </div>
  <h2>Charakterystyka stanowiska</h2>
  <p style="margin:0 0 8px">${he(card.opis || "—")}</p>
  <div class="grid">
    <div class="cell"><div class="l">Wymagane badania</div>${list(card.badania)}</div>
    <div class="cell"><div class="l">Szkolenia</div>${list(card.szkolenia)}</div>
    <div class="cell"><div class="l">Uprawnienia</div>${list(card.uprawnienia)}</div>
  </div>
  <div class="cell" style="margin-bottom:10px"><div class="l">Środki ochrony indywidualnej</div>${list(card.soi)}</div>
  <h2>Identyfikacja zagrożeń i ocena ryzyka</h2>
  <table>
    <thead><tr>
      <th style="width:20px">Lp.</th><th style="width:18%">Zagrożenie / źródło</th><th style="width:16%">Możliwe skutki</th>
      <th style="width:10%">Prawdop.</th><th style="width:8%">Ciężkość</th><th style="width:8%">Ryzyko</th><th>Środki profilaktyczne</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="7">Brak zidentyfikowanych zagrożeń</td></tr>'}</tbody>
  </table>
  ${record.uwagi ? `<h2>Uwagi</h2><p style="margin:0 0 8px">${he(record.uwagi)}</p>` : ""}
  <h2>Oświadczenie pracownika</h2>
  <div class="sign">
    ${oswiadczenie}
    <div class="sign-lines">
      <div>………………………………<br/>Imię i nazwisko</div>
      <div>………………………………<br/>Data</div>
      <div>………………………………<br/>Podpis pracownika</div>
    </div>
  </div>
  <div class="foot">Dokument roboczy wygenerowany w MySafeOps. Ocena ryzyka zawodowego wymaga weryfikacji przez pracodawcę lub służbę BHP dla konkretnego stanowiska i warunków pracy — art. 226 Kodeksu pracy.</div>
  </body></html>`;
}

/** @param {object} record @param {{ orgName?: string }} [opts] */
export function printOrzCard(record, opts = {}) {
  const win = openPrintWindowOrWarn();
  if (!win) return false;
  void writePrintWindowDocument(win, buildOrzPrintHtml(record, opts));
  return true;
}
