/**
 * Survey geology / verification upgrades — multi-AOC samples, borehole links, trial-hole → QL-B0, TFR CAD notes.
 */
import { escapeHtml, escapeAttr } from "../../utils/htmlEscape.js";
import { safeHttpUrl } from "../../utils/safeUrl.js";
import { fetchGeologyAtPoint } from "../../utils/bgsGeologyClient";
import { interpretGeologyForSurvey, projectHasMapPin } from "../../utils/gprGroundConditions";

const esc = escapeHtml;

/**
 * Collect geology sample points: project pin + AOC extents with lat/lng (max 3).
 * @param {object} report
 * @param {{ lat: number, lng: number, label?: string }} primary
 */
export function collectGeologySamplePoints(report, primary) {
  const points = [];
  if (primary && Number.isFinite(primary.lat) && Number.isFinite(primary.lng)) {
    points.push({
      id: "primary",
      label: primary.label || "Project pin",
      lat: Number(primary.lat),
      lng: Number(primary.lng),
    });
  }
  const extents = [...(report?.extentAreas || []), ...(report?.surveyAreas || [])];
  for (const a of extents) {
    if (points.length >= 3) break;
    const lat = parseFloat(String(a.lat ?? "").trim());
    const lng = parseFloat(String(a.lng ?? "").trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const dup = points.some((p) => Math.abs(p.lat - lat) < 1e-5 && Math.abs(p.lng - lng) < 1e-5);
    if (dup) continue;
    points.push({
      id: a.id || `aoc_${points.length}`,
      label: a.label || a.chainage || `AOC ${points.length}`,
      lat,
      lng,
    });
  }
  return points;
}

/**
 * Fetch geology at multiple sample points (primary already fetched may be passed via primaryPayload).
 * @param {object} report
 * @param {object} project
 * @param {{ primaryPayload?: object, primaryCoords?: { lat: number, lng: number }, accuracyWarning?: string, coordSource?: string }} [opts]
 */
export async function enrichGeologyWithSamplePoints(report, project, opts = {}) {
  const primaryCoords = opts.primaryCoords;
  if (!primaryCoords) return report.geology || {};

  const points = collectGeologySamplePoints(report, {
    ...primaryCoords,
    label: projectHasMapPin(project) ? "Project pin" : "Lookup point",
  });

  const samples = [];
  for (const pt of points) {
    let payload = null;
    if (
      opts.primaryPayload &&
      Math.abs(pt.lat - primaryCoords.lat) < 1e-5 &&
      Math.abs(pt.lng - primaryCoords.lng) < 1e-5
    ) {
      payload = opts.primaryPayload;
    } else {
      try {
        payload = await fetchGeologyAtPoint(pt.lat, pt.lng);
      } catch {
        continue;
      }
    }
    const mapped = interpretGeologyForSurvey(payload, {
      weather: report.weather,
      accuracyWarning: opts.accuracyWarning || "",
      coordSource: pt.label,
    });
    samples.push({
      id: pt.id,
      label: pt.label,
      lat: pt.lat,
      lng: pt.lng,
      formation: mapped.formation,
      materialClass: mapped.materialClass,
      attenuationClass: mapped.attenuationClass,
      scale: mapped.scale,
      superficialLabel: mapped.superficialLabel,
      bedrockLabel: mapped.bedrockLabel,
      artificialLabel: mapped.artificialLabel,
    });
  }

  const geology = { ...(report.geology || {}) };
  geology.samplePoints = samples;
  if (samples.length > 1) {
    const classes = [...new Set(samples.map((s) => s.materialClass).filter(Boolean))];
    if (classes.length > 1) {
      const extra = `Multi-point BGS samples differ (${samples
        .map((s) => `${s.label}: ${s.materialClass?.replace(/_/g, " ") || "—"}`)
        .join("; ")}). Confirm which unit applies along each AOC.`;
      geology.implications = geology.implications?.includes("Multi-point")
        ? geology.implications
        : `${geology.implications || ""} ${extra}`.trim();
    }
  }
  return geology;
}

/** Safe HTML link for a BGS borehole scan. */
export function boreholeScanLinkHtml(borehole) {
  const href = safeHttpUrl(borehole?.scanUrl);
  const label = borehole?.reference || borehole?.name || "Scan";
  if (!href) return esc(label);
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/**
 * Apply trial-hole verification to utility schedule — bump matched rows to QL-B0 and annotate.
 * @param {object} report
 * @param {{ overwriteQl?: boolean }} [opts]
 */
export function applyTrialHolesToUtilities(report, opts = {}) {
  const overwriteQl = opts.overwriteQl !== false;
  const holes = (report.trialHolesTable || []).filter((h) => h && (h.utilityVerified || h.result));
  if (!holes.length) return { ...report, _trialHoleApply: { updated: 0, created: 0 } };

  let utilities = [...(report.utilitiesTable || [])];
  let updated = 0;
  let created = 0;

  for (const h of holes) {
    const utilType = h.utilityVerified || "";
    const holeId = h.holeId || "TH";
    const ql = h.pas128Ql || "B0";
    const noteBit = `Verified by trial hole ${holeId}${h.result ? ` — ${h.result}` : ""}${h.depth ? ` @ ${h.depth}` : ""}`;

    let idx = -1;
    if (utilType) {
      idx = utilities.findIndex(
        (u) =>
          u.utilityType === utilType &&
          !String(u.notes || "").includes(`trial hole ${holeId}`)
      );
      if (idx < 0) {
        idx = utilities.findIndex((u) => u.utilityType === utilType);
      }
    }

    if (idx >= 0) {
      const row = { ...utilities[idx] };
      if (overwriteQl || !row.pas128Ql) row.pas128Ql = ql === "B0" || !row.pas128Ql ? "B0" : row.pas128Ql;
      if (ql === "B0") row.pas128Ql = "B0";
      row.detectStatus = row.detectStatus || "detected";
      row.notes = row.notes?.includes(noteBit) ? row.notes : [row.notes, noteBit].filter(Boolean).join(". ");
      if (h.depth && !row.depth) row.depth = h.depth;
      utilities[idx] = row;
      updated += 1;
    } else if (utilType) {
      utilities.push({
        id: `util_th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        utilityType: utilType,
        depth: h.depth || "",
        method: "Trial hole / Type B0",
        pas128Ql: "B0",
        confidence: "high",
        detectStatus: "detected",
        source: "visual",
        notes: noteBit,
      });
      created += 1;
    }
  }

  return {
    ...report,
    utilitiesTable: utilities,
    trialHolesAppliedAt: new Date().toISOString(),
    _trialHoleApply: { updated, created },
  };
}

/**
 * Seed CAD / site-plan notes from TFR record matrix rows.
 * @param {object} report
 * @param {{ overwrite?: boolean }} [opts]
 */
export function seedTfrCadNotesFromRecords(report, opts = {}) {
  const overwrite = Boolean(opts.overwrite);
  const tfrRows = (report.recordItems || []).filter((r) => r && (r.status === "tfr" || r.tfr));
  if (!tfrRows.length) return report;

  const block = tfrRows
    .map((r) => {
      const who = r.undertaker || r.serviceType || "Undertaker";
      const extra = String(r.notes || "").trim();
      return `TFR — ${who}${extra ? `: ${extra}` : " — add to drawing as TFR (records only; not detected on site)."}`;
    })
    .join("\n");

  const prev = String(report.sitePlanSummary || "").trim();
  let sitePlanSummary = prev;
  if (overwrite || !prev) {
    sitePlanSummary = block;
  } else if (!prev.includes("TFR —")) {
    sitePlanSummary = `${prev}\n\n${block}`;
  }

  const drawingSheets = [...(report.drawingSheets || [])];
  if (drawingSheets.length) {
    drawingSheets[0] = {
      ...drawingSheets[0],
      notes: overwrite || !drawingSheets[0].notes?.trim()
        ? block
        : drawingSheets[0].notes.includes("TFR —")
          ? drawingSheets[0].notes
          : `${drawingSheets[0].notes}\n${block}`,
    };
  }

  return {
    ...report,
    sitePlanSummary,
    drawingSheets,
    tfrCadNotesAt: new Date().toISOString(),
  };
}

/** Print helper: sample points table. */
export function buildGeologySamplePointsHtml(samples = []) {
  const list = (samples || []).filter((s) => s && (s.label || s.formation));
  if (list.length < 2) return "";
  const rows = list
    .map(
      (s) =>
        `<tr><td>${esc(s.label || "—")}</td><td>${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}</td><td>${esc(s.materialClass?.replace(/_/g, " ") || "—")}</td><td>${esc(s.superficialLabel || s.formation || "—")}</td></tr>`
    )
    .join("");
  return `<div class="sr-geology__samples"><div class="sr-thickbox__title" style="font-size:10pt;margin-top:8px">Multi-point BGS samples</div>
<table class="sr-data-table"><thead><tr><th>Point</th><th>Coords</th><th>Class</th><th>Superficial / formation</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
