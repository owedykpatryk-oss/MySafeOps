/**
 * Survey field upgrades — revision A→B records diff, one-tap evidence, undertaker paste.
 */
import { escapeHtml } from "../../utils/htmlEscape.js";
import { blankEvidenceRow, blankRecordItem, recordServiceLabel, recordStatusLabel } from "./surveyEvidencePack.js";
import { geoPhotoPreset } from "../../utils/geoPhotoPresets.js";

import { todayLocalISO } from "../../utils/localDate";
const esc = escapeHtml;

function uid(prefix = "row") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function recordKey(row) {
  return [
    String(row?.undertaker || "")
      .trim()
      .toLowerCase(),
    String(row?.serviceType || "other").trim().toLowerCase(),
  ].join("|");
}

function utilKey(row) {
  return [
    String(row?.utilityType || row?.label || "")
      .trim()
      .toLowerCase(),
    String(row?.pas128Ql || "").trim().toLowerCase(),
    String(row?.depth || "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Snapshot used when bumping revision — records + utilities for later A→B compare.
 * @param {object} report
 */
export function captureSurveyRevisionSnapshot(report) {
  return {
    at: new Date().toISOString(),
    revision: report?.documentControl?.revision || "A",
    recordItems: (report?.recordItems || []).map((r) => ({
      undertaker: r.undertaker || "",
      serviceType: r.serviceType || "other",
      status: r.status || "",
      tfr: Boolean(r.tfr || r.status === "tfr"),
      notes: r.notes || "",
    })),
    utilitiesTable: (report?.utilitiesTable || []).map((u) => ({
      utilityType: u.utilityType || u.label || "",
      pas128Ql: u.pas128Ql || "",
      depth: u.depth || "",
      method: u.method || "",
      confidence: u.confidence || "",
      notes: u.notes || "",
    })),
  };
}

/**
 * Visual A→B records / utilities diff (new TFR, newly located, removed, new schedule rows).
 * @param {object|null} beforeSnapshotOrReport — snapshot or full previous report
 * @param {object} afterReport
 */
export function buildRecordsRevisionDiff(beforeSnapshotOrReport, afterReport) {
  const before =
    beforeSnapshotOrReport?.at && Array.isArray(beforeSnapshotOrReport.recordItems)
      ? beforeSnapshotOrReport
      : captureSurveyRevisionSnapshot(beforeSnapshotOrReport || {});
  const after = captureSurveyRevisionSnapshot(afterReport || {});

  const beforeMap = new Map((before.recordItems || []).map((r) => [recordKey(r), r]));
  const afterMap = new Map((after.recordItems || []).map((r) => [recordKey(r), r]));

  const newTfr = [];
  const newlyLocated = [];
  const statusChanged = [];
  const removed = [];

  for (const [key, row] of afterMap) {
    const prev = beforeMap.get(key);
    if (!prev) {
      if (row.status === "tfr" || row.tfr) newTfr.push(row);
      else if (row.status === "located") newlyLocated.push(row);
      else statusChanged.push({ ...row, from: "—", to: row.status });
      continue;
    }
    const wasTfr = prev.status === "tfr" || prev.tfr;
    const isTfr = row.status === "tfr" || row.tfr;
    if (!wasTfr && isTfr) newTfr.push(row);
    else if (prev.status !== "located" && row.status === "located") newlyLocated.push(row);
    else if (prev.status !== row.status) statusChanged.push({ ...row, from: prev.status, to: row.status });
  }
  for (const [key, row] of beforeMap) {
    if (!afterMap.has(key)) removed.push(row);
  }

  const beforeUtils = new Set((before.utilitiesTable || []).map(utilKey));
  const newUtilities = (after.utilitiesTable || []).filter((u) => !beforeUtils.has(utilKey(u)));

  return {
    fromRevision: before.revision || "",
    toRevision: after.revision || "",
    newTfr,
    newlyLocated,
    statusChanged,
    removed,
    newUtilities,
    hasChanges:
      newTfr.length + newlyLocated.length + statusChanged.length + removed.length + newUtilities.length > 0,
  };
}

/**
 * Print HTML for records revision diff.
 * @param {ReturnType<typeof buildRecordsRevisionDiff>} diff
 */
export function buildRevisionDiffHtml(diff) {
  if (!diff?.hasChanges) return "";
  const from = diff.fromRevision || "prev";
  const to = diff.toRevision || "this";
  const chip = (label, rows, tone) => {
    if (!rows?.length) return "";
    const list = rows
      .map((r) => {
        const name = r.undertaker || recordServiceLabel(r.serviceType) || r.utilityType || "Item";
        const detail =
          r.to != null
            ? `${r.from || "—"} → ${r.to}`
            : r.notes || recordStatusLabel(r.status) || r.pas128Ql || r.depth || "";
        return `<li><strong>${esc(name)}</strong>${detail ? ` — ${esc(detail)}` : ""}</li>`;
      })
      .join("");
    return `<div class="sr-revdiff__block sr-revdiff__block--${tone}">
  <div class="sr-revdiff__label">${esc(label)} (${rows.length})</div>
  <ul>${list}</ul>
</div>`;
  };

  return `<div class="sr-revdiff">
  <div class="sr-thickbox__title">Revision compare · Rev ${esc(from)} → Rev ${esc(to)}</div>
  <p class="sr-revdiff__intro">What changed in records and utility schedule since the previous issue.</p>
  <div class="sr-revdiff__grid">
    ${chip("New / upgraded TFR", diff.newTfr, "tfr")}
    ${chip("Newly located", diff.newlyLocated, "ok")}
    ${chip("Status changes", diff.statusChanged, "chg")}
    ${chip("Removed from matrix", diff.removed, "rm")}
    ${chip("New utility schedule rows", diff.newUtilities, "util")}
  </div>
</div>`;
}

export const SURVEY_REVISION_DIFF_CSS = `
.sr-revdiff { margin: 12px 0 16px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; page-break-inside: avoid; }
.sr-revdiff__intro { font-size: 9.5pt; color: #64748b; margin: 0 0 10px; }
.sr-revdiff__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sr-revdiff__block { border-radius: 10px; padding: 8px 10px; background: #fff; border: 1px solid #e2e8f0; }
.sr-revdiff__block--tfr { border-color: #f59e0b; background: #fffbeb; }
.sr-revdiff__block--ok { border-color: #34d399; background: #ecfdf5; }
.sr-revdiff__block--chg { border-color: #60a5fa; background: #eff6ff; }
.sr-revdiff__block--rm { border-color: #f87171; background: #fef2f2; }
.sr-revdiff__block--util { border-color: #00B4E4; background: #f0f9ff; }
.sr-revdiff__label { font-weight: 800; font-size: 9pt; color: #0B1D3A; margin-bottom: 4px; }
.sr-revdiff__block ul { margin: 0; padding-left: 16px; font-size: 9pt; }
`;

/**
 * One-tap evidence row from a geo-photo.
 * @param {object} photo
 * @param {{ aocId?: string, undertaker?: string, tfr?: boolean }} [opts]
 */
export function evidenceRowFromGeoPhoto(photo, opts = {}) {
  const preset = geoPhotoPreset(photo?.type || photo?.category || "general_site_condition");
  const url = photo?.dataUrl || photo?.url || "";
  const label = photo?.label || photo?.caption || preset.label || "Site evidence";
  const tfrHint =
    /tfr|records|desktop|undertaker/i.test(String(photo?.type || "")) ||
    /constraint|locked|vegetation|access/i.test(String(photo?.type || ""));
  return blankEvidenceRow({
    title: label,
    undertaker: opts.undertaker || "",
    aocId: opts.aocId || "",
    photoUrls: url ? [url] : [],
    cadImageUrl: "",
    tfr: Boolean(opts.tfr),
    body: tfrHint
      ? `${label} — add CAD crop and confirm whether this is located, TFR (records-derived) or a site constraint.`
      : `${label} — add CAD crop / plan excerpt and a short explanation (located / TFR / constraint).`,
    status: opts.tfr ? "tfr" : "",
  });
}

/**
 * Append evidence rows from project geo-photos (skip already linked URLs).
 * @param {object} report
 * @param {object[]} geoPhotos
 * @param {{ limit?: number, projectId?: string }} [opts]
 */
export function appendEvidenceFromGeoPhotos(report, geoPhotos = [], opts = {}) {
  const projectId = opts.projectId || report.projectId;
  const limit = opts.limit ?? 8;
  const existing = new Set(
    (report.evidenceRows || []).flatMap((e) => [...(e.photoUrls || []), e.cadImageUrl].filter(Boolean))
  );
  const photos = (geoPhotos || []).filter((p) => p && (!projectId || p.projectId === projectId));
  const added = [];
  for (const p of photos) {
    if (added.length >= limit) break;
    const url = p.dataUrl || p.url;
    if (!url || existing.has(url)) continue;
    existing.add(url);
    added.push(evidenceRowFromGeoPhoto(p));
  }
  return {
    ...report,
    evidenceRows: [...(report.evidenceRows || []), ...added],
    updatedAt: new Date().toISOString(),
  };
}

/** Service-type guesses from undertaker / LSBUD-style mail text. */
const PASTE_SERVICE_RULES = [
  { serviceType: "gas", re: /\b(gas|sgn|cadent|wwu|ngn|ww utilities)\b/i },
  { serviceType: "water", re: /\b(water|severn trent|thames water|united utilities|welsh water|affinity)\b/i },
  { serviceType: "electric", re: /\b(electric|electricity|dno|ukpn|nged|ssen|enwl|npg|scottish power|hv|lv)\b/i },
  { serviceType: "telecoms", re: /\b(bt|openreach|telecom|virgin media|vodafone|cityfibre|fibre)\b/i },
  { serviceType: "drainage", re: /\b(drainage|sewer|foul|surface water|highway drain)\b/i },
  { serviceType: "catv", re: /\b(catv|cable tv)\b/i },
];

function guessServiceType(line) {
  for (const rule of PASTE_SERVICE_RULES) {
    if (rule.re.test(line)) return rule.serviceType;
  }
  return "other";
}

function guessStatus(line) {
  const s = line.toLowerCase();
  if (/\b(no plant|not affected|clear|nil return|no apparatus)\b/.test(s)) return "not_located";
  if (/\b(tfr|to follow|records only|from records)\b/.test(s)) return "tfr";
  if (/\b(partial|incomplete)\b/.test(s)) return "partial";
  if (/\b(no response|awaiting|chased)\b/.test(s)) return "no_response";
  if (/\b(affected|plant present|apparatus|located|shown on)\b/.test(s)) return "located";
  return "partial";
}

/**
 * Parse pasted LSBUD / undertaker email text into record rows.
 * @param {string} text
 * @returns {{ items: object[], responses: object[] }}
 */
export function parseUndertakerPaste(text) {
  const raw = String(text || "").trim();
  if (!raw) return { items: [], responses: [] };

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^[-*=]{3,}$/.test(l));

  const items = [];
  const responses = [];
  const seen = new Set();

  for (const line of lines) {
    // Prefer lines that look like undertaker outcomes
    if (!/[a-zA-Z]{3,}/.test(line)) continue;
    if (line.length > 220) continue;
    const serviceType = guessServiceType(line);
    const status = guessStatus(line);
    // Extract a short undertaker name — first clause before : or –
    let undertaker = line.split(/[:–—|]/)[0]?.trim() || line;
    undertaker = undertaker.replace(/\s{2,}/g, " ").slice(0, 80);
    if (undertaker.length < 3) continue;
    const key = `${undertaker.toLowerCase()}|${serviceType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push(
      blankRecordItem({
        id: uid("rec"),
        undertaker,
        serviceType,
        status,
        tfr: status === "tfr",
        notes: line.slice(0, 200),
      })
    );
    responses.push({
      id: uid("ur"),
      undertaker,
      status:
        status === "not_located"
          ? "not_affected"
          : status === "no_response"
            ? "no_response"
            : "affected",
      notes: line.slice(0, 200),
      date: todayLocalISO(),
    });
  }

  return { items: items.slice(0, 24), responses: responses.slice(0, 24) };
}

/**
 * Merge paste parse into report (append unique undertakers).
 * @param {object} report
 * @param {string} text
 */
export function applyUndertakerPaste(report, text) {
  const { items, responses } = parseUndertakerPaste(text);
  if (!items.length) return { report, added: 0 };

  const existingKeys = new Set((report.recordItems || []).map(recordKey));
  const newItems = items.filter((r) => !existingKeys.has(recordKey(r)));
  const existingResp = new Set(
    (report.undertakerResponses || []).map((r) => String(r.undertaker || "").trim().toLowerCase())
  );
  const newResp = responses.filter((r) => !existingResp.has(String(r.undertaker || "").trim().toLowerCase()));

  return {
    report: {
      ...report,
      recordItems: [...(report.recordItems || []), ...newItems],
      undertakerResponses: [...(report.undertakerResponses || []), ...newResp],
      updatedAt: new Date().toISOString(),
    },
    added: newItems.length,
  };
}

/**
 * ZIP pack checklist / preview page (HTML).
 * @param {string[]} fileNames
 * @param {object} report
 */
export function buildHandoverChecklistHtml(fileNames = [], report = {}) {
  const rows = (fileNames || [])
    .map((n) => `<li><code>${esc(n)}</code></li>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/>
<title>Handover checklist — ${esc(report.ref || "survey")}</title>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; max-width: 720px; margin: 32px auto; color: #0f172a; padding: 0 16px; }
  h1 { font-size: 18pt; color: #0B1D3A; }
  .meta { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
  ul { line-height: 1.7; }
  code { font-size: 9.5pt; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px 16px; background: #f8fafc; }
</style></head><body>
<h1>Handover pack checklist</h1>
<div class="meta">${esc(report.ref || "—")} · Rev ${esc(report.documentControl?.revision || "A")} · ${esc(report.client || "")}</div>
<div class="box">
  <p>Contents of this ZIP (${fileNames.length} file${fileNames.length === 1 ? "" : "s"}):</p>
  <ul>${rows || "<li>(empty)</li>"}</ul>
</div>
<p style="font-size:9pt;color:#64748b;margin-top:20px">Controlled deliverable — confirm the latest approved revision before use.</p>
</body></html>`;
}
