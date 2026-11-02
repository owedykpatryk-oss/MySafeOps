import { geometrySummary } from "./droneGeometry.js";
import { missionWindow } from "./droneMission.js";
import { regionOf, isHelicopter } from "./droneRegions.js";

export function airspaceBriefing(mission) {
  const layers = ["flightArea", "contingencyArea", "safetyArea"];
  const flightDefined = geometrySummary(mission.flightArea).polygonCount > 0;
  if (!flightDefined) layers.push("boundary");
  const features = layers.flatMap((key) =>
    (mission[key]?.features || []).map((feature) => ({
      ...feature,
      properties: { ...feature.properties, name: `${key}: ${feature.properties?.name || "Area"}` },
    }))
  );
  for (const key of ["takeoff", "landing", "alternateLanding"])
    if (Array.isArray(mission[key]) && mission[key].length === 2 && mission[key].every(Number.isFinite))
      features.push({
        type: "Feature",
        properties: { name: key },
        geometry: { type: "Point", coordinates: mission[key] },
      });
  const geometry = { type: "FeatureCollection", features };
  const summary = geometrySummary(geometry);
  const warnings = [];
  if (!flightDefined)
    warnings.push("Define a separate flight area. Imported survey boundaries do not define the operating volume.");
  let window;
  try {
    window = missionWindow(mission);
  } catch {
    warnings.push("Confirm the operation date, time and time zone.");
  }
  if (!mission.heightM || !mission.heightReference)
    warnings.push("Confirm the planned height and its reference; no AGL / AMSL / FL conversion is inferred.");
  const format = (value) => value.map((n) => n.toFixed(6)).join(", ");
  const text = [
    `AIRSPACE BRIEFING REQUEST — ${mission.title || "Untitled mission"} — revision ${mission.revision || 1}`,
    "NOTAM / restrictions feed: not connected. This is a request context, not a briefing or permission.",
    `Jurisdiction: ${regionOf(mission) === "au" ? "Australia" : "United Kingdom"}`,
    `Extent basis: ${flightDefined ? "Flight, contingency and safety areas, plus landing points" : "Provisional survey boundary / points; flight area missing"}`,
    summary.bounds
      ? `WGS84 bounds (west, south, east, north): ${format(summary.bounds)}\nCentre (latitude, longitude): ${format([summary.centre[1], summary.centre[0]])}`
      : "No mapped extent available.",
    `Operation window (UTC): ${window ? `${window.start} to ${window.end}` : "Not confirmed"}`,
    `Planned height: ${mission.heightM || "Not confirmed"} m ${mission.heightReference || "reference not confirmed"}`,
    "Review the whole operating volume, surroundings and time window: airspace classification, restricted / danger / prohibited areas, aerodrome restrictions, temporary restrictions, NOTAMs, AIP supplements and required permissions.",
    ...warnings,
  ].join("\n");
  return {
    text,
    warnings,
    geometry,
    hasGeometry: !!summary.bounds,
    sources:
      regionOf(mission) === "au"
        ? [
            {
              title: "Airservices NAIPS — NOTAM briefing",
              url: "https://www.airservicesaustralia.com/naips/Account/Logon",
            },
            isHelicopter(mission)
              ? {
                  title: "Airservices — flight briefing",
                  url: "https://www.airservices.gov.au/industry-info/flight-briefing/",
                }
              : {
                  title: "Airservices — RPAS airspace access",
                  url: "https://www.airservicesaustralia.com/industry-info/unmanned-aerial-systems-in-controlled-airspace/",
                },
          ]
        : [
            { title: "NATS AIS — NOTAM and aeronautical information", url: "https://www.nats.aero/do-it-online/ais/" },
            {
              title: "CAA — airspace restrictions for drones",
              url: "https://www.caa.co.uk/drones/open-category/moving-on-to-more-advanced-flying/airspace/airspace-restrictions/",
            },
          ],
  };
}
