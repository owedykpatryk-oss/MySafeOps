/**
 * Interpret BGS geology + site observations for GPR propagation, penetration and limitations.
 */

/** @typedef {'very_low'|'low'|'moderate'|'high'|'very_high'} AttenuationClass */
/** @typedef {'excellent'|'good'|'moderate'|'poor'|'very_poor'} CouplingClass */

const CLAY_MARKERS = /\b(CLAY|CLSS|MUD|SILT|PEAT|BOULDER CLAY|TILL|GLACI)\b/i;
const SAND_MARKERS = /\b(SAND|SANDU|GRAV|GRAVEL|GRSS|CHALK)\b/i;
const MADE_GROUND = /\b(MADE|ARTIFICIAL|WORKED|INFILL|RUBBLE|ASH|SLAG|BRICK)\b/i;
const LIMESTONE_MARKERS = /\b(LIME|CHALK|DOLOM)\b/i;
const ROCK_MARKERS = /\b(GRAN|BASALT|GNEISS|SANDSTONE|MUDSTONE|SHALE|SLATE)\b/i;

/**
 * @param {{ lexDescription?: string, rockDescription?: string, rcsDescription?: string, maxSystem?: string } | null} layer
 */
export function classifyGeologyLayer(layer) {
  if (!layer) return { materialClass: "unknown", attenuation: "moderate", dielectric: [4, 9] };
  const text = [layer.lexDescription, layer.rockDescription, layer.rcsDescription, layer.maxSystem]
    .filter(Boolean)
    .join(" ");

  if (MADE_GROUND.test(text)) {
    return { materialClass: "made_ground", attenuation: "very_high", dielectric: [6, 15] };
  }
  if (CLAY_MARKERS.test(text)) {
    return { materialClass: "clay_silt", attenuation: "high", dielectric: [8, 20] };
  }
  if (SAND_MARKERS.test(text) && !CLAY_MARKERS.test(text)) {
    return { materialClass: "sand_gravel", attenuation: "low", dielectric: [4, 8] };
  }
  if (LIMESTONE_MARKERS.test(text)) {
    return { materialClass: "limestone_chalk", attenuation: "moderate", dielectric: [6, 12] };
  }
  if (ROCK_MARKERS.test(text)) {
    return { materialClass: "bedrock", attenuation: "moderate", dielectric: [5, 10] };
  }
  return { materialClass: "mixed", attenuation: "moderate", dielectric: [5, 12] };
}

/**
 * Expected depth penetration (m) by antenna centre frequency and attenuation class.
 * @param {number} freqMhz
 * @param {AttenuationClass} attenuation
 */
export function expectedPenetrationM(freqMhz, attenuation) {
  const f = Number(freqMhz) || 400;
  const base = f >= 900 ? 0.8 : f >= 600 ? 1.2 : f >= 400 ? 2.0 : f >= 250 ? 3.0 : f >= 150 ? 4.0 : 5.0;
  const mult = {
    very_low: 1.4,
    low: 1.15,
    moderate: 1.0,
    high: 0.65,
    very_high: 0.4,
  }[attenuation] ?? 1.0;
  return Math.round(base * mult * 10) / 10;
}

/**
 * Recommend antenna band for target depth and ground class.
 * @param {number} targetDepthM
 * @param {AttenuationClass} attenuation
 */
export function recommendAntennaMhz(targetDepthM, attenuation) {
  const d = Number(targetDepthM) || 2;
  const att = attenuation || "moderate";
  if (d <= 0.8 && att !== "very_high") return { mhz: 900, label: "900 MHz — shallow high-resolution" };
  if (d <= 1.5 && att !== "high" && att !== "very_high") return { mhz: 600, label: "600 MHz — shallow utilities" };
  if (d <= 2.5) return { mhz: 400, label: "400 MHz — general utility mapping" };
  if (d <= 4 && att !== "very_high") return { mhz: 250, label: "250 MHz — deeper targets" };
  return { mhz: 150, label: "150 MHz — deep penetration (lower resolution)" };
}

/**
 * Build GPR-specific ground narrative from BGS + field observations.
 * @param {object} params
 */
