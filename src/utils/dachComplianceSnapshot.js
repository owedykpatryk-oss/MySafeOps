/**
 * DACH (DE/AT/CH) inspection-ready compliance snapshot.
 *
 * Sales hook from marketing/dach/DACH_MARKET_BRIEF.md — "BG / Kontrolle asks for
 * Unterweisung, Erlaubnisschein, Prüfungen — evidence scattered in WhatsApp + Excel."
 * This builds the single-page handoff document: SiGe-Plan/GBU status, Anhang II
 * coverage, live Erlaubnisschein status, Unterweisung/training currency, and open
 * incidents — the "audit trail (BG-ready export story)" promised at Business tier.
 *
 * Not a regulatory filing. Confirm content against current statutes before
 * presenting to an inspector.
 */

import { loadOrgScoped as load } from "./orgStorage";
import { getOrgSettings } from "./orgSettingsStorage.js";
import { escapeHtml } from "./htmlEscape.js";
import { wrapPrintHtmlDocument } from "./pdfBranding.js";
import { openRegisterFormPrint, formSection, formKvTable } from "./registerFormPrint.js";
import { DE_ANHANG_II_WORKS } from "../config/deAnhangII";

/** @typedef {import("../config/markets").MarketId} MarketId */

const REGULATOR_BY_MARKET = {
  de: { name: "Berufsgenossenschaft (BG) / Gewerbeaufsicht", short: "BG" },
  at: { name: "Arbeitsinspektion / AUVA", short: "AUVA" },
  ch: { name: "Suva / kantonales Arbeitsinspektorat", short: "Suva" },
};

const COPY_BY_MARKET = {
  de: {
    title: "Prüfbereiter Nachweis",
    subtitle: "Für BG-Kontrolle und interne Revision — kein amtliches Dokument.",
    sigePlanLabel: "SiGe-Plan / GBU",
    permitLabel: "Erlaubnisscheine",
    trainingLabel: "Unterweisungen",
    incidentLabel: "Meldepflichtige Ereignisse",
    anhangLabel: "Anhang-II-Arbeiten — Abdeckung",
    generatedLabel: "Erstellt am",
    disclaimer:
      "Dieser Bericht ersetzt keine amtliche Meldung (Vorankündigung, Unfallanzeige) und keine Rechtsberatung. Bitte vor Vorlage bei einer Behörde inhaltlich prüfen.",
    statusOk: "Aktuell",
    statusWarn: "Prüfen",
    statusBad: "Fehlt",
  },
  at: {
    title: "Prüfbereiter Nachweis",
    subtitle: "Für Arbeitsinspektion / AUVA und interne Revision — kein amtliches Dokument.",
    sigePlanLabel: "SiGe-Plan / Evaluierung",
    permitLabel: "Arbeitsfreigaben",
    trainingLabel: "Unterweisungen",
    incidentLabel: "Meldepflichtige Ereignisse",
    anhangLabel: "Besonders gefährliche Arbeiten — Abdeckung",
    generatedLabel: "Erstellt am",
    disclaimer:
      "Dieser Bericht ersetzt keine amtliche Meldung (Vorankündigung, Unfallmeldung) und keine Rechtsberatung. Bitte vor Vorlage bei einer Behörde inhaltlich prüfen.",
    statusOk: "Aktuell",
    statusWarn: "Prüfen",
    statusBad: "Fehlt",
  },
  ch: {
    title: "Prüfbereiter Nachweis",
    subtitle: "Für Suva und interne Revision — kein amtliches Dokument.",
    sigePlanLabel: "SiKo (BauAV Art. 4)",
    permitLabel: "Freigaben",
    trainingLabel: "Instruktionen",
    incidentLabel: "Meldepflichtige Ereignisse",
    anhangLabel: "Besonders gefährliche Arbeiten — Abdeckung",
    generatedLabel: "Erstellt am",
    disclaimer:
      "Dieser Bericht ersetzt keine amtliche Meldung und keine Rechtsberatung. Bitte vor Vorlage bei einer Behörde inhaltlich prüfen.",
    statusOk: "Aktuell",
    statusWarn: "Prüfen",
    statusBad: "Fehlt",
  },
};

function statusChip(label, tone) {
  const cls = tone === "ok" ? "dcs-chip--ok" : tone === "warn" ? "dcs-chip--warn" : "dcs-chip--bad";
  return `<span class="dcs-chip ${cls}">${escapeHtml(label)}</span>`;
}

