import { missionWindow } from "./droneMission.js";
import { missionTimeZone } from "./droneRegions.js";
import { localIso, zonedToUtc } from "./droneTime.js";

// Explicit allowlist: new evidence, permissions and document decisions must never
// arrive accidentally when a new field is added to the mission schema.
const reusable = [
  "pilotId",
  "observerId",
  "assetId",
  "payloadAssetId",
  "profileId",
  "payloadId",
  "templateId",
  "category",
  "classMark",
  "massKg",
  "heightM",
  "heightReference",
  "flightMode",
  "useRtk",
  "boundary",
  "flightArea",
  "contingencyArea",
  "safetyArea",
  "takeoff",
  "landing",
  "alternateLanding",
  "corridorWidthM",
  "crs",
  "verticalDatum",
  "qa",
  "deliverables",
  "emergency",
  "manualId",
  "operatorId",
  "workContexts",
];
export function repeatMissionDefaults(source) {
  const result = Object.fromEntries(
    reusable.filter((key) => source?.[key] !== undefined).map((key) => [key, structuredClone(source[key])])
  );
  if (source?.limits) result.limits = { ...structuredClone(source.limits), confirmed: false };
  result.corridorConfirmed = false;
  if (source?.helicopter)
    result.helicopter = Object.fromEntries(
      [
        "operatorName",
        "certificateReference",
        "aircraftRegistration",
        "aircraftType",
        "pilotName",
        "operatorManualReference",
      ]
        .filter((key) => source.helicopter[key] !== undefined)
        .map((key) => [key, source.helicopter[key]])
    );
  return result;
}
export function preparationError(draft) {
  try {
    missionTimeZone(draft);
    if (!draft.start && !draft.end) return "";
    if (!draft.start || !draft.end) return "Enter both start and end, or leave both blank for an undated draft.";
    missionWindow(draft);
    return "";
  } catch (error) {
    return error.message;
  }
}
export function scheduledEnd(draft, minutes) {
  if (!Number.isFinite(Number(minutes)) || Number(minutes) <= 0 || Number(minutes) > 1440)
    throw new Error("Choose a duration between 1 minute and 24 hours.");
  const zone = missionTimeZone(draft);
  const start = zonedToUtc(draft.start, zone, draft.timeOccurrence);
  const target = Date.parse(start) + Number(minutes) * 60000;
  const end = localIso(target, zone);
  const checked = missionWindow({ ...draft, end });
  if (Date.parse(checked.end) !== target)
    throw new Error("This end time is ambiguous. Enter and review the time manually.");
  return end;
}