export function buildGprGroundNarrative({ bedrock, superficial, siteObservations = {}, antennaMhz } = {}) {
  const sup = classifyGeologyLayer(superficial);
  const bed = classifyGeologyLayer(bedrock);
  const dominant = sup.materialClass !== "unknown" ? sup : bed;
  const parts = [];

  if (superficial?.lexDescription) {
    parts.push(
      `BGS superficial geology (1:625k): ${superficial.lexDescription}${superficial.rockDescription ? ` — ${superficial.rockDescription}` : ""}.`
    );
  }
  if (bedrock?.lexDescription) {
    parts.push(
      `BGS bedrock (1:625k): ${bedrock.lexDescription}${bedrock.rockDescription ? ` — ${bedrock.rockDescription}` : ""}.`
    );
  }

  const attLabel = {
    very_low: "very low",
    low: "low",
    moderate: "moderate",
    high: "high",
    very_high: "very high",
  }[dominant.attenuation];

  parts.push(
    `Expected GPR attenuation in this geology is ${attLabel}, with indicative relative permittivity εr ≈ ${dominant.dielectric[0]}–${dominant.dielectric[1]}.`
  );

  const freq = Number(antennaMhz) || 400;
  const pen = expectedPenetrationM(freq, dominant.attenuation);
  parts.push(
    `At ${freq} MHz centre frequency, indicative penetration is ~${pen} m in these conditions (excluding local anomalies, reinforcement or high moisture).`
  );

  if (dominant.materialClass === "clay_silt") {
    parts.push("Clay-rich superficial deposits increase conductivity and reduce GPR depth — consider lower frequency or supplementary EML.");
  }
  if (dominant.materialClass === "made_ground") {
    parts.push("Made ground is heterogeneous; hyperbola matching and velocity calibration on known targets are essential.");
  }

  const obs = siteObservations;
  if (obs.moisture === "wet" || obs.moisture === "waterlogged") {
    parts.push("Elevated near-surface moisture will increase attenuation and may reduce achieved penetration versus dry conditions.");
  }
  if (obs.reinforcement === "present" || obs.reinforcement === "extensive") {
    parts.push("Reinforced concrete or mesh will scatter GPR energy and create clutter — interpret shallow anomalies with caution.");
  }
  if (obs.surfaceType === "asphalt" || obs.surfaceType === "concrete") {
    parts.push("Hard sealed surfaces may reduce antenna coupling; time-zero adjustment and pressure on the antenna foot are critical.");
  }

  return parts.join(" ");
}

/**
 * Weather → GPR coupling and data quality impact.
 * @param {object} env
 */
export function buildGprWeatherImpactNarrative(env = {}) {
  const parts = [];
  const desc = env.description || "";
  const rain = env.rainDuringSurvey || "unknown";
  const ground = env.groundSurface || "unknown";

  if (desc) parts.push(`Conditions on survey date: ${desc}.`);
  if (env.tempMinC != null && env.tempC != null) {
    parts.push(`Air temperature band ~${env.tempMinC}–${env.tempC}°C.`);
  } else if (env.tempC != null) {
    parts.push(`Air temperature ~${env.tempC}°C.`);
  }

  if (rain === "heavy" || desc.toLowerCase().includes("heavy rain")) {
    parts.push("Heavy rain increases near-surface moisture, elevates conductivity and typically reduces GPR penetration and SNR.");
  } else if (rain === "light" || desc.toLowerCase().includes("rain") || desc.toLowerCase().includes("drizzle")) {
    parts.push("Light rain or drizzle may affect surface coupling on porous ground; monitor time-zero drift between lines.");
  }

  if (ground === "waterlogged" || ground === "damp") {
    parts.push("Damp or waterlogged ground surface increases attenuation — achieved depth may be less than dry-ground calibration.");
  }
  if (ground === "frozen") {
    parts.push("Frozen ground can improve coupling on some surfaces but velocity differs from thawed conditions — note seasonal velocity model.");
  }
  if (Number(env.windMph) >= 25) {
    parts.push("High wind can affect towed array stability and GPS antenna quality on long lines.");
  }

  if (!parts.length) return "Environmental conditions were not recorded; GPR performance should be assessed against field notes.";
  return parts.join(" ");
}

/**
 * Full interpretation object for report storage.
 */
export function interpretGeologyForGpr(bgsPayload, { antennaMhz, siteObservations } = {}) {
  const bedrock = bgsPayload?.bedrock || null;
  const superficial = bgsPayload?.superficial || null;
  const sup = classifyGeologyLayer(superficial);
  const bed = classifyGeologyLayer(bedrock);
  const dominant = sup.materialClass !== "unknown" ? sup : bed;
  const freq = Number(antennaMhz) || 400;

  return {
    fetchedAt: bgsPayload?.fetchedAt || null,
    source: bgsPayload?.source || "bgs-ogcapi",
    scale: bgsPayload?.scale || "1:625,000",
    bedrock,
    superficial,
    materialClass: dominant.materialClass,
    attenuationClass: dominant.attenuation,
    dielectricRange: dominant.dielectric,
    expectedPenetrationM: expectedPenetrationM(freq, dominant.attenuation),
    recommendedAntenna: recommendAntennaMhz(2, dominant.attenuation),
    narrative: buildGprGroundNarrative({ bedrock, superficial, siteObservations, antennaMhz: freq }),
  };
}
