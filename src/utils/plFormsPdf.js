/**
 * Eksport polskiego druku BHP do PDF — ten sam nagłówek, logo i stopka co pozostałe
 * dokumenty w aplikacji, więc druk wygląda jak reszta dokumentacji, a nie jak wydruk z przeglądarki.
 *
 * Druk jest formularzem, nie tabelą: pola idą w dwóch kolumnach, pola szerokie i opisowe
 * na całą szerokość, a na końcu linie podpisów wymagane przez dany druk.
 */
import {
  PDF_PAGE,
  hexToRgb,
  getPdfTheme,
  drawPremiumPdfHeader,
  drawPdfMetaStrip,
  drawPremiumPdfFooter,
  drawWatermark,
  buildDocReference,
  setPdfFont,
  ensurePdfUnicodeFont,
} from "./pdfBranding.js";
import { getOrgSettings } from "./orgSettingsStorage";
import { sanitizePdfFileSegment } from "./pdfFileName";
import { findPlForm } from "./plFormsLibrary";
import { todayLocalISO } from "./localDate";

const { MARGIN, W, CONTENT_BOTTOM } = PDF_PAGE;
const COL_GAP = 4;

let jsPDFPromise = null;
async function loadJsPDF() {
  if (!jsPDFPromise) jsPDFPromise = import("jspdf").then((m) => m.jsPDF);
  return jsPDFPromise;
}

/** Podpisy pod drukiem — muszą odpowiadać temu, kto druk faktycznie podpisuje. */
const SIGNATURES = {
  skierowanie_badania: ["Pracodawca / osoba upoważniona", "Pieczątka zakładu"],
  karta_szkolenia_wstepnego: ["Podpis pracownika", "Instruktaż ogólny", "Instruktaż stanowiskowy"],
  zaswiadczenie_okresowe: ["Podpis uczestnika", "Organizator szkolenia", "Przewodniczący komisji"],
  karta_odziezy: ["Podpis pracownika (odbiór)", "Wydał"],
  zgloszenie_wypadku_pracownika: ["Podpis zgłaszającego", "Przyjmujący zgłoszenie"],
  zgloszenie_wypadku_niepracownika: ["Podpis zgłaszającego", "Przyjmujący zgłoszenie"],
  protokol_powypadkowy: ["Członek zespołu powypadkowego", "Członek zespołu powypadkowego", "Zatwierdzam — pracodawca"],
  karta_wypadku: ["Sporządził", "Podpis poszkodowanego", "Pracodawca"],
  karta_wypadku_w_drodze: ["Sporządził", "Podpis poszkodowanego", "Pracodawca"],
  statystyczna_karta: ["Sporządził", "Pracodawca"],
};

function fieldText(field, values) {
  const raw = values?.[field.key];
  if (field.kind === "check") return raw ? "TAK" : "NIE";
  const text = String(raw ?? "").trim();
  return text || "—";
}

function isWide(field) {
  return Boolean(field.wide) || field.kind === "textarea";
}

/**
 * Rysuje jedno pole i zwraca jego wysokość. Wysokość zależy od zawiniętego tekstu,
 * więc pole opisowe rośnie razem z treścią zamiast ją ucinać.
 */
