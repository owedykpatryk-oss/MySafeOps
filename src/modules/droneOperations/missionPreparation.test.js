import { expect, it } from "vitest";
import { repeatMissionDefaults, scheduledEnd, preparationError } from "./missionPreparation.js";

it("reuses planning inputs without carrying permissions, checks or operational history", () => {
  const source = {
    id: "old",
    revision: 4,
    title: "Depot",
    profileId: "d1",
    pilotId: "p1",
    flightArea: { type: "FeatureCollection", features: [] },
    limits: { wind: 10, confirmed: true },
    corridorConfirmed: true,
    approval: { at: "now" },
    operatorRelease: {},
    checklist: { all: true },
    evidence: [{}],
    weather: {},
    fieldJournal: [{}],
    issues: [{}],
    start: "old",
    documentApprovals: [{}],
  };
  const next = repeatMissionDefaults(source);
  expect(next).toMatchObject({
    pilotId: "p1",
    profileId: "d1",
    limits: { wind: 10, confirmed: false },
    corridorConfirmed: false,
  });
  for (const key of [
    "id",
    "start",
    "approval",
    "operatorRelease",
    "checklist",
    "evidence",
    "weather",
    "fieldJournal",
    "issues",
    "documentApprovals",
  ])
    expect(next).not.toHaveProperty(key);
  next.flightArea.features.push({});
  expect(source.flightArea.features).toEqual([]);
});
it("copies only helicopter identity details, leaving operational confirmations open", () => {
  expect(
    repeatMissionDefaults({
      helicopter: {
        operatorName: "Operator",
        aircraftRegistration: "VH-TEST",
        pilotName: "Alex",
        maintenanceConfirmed: true,
        fuelConfirmed: true,
      },
    }).helicopter
  ).toEqual({ operatorName: "Operator", aircraftRegistration: "VH-TEST", pilotName: "Alex" });
});
it("calculates actual elapsed time in the operation zone across daylight saving changes", () => {
  expect(scheduledEnd({ regionCode: "uk", timeZone: "Europe/London", start: "2026-03-29T00:30" }, 120)).toBe(
    "2026-03-29T03:30"
  );
  expect(scheduledEnd({ regionCode: "au", timeZone: "Australia/Sydney", start: "2026-10-04T01:30" }, 120)).toBe(
    "2026-10-04T04:30"
  );
});
it("rejects incomplete, reversed and ambiguous schedules while allowing an undated draft", () => {
  const base = { regionCode: "uk", timeZone: "Europe/London" };
  expect(preparationError(base)).toBe("");
  expect(preparationError({ ...base, start: "2026-10-30T10:00" })).toContain("both");
  expect(preparationError({ ...base, start: "2026-10-30T10:00", end: "2026-10-30T09:00" })).toContain("after");
  expect(() => scheduledEnd({ ...base, start: "2026-10-25T01:30" }, 60)).toThrow();
});
