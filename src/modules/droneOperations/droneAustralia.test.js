import { describe, it, expect } from "vitest";
import {
  blankMission,
  missionWindow,
  assessMission,
  copyMission,
  editMission,
  applicableChecklist,
  evidenceKinds,
  addEvidence,
  issuePack,
  applyMissionMutation,
} from "./droneMission.js";
import { validateDroneWrite } from "../../../shared/droneStorageGuard.mjs";
import { packSections } from "./dronePdf.js";
import { operatorDecisionFingerprint } from "./helicopterAssessment.js";
it("invalidates operator decisions when evidence, checklists or operational content changes", () => {
  const { mission, context, now } = helicopterFixture();
  const changed = addEvidence(mission, { ...mission.evidence[0], note: "New restrictions" }, now);
  expect(changed.operatorRelease).toBeNull();
  for (const patch of [
    { evidence: changed.evidence },
    {
      checklist: {
        ...mission.checklist,
        operator: { status: "done", by: "Other reviewer", at: "2026-10-29T00:40:00Z" },
      },
    },
    { heightM: 650 },
    { helicopter: { ...mission.helicopter, aircraftRegistration: "Changed aircraft" } },
  ]) {
    const altered = { ...mission, ...patch };
    expect(assessMission(altered, context, now).actions.some((a) => a.key === "operator-release")).toBe(true);
    expect(() => issuePack(altered, context, { id: "actor", name: "Lead", role: "admin" }, true, now)).toThrow();
    expect(applyMissionMutation([mission], altered).saved.operatorRelease).toBeNull();
  }
});
it.each(["sources", "checklistDefinitions", "ruleVersion", "catalogue"])(
  "rejects altered new snapshot metadata: %s",
  (key) => {
    const { mission, context, now } = helicopterFixture();
    const issued = issuePack(mission, context, { id: "actor", name: "Lead", role: "admin" }, true, now);
    issued.issues[0].snapshot[key] = key === "ruleVersion" ? "uk-forged" : [{ id: "foreign", source: "CAA" }];
    expect(validateDroneWrite("drone_missions", [mission], [issued], "actor", context, now)).toBe(
      "invalid_snapshot_metadata"
    );
  }
);
it("clears hidden drone sensor links on aircraft type change", () => {
  const drone = blankMission({ regionCode: "au", aircraftKind: "drone", payloadAssetId: "deleted-sensor" });
  expect(editMission(drone, { aircraftKind: "helicopter" }).payloadAssetId).toBe("");
});
it("rejects a new issue that reuses a decision after changing operational content", () => {
  const { mission, context, now } = helicopterFixture();
  const issued = issuePack(mission, context, { id: "actor", name: "Lead", role: "admin" }, true, now);
  issued.heightM = 650;
  issued.issues[0].snapshot.heightM = 650;
  expect(validateDroneWrite("drone_missions", [mission], [issued], "actor", context, now)).toBe("mission_not_ready");
});
it("keeps CASA drone pathways separate and requires a matching reviewed ReOC manual", () => {
  const { mission: heli, context, now } = helicopterFixture();
  let m = {
    ...heli,
    aircraftKind: "drone",
    helicopter: {},
    operatorRelease: null,
    pilotId: "w",
    assetId: "a",
    profileId: "mavic-3e",
    payloadId: "integrated-3e",
    massKg: 1,
    operatorId: "QA ARN and registration",
    category: "CASA ReOC operation",
    manualId: "au-manual",
    checklist: {},
    evidence: [],
  };
  const ctx = {
    ...context,
    assets: [{ id: "a", result: "pass", nextDue: "2027-01-01" }],
    manuals: [{ id: "au-manual", regionCode: "au", aircraftKind: "drone", approvedAt: "2026-10-01" }],
  };
  for (const [kind] of evidenceKinds(m))
    m = addEvidence(
      m,
      {
        kind,
        result: "reviewed",
        source: "QA CASA review",
        note: "QA only",
        reviewer: "Pilot",
        checkedAt: "2026-10-29T00:00:00Z",
        validUntil: "2026-10-29T04:00:00Z",
      },
      now
    );
  m.checklist = Object.fromEntries(
    applicableChecklist(m).map((c) => [c.id, { status: "done", by: "Pilot", at: "2026-10-29T00:30:00Z" }])
  );
  expect(assessMission(m, ctx, now).actions).toEqual([]);
  expect(assessMission(m, { ...ctx, manuals: [] }, now).actions.some((a) => a.key === "manual-link")).toBe(true);
  const issued = issuePack(m, ctx, { name: "Pilot", id: "actor", role: "admin" }, true, now);
  expect(packSections(issued.issues[0]).flat().join("\n")).not.toContain("CAA");
  expect(
    assessMission({ ...m, category: "CASA excluded category — reviewed", manualId: "" }, { ...ctx, manuals: [] }, now)
      .actions
  ).toEqual([]);
});
it("requires organisation People and Plant links for an own-operator helicopter", () => {
  const { mission, context, now } = helicopterFixture();
  const own = { ...mission, helicopter: { ...mission.helicopter, relationship: "own" } };
  const keys = assessMission(own, context, now).actions.map((a) => a.key);
  expect(keys).toContain("pilot");
  expect(keys).toContain("aircraft-record");
});
it("does not apply foreign-region or drone-only custom checklists to a helicopter", () => {
  const { mission } = helicopterFixture();
  const entries = [
    { id: "uk", regionCode: "uk", aircraftKind: "helicopter" },
    { id: "drone", regionCode: "au", aircraftKind: "drone" },
    { id: "au-heli", regionCode: "au", aircraftKind: "helicopter" },
  ];
  const ids = applicableChecklist(mission, { checklists: entries }).map((x) => x.id);
  expect(ids).not.toContain("uk");
  expect(ids).not.toContain("drone");
  expect(ids).toContain("au-heli");
});