function drawField(pdf, field, values, x, y, width, rgb) {
  const label = String(field.label || "").toUpperCase();
  const value = fieldText(field, values);
  const innerW = width - 4;

  setPdfFont(pdf, "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(110, 110, 110);
  const labelLines = pdf.splitTextToSize(label, innerW);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(9);
  const valueLines = pdf.splitTextToSize(value, innerW);

  const h = Math.max(11, 3 + labelLines.length * 2.6 + valueLines.length * 3.9 + 2.5);

  pdf.setDrawColor(205, 205, 205);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, width, h);

  setPdfFont(pdf, "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(110, 110, 110);
  pdf.text(labelLines, x + 2, y + 3.4);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(20, 20, 20);
  pdf.text(valueLines, x + 2, y + 3.4 + labelLines.length * 2.6 + 3.2);
  pdf.setTextColor(0, 0, 0);
  return h;
}

function drawSignatures(pdf, formKey, y, rgb) {
  const labels = SIGNATURES[formKey] || ["Podpis", "Data"];
  const contentW = W - MARGIN * 2;
  const colW = (contentW - COL_GAP * (labels.length - 1)) / labels.length;
  let x = MARGIN;
  pdf.setDrawColor(60, 60, 60);
  pdf.setLineWidth(0.25);
  for (const label of labels) {
    pdf.line(x, y + 12, x + colW, y + 12);
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(pdf.splitTextToSize(label, colW), x + colW / 2, y + 15.5, { align: "center" });
    x += colW + COL_GAP;
  }
  pdf.setTextColor(0, 0, 0);
  return y + 22;
}

/**
 * @param {object} record zapis druku { formKey, values, ref, projectName }
 * @param {{ org?: object, fileName?: string }} [opts]
 * @returns {Promise<{ ok: boolean, reason?: string, fileName?: string }>}
 */
export async function exportPlFormPdf(record, opts = {}) {
  const def = findPlForm(record?.formKey);
  if (!def) return { ok: false, reason: "unknown_form" };

  const org = opts.org || getOrgSettings() || {};
  const values = record?.values || {};
  const JsPDF = await loadJsPDF();
  const pdf = new JsPDF({ unit: "mm", format: "a4" });
  await ensurePdfUnicodeFont(pdf);

  const theme = getPdfTheme(org);
  const rgb = hexToRgb(org.primaryColor);
  const accentRgb = hexToRgb(org.accentColor);
  const docRef = record?.ref || buildDocReference(org, def.label);

  let y = drawPremiumPdfHeader(pdf, {
    org,
    title: def.label,
    subtitle: def.podstawa,
    rgb,
    accentRgb,
    theme,
    docRef,
  });
  y = drawPdfMetaStrip(
    pdf,
    org,
    {
      moduleLabel: "Druki BHP",
      docRef,
      recordNote: record?.projectName || record?.osoba || def.grupa,
    },
    rgb,
    y
  );
  y += 3;

  const contentW = W - MARGIN * 2;
  const halfW = (contentW - COL_GAP) / 2;

  const newPage = () => {
    drawPremiumPdfFooter(pdf, org, pdf.getNumberOfPages(), pdf.getNumberOfPages(), theme, rgb, accentRgb);
    pdf.addPage();
    y = drawPremiumPdfHeader(pdf, { org, title: def.label, subtitle: "ciąg dalszy", rgb, accentRgb, theme, docRef });
    y += 2;
  };

  for (const section of def.sections) {
    if (y > CONTENT_BOTTOM - 30) newPage();

    pdf.setFillColor(244, 245, 247);
    pdf.rect(MARGIN, y, contentW, 6.5, "F");
    pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    pdf.rect(MARGIN, y, 1.4, 6.5, "F");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(9);
    pdf.text(String(section.title).toUpperCase(), MARGIN + 4, y + 4.5);
    y += 8.5;

    // Pola wąskie idą parami, szerokie zajmują cały wiersz — jak w druku papierowym.
    let pending = null;
    const flushPending = () => {
      if (!pending) return;
      const h = drawField(pdf, pending.field, values, MARGIN, y, halfW, rgb);
      y += h + 2;
      pending = null;
    };

    for (const field of section.fields) {
      if (isWide(field)) {
        flushPending();
        if (y > CONTENT_BOTTOM - 20) newPage();
        const h = drawField(pdf, field, values, MARGIN, y, contentW, rgb);
        y += h + 2;
        continue;
      }
      if (!pending) {
        if (y > CONTENT_BOTTOM - 20) newPage();
        pending = { field };
        continue;
      }
      const hLeft = drawField(pdf, pending.field, values, MARGIN, y, halfW, rgb);
      const hRight = drawField(pdf, field, values, MARGIN + halfW + COL_GAP, y, halfW, rgb);
      y += Math.max(hLeft, hRight) + 2;
      pending = null;
    }
    flushPending();
    y += 2;
  }

  if (y > CONTENT_BOTTOM - 26) newPage();
  y = drawSignatures(pdf, def.key, y, rgb);

  if (def.stopka) {
    if (y > CONTENT_BOTTOM - 14) newPage();
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(110, 110, 110);
    pdf.text(pdf.splitTextToSize(def.stopka, contentW), MARGIN, y + 3);
    pdf.setTextColor(0, 0, 0);
  }

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    pdf.setPage(p);
    drawPremiumPdfFooter(pdf, org, p, total, theme, rgb, accentRgb);
  }
  drawWatermark(pdf, org);

  const fileName =
    opts.fileName ||
    `${sanitizePdfFileSegment(def.key)}_${sanitizePdfFileSegment(record?.ref || record?.osoba || "druk")}_${todayLocalISO()}.pdf`;

  try {
    pdf.save(fileName);
  } catch (e) {
    const { downloadBlob } = await import("./downloadBlob.js");
    if (!downloadBlob(pdf.output("blob"), fileName)) {
      return { ok: false, reason: "download_blocked" };
    }
  }
  return { ok: true, fileName };
}