function daysAgo(iso) {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

/** @param {MarketId} marketId */
function isDachMarket(marketId) {
  return marketId === "de" || marketId === "at" || marketId === "ch";
}

/**
 * Gathers the live compliance picture for the snapshot.
 * @param {MarketId} marketId
 */
export function buildDachComplianceData(marketId) {
  const cdmPacks = load("cdm_packs", []);
  const permits = load("permits_v2", []);
  const training = load("training_matrix", []);
  const incidents = load("mysafeops_incidents", []);
  const riddor = load("riddor_reports", []);

  const activeSigePlan = cdmPacks.find((p) => p?.status !== "archived") || cdmPacks[0] || null;
  const openPermits = permits.filter((p) => ["active", "approved", "ready_for_review"].includes(p?.status));
  const expiredPermits = permits.filter((p) => p?.status === "active" && daysAgo(p?.startDateTime) > 30);
  const staleTraining = training.filter((t) => {
    const expiry = t?.expiryDate || t?.nextDueDate;
    if (!expiry) return false;
    return new Date(expiry).getTime() < Date.now();
  });
  const openIncidentActions = incidents.filter((i) => i?.status && i.status !== "closed");
  const openRiddor = riddor.filter((r) => r?.status && r.status !== "closed" && r.status !== "submitted");

  const anhangCoverage = DE_ANHANG_II_WORKS.map((item) => {
    const linkedPermits = permits.filter((p) => item.permitTypeIds.includes(p?.type));
    return {
      ...item,
      hasCoverage: linkedPermits.length > 0,
      linkedCount: linkedPermits.length,
    };
  });

  return {
    activeSigePlan,
    cdmPackCount: cdmPacks.length,
    openPermits,
    expiredPermits,
    trainingCount: training.length,
    staleTraining,
    openIncidentActions,
    openRiddor,
    anhangCoverage,
  };
}

/**
 * Builds the printable HTML for the DACH compliance snapshot.
 * @param {MarketId} marketId
 */
export function buildDachComplianceSnapshotHtml(marketId) {
  const market = isDachMarket(marketId) ? marketId : "de";
  const copy = COPY_BY_MARKET[market];
  const regulator = REGULATOR_BY_MARKET[market];
  const org = getOrgSettings();
  const data = buildDachComplianceData(market);

  const sigeStatus = data.activeSigePlan
    ? statusChip(copy.statusOk, "ok")
    : statusChip(copy.statusBad, "bad");

  const permitsStatus =
    data.expiredPermits.length > 0
      ? statusChip(`${data.expiredPermits.length} ${copy.statusWarn}`, "warn")
      : statusChip(copy.statusOk, "ok");

  const trainingStatus =
    data.staleTraining.length > 0
      ? statusChip(`${data.staleTraining.length} ${copy.statusWarn}`, "warn")
      : statusChip(copy.statusOk, "ok");

  const incidentStatus =
    data.openIncidentActions.length > 0 || data.openRiddor.length > 0
      ? statusChip(`${data.openIncidentActions.length + data.openRiddor.length} offen`, "warn")
      : statusChip(copy.statusOk, "ok");

  const anhangRows = data.anhangCoverage
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.short)}</td>
        <td class="dcs-anhang-desc">${escapeHtml(item.label)}</td>
        <td>${item.hasCoverage ? statusChip(`${item.linkedCount} Freigabe(n)`, "ok") : statusChip(copy.statusBad, "bad")}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <div class="dcs-hero">
      <h1>${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(copy.subtitle)}</p>
      <p class="dcs-meta">${escapeHtml(copy.generatedLabel)}: ${escapeHtml(new Date().toLocaleDateString("de-DE"))} · ${escapeHtml(regulator.name)}</p>
    </div>

    <div class="dcs-grid">
      <div class="dcs-card">
        <div class="dcs-card__label">${escapeHtml(copy.sigePlanLabel)}</div>
        <div class="dcs-card__value">${data.cdmPackCount}</div>
        ${sigeStatus}
      </div>
      <div class="dcs-card">
        <div class="dcs-card__label">${escapeHtml(copy.permitLabel)}</div>
        <div class="dcs-card__value">${data.openPermits.length}</div>
        ${permitsStatus}
      </div>
      <div class="dcs-card">
        <div class="dcs-card__label">${escapeHtml(copy.trainingLabel)}</div>
        <div class="dcs-card__value">${data.trainingCount}</div>
        ${trainingStatus}
      </div>
      <div class="dcs-card">
        <div class="dcs-card__label">${escapeHtml(copy.incidentLabel)}</div>
        <div class="dcs-card__value">${data.openIncidentActions.length + data.openRiddor.length}</div>
        ${incidentStatus}
      </div>
    </div>

    ${formSection(copy.anhangLabel)}
    <table class="dcs-anhang-table">
      <thead><tr><th></th><th>${escapeHtml(copy.anhangLabel)}</th><th></th></tr></thead>
      <tbody>${anhangRows}</tbody>
    </table>

    <div class="dcs-disclaimer">${escapeHtml(copy.disclaimer)}</div>
  `;

  const extraCss = `
    .dcs-hero { margin-bottom: 16px; }
    .dcs-hero h1 { margin: 0 0 4px; font-size: 20px; }
    .dcs-hero p { margin: 0; font-size: 13px; color: #555; }
    .dcs-meta { margin-top: 4px !important; font-size: 11px !important; }
    .dcs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .dcs-card { border: 1px solid #ddd; border-radius: 6px; padding: 10px; }
    .dcs-card__label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.02em; }
    .dcs-card__value { font-size: 24px; font-weight: 700; margin: 4px 0; }
    .dcs-chip { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .dcs-chip--ok { background: #dcfce7; color: #166534; }
    .dcs-chip--warn { background: #fef3c7; color: #92400e; }
    .dcs-chip--bad { background: #fee2e2; color: #991b1b; }
    .dcs-anhang-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    .dcs-anhang-table th, .dcs-anhang-table td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; }
    .dcs-anhang-desc { color: #555; }
    .dcs-disclaimer { margin-top: 24px; padding: 10px; background: #f9fafb; border-radius: 6px; font-size: 11px; color: #666; line-height: 1.5; }
  `;

  return wrapPrintHtmlDocument(org, {
    pageTitle: copy.title,
    bodyHtml,
    extraCss,
    headerOpts: {
      docTitle: copy.title,
      docSubtitle: copy.subtitle,
      docBadge: regulator.short,
    },
    metaFields: {
      moduleLabel: copy.title,
      recordNote: copy.subtitle,
    },
    footerExtra: copy.disclaimer,
  });
}

/**
 * Opens the print dialog with the DACH compliance snapshot.
 * @param {MarketId} marketId
 */
export function printDachComplianceSnapshot(marketId) {
  const html = buildDachComplianceSnapshotHtml(marketId);
  return openRegisterFormPrint(html);
}

/** True if this market gets the DACH inspection-ready export (Business+ tier hook). */
export function supportsDachComplianceSnapshot(marketId) {
  return isDachMarket(marketId);
}
