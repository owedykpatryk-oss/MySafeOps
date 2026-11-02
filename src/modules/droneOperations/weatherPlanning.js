import { forecastRequest } from "./droneWeather.js";
import { geometrySummary } from "./droneGeometry.js";
import { pointInRegion, regionOf, isHelicopter } from "./droneRegions.js";

export function weatherReadiness(mission, now = Date.now()) {
  try {
    if (!geometrySummary(mission.flightArea).polygonCount)
      return {
        ready: false,
        action: "map",
        message: "Add the flight area on the map. Weather will load automatically once the area and dates are ready.",
      };
    const request = forecastRequest(mission);
    if (!request.points.length || request.points.some((p) => !pointInRegion(p, regionOf(mission))))
      return {
        ready: false,
        action: "map",
        message: "Check that the flight area is inside the selected country workspace.",
      };
    if (Date.parse(request.start) < now - 3600000)
      return {
        ready: false,
        action: "schedule",
        message: "This mission starts in the past. Set a new operating window to request a forecast.",
      };
    if (Date.parse(request.end) > now + 15 * 86400000)
      return {
        ready: false,
        message:
          "This mission is beyond the 15-day forecast range. Weather will load when it enters range and this panel is open.",
      };
    return { ready: true, request };
  } catch (error) {
    return {
      ready: false,
      action: "schedule",
      message: `Set the operation date, time and time zone. ${error.message}`,
    };
  }
}
export function matchingWeatherSetup(mission, setups) {
  if (isHelicopter(mission) || !mission.assetId || !mission.profileId || !mission.payloadId) return undefined;
  return setups.find(
    (s) =>
      !s.deletedAt &&
      regionOf(s) === regionOf(mission) &&
      ["assetId", "payloadAssetId", "profileId", "payloadId"].every((key) => (s[key] || "") === (mission[key] || "")) &&
      ["wind", "gust", "rain", "minTemp", "maxTemp", "visibility"].every(
        (key) => s.limits?.[key] !== "" && s.limits?.[key] != null && Number.isFinite(Number(s.limits[key]))
      ) &&
      ["wind", "gust", "rain", "visibility"].every((key) => Number(s.limits[key]) >= 0) &&
      Number(s.limits.minTemp) <= Number(s.limits.maxTemp)
  );
}