export function helicopterFixture() {
  const now = Date.parse("2026-10-29T01:00:00Z");
  const area = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [115.8, -31.9],
              [115.81, -31.9],
              [115.81, -31.89],
              [115.8, -31.89],
              [115.8, -31.9],
            ],
          ],
        },
        properties: { name: "Perth QA" },
      },
    ],
  };
  const context = {
    projects: [{ id: "p", name: "Perth survey" }],
    workers: [{ id: "w", name: "Survey lead" }],
    assets: [],
    rams: [{ id: "r", title: "Survey risk plan" }],
    manuals: [],
  };
  let m = blankMission({
    regionCode: "au",
    aircraftKind: "helicopter",
    timeZone: "Australia/Perth",
    start: "2026-10-29T10:00",
    end: "2026-10-29T11:00",
    projectId: "p",
    observerId: "w",
    boundary: area,
    flightArea: area,
    takeoff: [115.8, -31.9],
    heightM: 150,
    category: "CASA Part 138 aerial work — scope verified",
    qa: "Independent checks",
    deliverables: "Survey images",
    ramsId: "r",
    emergency: "Confirmed contacts",
    helicopter: {
      relationship: "contracted",
      ...Object.fromEntries(
        [
          "operatorName",
          "certificateReference",
          "pilotName",
          "aircraftRegistration",
          "aircraftType",
          "sensorDescription",
          "taskSpecialists",
          "operatorManualReference",
          "loadingReference",
          "landingPlan",
          "communications",
          "remoteAreaPlan",
        ].map((k) => [k, `QA ${k}`])
      ),
    },
  });
  for (const [kind] of evidenceKinds(m))
    m = addEvidence(
      m,
      {
        kind,
        result: "reviewed",
        source: "QA only",
        note: "Reviewed test evidence",
        reviewer: "Lead",
        checkedAt: "2026-10-29T00:00:00Z",
        validUntil: "2026-10-29T04:00:00Z",
      },
      now
    );
  m.checklist = Object.fromEntries(
    applicableChecklist(m).map((c) => [c.id, { status: "done", by: "Lead", at: "2026-10-29T00:30:00Z" }])
  );
  m.operatorRelease = {
    by: "Operator pilot",
    reference: "QA release",
    at: "2026-10-29T00:45:00Z",
    validUntil: "2026-10-29T04:00:00Z",
    conditions: "QA only. Operator limitations apply.",
    missionRevision: m.revision,
    missionFingerprint: operatorDecisionFingerprint(m),
  };
  return { mission: m, context, now };
}

