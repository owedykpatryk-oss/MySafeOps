/**
 * Auto weather risk row for outdoor RAMS when site weather is fetched / outdoor flagged.
 */

export const WEATHER_HAZARD_SOURCE_ID = "weather_outdoor_auto";

/** @param {{ description?: string, text?: string, tempC?: number } | null | undefined} snap */
export function isAdverseWeatherSnapshot(snap) {
  const t = `${snap?.description || ""} ${snap?.text || ""}`.toLowerCase();
  if (/(rain|drizzle|shower|thunder|snow|storm|gale|sleet|hail|fog)/.test(t)) return true;
  const windMatch = t.match(/wind\s*~?\s*([\d.]+)\s*mph/);
  if (windMatch && Number(windMatch[1]) >= 25) return true;
  if (Number.isFinite(snap?.tempC) && (snap.tempC <= 2 || snap.tempC >= 32)) return true;
  return false;
}

/**
 * Build a library-shaped hazard template for weather / outdoor exposure.
 * @param {{ outdoor?: boolean, snap?: object } } opts
 */
export function buildWeatherHazardTemplate({ outdoor = true, snap = null } = {}) {
  if (!outdoor && !isAdverseWeatherSnapshot(snap)) return null;
  const adverse = isAdverseWeatherSnapshot(snap);
  const condition = String(snap?.description || "").trim() || "site weather";
  const note = String(snap?.text || "").trim();

  return {
    id: WEATHER_HAZARD_SOURCE_ID,
    category: "General Site",
    activity: outdoor ? "Outdoor site work / survey tasks" : "Site work affected by weather",
    hazard: adverse
      ? `Adverse weather (${condition}) — slips, reduced visibility, wind loading, exposure`
      : "Outdoor weather exposure — slips, glare, UV, sudden change in conditions",
    initialRisk: adverse ? { L: 4, S: 4, RF: 16 } : { L: 3, S: 3, RF: 9 },
    controlMeasures: [
      "Check forecast before leaving cabin; stop or postpone if lightning, high winds, ice, or flooded ground",
      "Suitable outdoor PPE / wet weather clothing; anti-slip footwear on wet surfaces",
      "Monitor wind for plant, tripods, GPR cart and survey targets; secure loose equipment",
      "Dynamic risk assessment if conditions change mid-task; brief team on hold / abort criteria",
      note ? `Latest site weather note: ${note.slice(0, 220)}` : "Record live site weather in RAMS Further details",
    ].filter(Boolean),
    revisedRisk: adverse ? { L: 2, S: 3, RF: 6 } : { L: 2, S: 2, RF: 4 },
    ppeRequired: ["Safety footwear", "Hi-vis vest", "Weather-appropriate clothing", "Eye protection (as required)"],
    regs: ["Workplace (Health, Safety and Welfare) Regulations", "Management of Health & Safety at Work Regulations"],
  };
}

/**
 * Upsert weather auto-row into editedRows + selectedHazards selection helpers.
 * @returns {{ rows: object[], selected: object[], added: boolean, updated: boolean }}
 */
export function upsertWeatherHazardIntoRows(editedRows, selectedHazards, template) {
  if (!template) {
    return {
      rows: Array.isArray(editedRows) ? editedRows : [],
      selected: Array.isArray(selectedHazards) ? selectedHazards : [],
      added: false,
      updated: false,
    };
  }
  const rows = Array.isArray(editedRows) ? [...editedRows] : [];
  const selected = Array.isArray(selectedHazards) ? [...selectedHazards] : [];
  const idx = rows.findIndex((r) => r.sourceId === WEATHER_HAZARD_SOURCE_ID || r.id === WEATHER_HAZARD_SOURCE_ID);
  if (idx >= 0) {
    const keepId = rows[idx].id;
    rows[idx] = {
      ...template,
      sourceId: WEATHER_HAZARD_SOURCE_ID,
      id: keepId,
      rowSource: "manual",
    };
    return { rows, selected, added: false, updated: true };
  }
  const stamped = {
    ...JSON.parse(JSON.stringify(template)),
    sourceId: WEATHER_HAZARD_SOURCE_ID,
    id: `wx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    rowSource: "manual",
  };
  rows.push(stamped);
  if (!selected.some((s) => s.id === WEATHER_HAZARD_SOURCE_ID)) {
    selected.push({ id: WEATHER_HAZARD_SOURCE_ID });
  }
  return { rows, selected, added: true, updated: false };
}
