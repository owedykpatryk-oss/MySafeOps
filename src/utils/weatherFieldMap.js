/**
 * Map Open-Meteo / OpenWeather description into survey / GPR weather checkboxes.
 * Leaf module — kept out of surveyReportSmart so gpr-report does not sync-import survey-report.
 */
export function mapWeatherSnapshotToFields({ description = "", tempC, windMph = 0 } = {}) {
  const desc = String(description).toLowerCase();
  const phenomena = new Set();
  let rainDuringSurvey = "unknown";
  let groundSurface = "unknown";
  const methodsAffected = new Set();

  if (desc.includes("drizzle")) {
    phenomena.add("drizzle");
    rainDuringSurvey = "light";
    groundSurface = "damp";
    methodsAffected.add("gpr");
    methodsAffected.add("eml");
  } else if (desc.includes("heavy rain")) {
    phenomena.add("heavy_rain");
    rainDuringSurvey = "heavy";
    groundSurface = "waterlogged";
    methodsAffected.add("gpr");
    methodsAffected.add("eml");
    methodsAffected.add("total_station");
  } else if (desc.includes("rain") || desc.includes("shower")) {
    phenomena.add("light_rain");
    rainDuringSurvey = "light";
    groundSurface = "damp";
    methodsAffected.add("gpr");
    methodsAffected.add("eml");
  } else if (desc.includes("clear") || desc.includes("mainly clear")) {
    phenomena.add("strong_sun");
    groundSurface = "dry";
  }

  if (desc.includes("overcast")) phenomena.add("overcast");
  if (desc.includes("fog") || desc.includes("mist")) {
    phenomena.add("fog");
    methodsAffected.add("gnss");
    methodsAffected.add("uav");
  }
  if (desc.includes("snow")) {
    phenomena.add("snow");
    groundSurface = "frozen";
    methodsAffected.add("gpr");
  }
  if (desc.includes("thunder")) {
    phenomena.add("heavy_rain");
    rainDuringSurvey = "heavy";
  }
  if (Number(windMph) >= 25) {
    phenomena.add("high_wind");
    methodsAffected.add("uav");
    methodsAffected.add("laser");
  }
  if (tempC != null && tempC <= 2) {
    phenomena.add("cold");
    phenomena.add("frost");
    if (groundSurface === "unknown") groundSurface = "frozen";
    methodsAffected.add("gpr");
  }

  return {
    groundSurface,
    rainDuringSurvey,
    phenomena: [...phenomena],
    methodsAffected: [...methodsAffected],
  };
}