it("issues an Australian helicopter coordination snapshot with no UK rules or drone class in its PDF", () => {
  const { mission, context, now } = helicopterFixture();
  expect(assessMission(mission, context, now).actions).toEqual([]);
  const issued = issuePack(mission, context, { id: "actor", name: "Coordinator", role: "admin" }, true, now);
  expect(assessMission(issued, context, now).status).toBe("Survey coordination reviewed");
  expect(validateDroneWrite("drone_missions", [mission], [issued], "actor", context, now)).toBeNull();
  const text = packSections(issued.issues[0]).flat().join("\n");
  expect(text).toContain("Australia/Perth");
  expect(text).toContain("QA aircraftRegistration");
  expect(text).toContain("QA release");
  expect(text).not.toContain("CAA");
  expect(text).not.toContain("Class / legacy");
});
it("blocks expired operator release, foreign manuals and a UK pathway on an AU mission", () => {
  const { mission, context, now } = helicopterFixture();
  expect(
    assessMission(
      { ...mission, operatorRelease: { ...mission.operatorRelease, validUntil: "2026-10-29T02:30:00Z" } },
      context,
      now
    ).actions.some((a) => a.key === "operator-release")
  ).toBe(true);
  expect(
    assessMission(
      { ...mission, manualId: "uk" },
      { ...context, manuals: [{ id: "uk", approvedAt: "2026-01-01" }] },
      now
    ).actions.some((a) => a.key === "manual-scope")
  ).toBe(true);
  expect(
    assessMission({ ...mission, category: "Open A3" }, context, now).actions.some((a) => a.key === "category")
  ).toBe(true);
});
it("rejects a boundary from another supported region", () => {
  const { mission, context, now } = helicopterFixture();
  expect(
    assessMission(
      { ...mission, regionCode: "uk", aircraftKind: "drone", timeZone: "Europe/London" },
      context,
      now
    ).actions.some((a) => a.key === "region-geometry")
  ).toBe(true);
});
import { isModuleAllowedForMarket } from "../../config/marketModules.js";

describe("Australian operation scope and local time", () => {
  const timed = (zone, start = "2026-10-29T10:00", end = "2026-10-29T11:00") => ({
    ...blankMission(),
    regionCode: "au",
    timeZone: zone,
    start,
    end,
  });
  it.each([
    ["Australia/Sydney", "2026-10-28T23:00:00.000Z"],
    ["Australia/Adelaide", "2026-10-28T23:30:00.000Z"],
    ["Australia/Darwin", "2026-10-29T00:30:00.000Z"],
    ["Australia/Perth", "2026-10-29T02:00:00.000Z"],
  ])("converts %s without applying London time", (zone, utc) => expect(missionWindow(timed(zone)).start).toBe(utc));
  it("requires an explicit Australian zone and rejects unsupported scopes", () => {
    expect(() => missionWindow(timed(""))).toThrow(/time zone/i);
    expect(() => missionWindow({ ...timed("Australia/Sydney"), regionCode: "unknown" })).toThrow(/region/i);
    expect(() => missionWindow({ ...timed("Europe/London") })).toThrow(/time zone/i);
  });
  it("rejects DST gaps and requires the occurrence for repeated Sydney times", () => {
    expect(() => missionWindow(timed("Australia/Sydney", "2026-10-04T02:30", "2026-10-04T04:00"))).toThrow(
      /does not exist/
    );
    const repeated = timed("Australia/Sydney", "2026-04-05T02:30", "2026-04-05T04:00");
    expect(() => missionWindow(repeated)).toThrow(/ambiguous/);
    expect(missionWindow({ ...repeated, timeOccurrence: "earlier" }).start).toBe("2026-04-04T15:30:00.000Z");
    expect(missionWindow({ ...repeated, timeOccurrence: "later" }).start).toBe("2026-04-04T16:30:00.000Z");
  });
  it("exposes the module only in UK and AU", () => {
    expect(isModuleAllowedForMarket("drone-operations", "au")).toBe(true);
    expect(isModuleAllowedForMarket("drone-operations", "uk")).toBe(true);
    expect(isModuleAllowedForMarket("drone-operations", "pl")).toBe(false);
  });
  it("does not apply UK aircraft classes or drone payload compatibility to hired helicopters", () => {
    const m = { ...timed("Australia/Perth"), aircraftKind: "helicopter", helicopter: { relationship: "contracted" } };
    const actions = assessMission(m).actions;
    expect(actions.some((a) => a.key === "compatibility" || a.key === "asset" || a.key === "pathway-fields")).toBe(
      false
    );
    expect(actions.some((a) => a.key === "operator-release")).toBe(true);
    expect(applicableChecklist(m).every((c) => !c.source?.url.includes("caa.co.uk"))).toBe(true);
  });
  it("clears dated operator release on copy and operational changes", () => {
    const m = {
      ...timed("Australia/Perth"),
      aircraftKind: "helicopter",
      operatorRelease: { by: "Pilot", reference: "Release A" },
      approval: { name: "Coordinator" },
    };
    expect(copyMission(m).operatorRelease).toBeNull();
    expect(editMission(m, { heightM: 150 }).operatorRelease).toBeNull();
    expect(editMission(m, { aircraftKind: "drone" }).operatorRelease).toBeNull();
  });
});
