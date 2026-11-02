import { describe, it, expect } from "vitest";
import {
  blankMission,
  editMission,
  copyMission,
  assessMission,
  londonToUtc,
  issuePack,
  addEvidence,
  applicableChecklist,
  setupMissionDefaults,
} from "./droneMission.js";
import { EQUIPMENT_PROFILES } from "./droneLibrary.js";
import { EVIDENCE_KINDS, applyMissionMutation } from "./droneMission.js";
import { validateDroneWrite } from "../../../shared/droneStorageGuard.mjs";
import { appendFieldEvent } from "./fieldSession.js";
it("requires fresh limit and corridor confirmations in a copied mission", () => {
  const source = blankMission({ limits: { wind: 5, confirmed: true }, corridorConfirmed: true, corridorWidthM: 30 });
  const next = copyMission(source);
  expect(next.limits).toEqual({ wind: 5, confirmed: false });
  expect(next.corridorConfirmed).toBe(false);
  expect(next.corridorWidthM).toBe(30);
  expect(source.limits.confirmed).toBe(true);
});
it("accepts approval followed by site activity in the same offline sync batch", () => {
  const { mission, context, now } = readyFixture();
  const actor = { name: "Site lead", id: "actor", role: "admin" };
  const issued = issuePack(mission, context, actor, true, now);
  const active = appendFieldEvent(issued, "start", "", actor, now + 1000);
  expect(validateDroneWrite("drone_missions", [mission], [active], actor.id, context, now + 1000)).toBeNull();
  const forged = structuredClone(active);
  forged.issues.at(-1).snapshot.fieldJournal = [{ ...active.fieldJournal[0], note: "Invented history" }];
  expect(validateDroneWrite("drone_missions", [mission], [forged], actor.id, context, now + 1000)).toBeTruthy();
});
it("requires a new issued snapshot to retain session events recorded before its approval", () => {
  const { mission, context, now } = readyFixture();
  const actor = { name: "Site lead", id: "actor", role: "admin" };
  const active = appendFieldEvent(mission, "start", "", actor, now - 1000);
  const issued = issuePack(active, context, actor, true, now);
  expect(validateDroneWrite("drone_missions", [active], [issued], actor.id, context, now)).toBeNull();
  issued.issues.at(-1).snapshot.fieldJournal = [];
  expect(validateDroneWrite("drone_missions", [active], [issued], actor.id, context, now)).toBeTruthy();
});
it("keeps an issued plan valid when recording site activity and prevents a forged journal in a new issue", () => {
  const { mission, context, now } = readyFixture();
  const actor = { name: "Site lead", id: "actor", role: "admin" };
  const issued = issuePack(mission, context, actor, true, now);
  const active = appendFieldEvent(issued, "start", "", actor, now);
  expect(validateDroneWrite("drone_missions", [issued], [active], actor.id, context, now)).toBeNull();
  expect(assessMission(active, context, now).actions).toEqual([]);
  expect(active.issues).toEqual(issued.issues);
  const forged = structuredClone(issued);
  forged.issues.at(-1).snapshot.fieldJournal = active.fieldJournal;
  expect(validateDroneWrite("drone_missions", [mission], [forged], actor.id, context, now)).toBe(
    "snapshot_journal_does_not_match_mission"
  );
});
it("blocks missing and deleted survey templates before issue", () => {
  const { mission, context, now } = readyFixture();
  for (const extra of [{}, { templates: [{ id: "deleted-template", deletedAt: "2026-01-01", capability: "rgb" }] }]) {
    const changed = { ...mission, templateId: "deleted-template" };
    expect(assessMission(changed, { ...context, ...extra }, now).actions.some((a) => a.key === "template")).toBe(true);
    expect(() =>
      issuePack(changed, { ...context, ...extra }, { id: "actor", name: "Lead", role: "admin" }, true, now)
    ).toThrow();
  }
});

it("copies only configuration fields from a default setup, never old approval or dates", () => {
  const setup = {
    id: "setup",
    assetId: "aircraft",
    limits: { wind: 5 },
    start: "yesterday",
    approval: { name: "Pilot" },
    isDefault: true,
  };
  const defaults = setupMissionDefaults(setup);
  expect(defaults).toEqual({ assetId: "aircraft", limits: { wind: 5 } });
  defaults.limits.wind = 10;
  expect(setup.limits.wind).toBe(5);
});

export function readyFixture() {
  const now = Date.parse("2026-10-29T09:30:00Z");
  const area = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Site" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-1, 51],
              [-0.99, 51],
              [-0.99, 51.01],
              [-1, 51.01],
              [-1, 51],
            ],
          ],
        },
      },
    ],
  };
  const context = {
    projects: [{ id: "p", name: "Test site" }],
    workers: [{ id: "w", name: "Test pilot" }],
    assets: [{ id: "a", description: "Test aircraft", assetRef: "UAS-1", result: "pass", nextDue: "2027-01-01" }],
    rams: [{ id: "r", title: "UAV RAMS" }],
    manuals: [],
  };
  let mission = {
    ...blankMission(),
    projectId: "p",
    pilotId: "w",
    assetId: "a",
    profileId: "mavic-3e",
    payloadId: "integrated-3e",
    boundary: area,
    flightArea: area,
    takeoff: [-1, 51],
    category: "Open A3",
    classMark: "Legacy",
    massKg: 1,
    heightM: 40,
    operatorId: "Operator reference",
    start: "2026-10-29T10:00",
    end: "2026-10-29T11:00",
    qa: "Independent checks",
    deliverables: "Orthomosaic",
    emergency: "Reviewed site contacts and abort procedures",
    ramsId: "r",
  };
  for (const [kind] of EVIDENCE_KINDS)
    mission = addEvidence(
      mission,
      {
        kind,
        result: "reviewed",
        source: "Test evidence reference",
        note: "Test-only reviewed evidence",
        reviewer: "Pilot",
        checkedAt: "2026-10-29T09:00:00Z",
        validUntil: "2026-10-29T12:00:00Z",
      },
      now
    );
  for (const item of applicableChecklist(mission))
    mission.checklist[item.id] = { status: "done", at: "2026-10-29T09:20:00Z", by: "Pilot" };
  return { mission, context, now };
}

describe("drone operation safety lifecycle", () => {
  it("does not infer readiness from missing checks", () => {
    const result = assessMission(blankMission(), {}, Date.parse("2026-10-29T10:00:00Z"));
    expect(result.status).toBe("Action required");
    expect(result.actions.some((a) => a.key === "airspace")).toBe(true);
    expect(result.actions.some((a) => a.key === "weather")).toBe(true);
  });
  it("invalidates dependent evidence and approval after an operation change", () => {
    const m = {
      ...blankMission(),
      revision: 5,
      approval: { name: "Pilot" },
      evidence: [{ id: "a" }],
      weather: { status: "checked" },
      checklist: { a: { status: "done" } },
      issues: [{ id: "issued" }],
    };
    const changed = editMission(m, { pilotId: "another" });
    expect(changed.revision).toBe(6);
    expect(changed.approval).toBeNull();
    expect(changed.evidence).toEqual([]);
    expect(changed.weather).toBeNull();
    expect(changed.issues).toEqual([{ id: "issued" }]);
  });
  it("copies no time-dependent information or old approvals", () => {
    const m = {
      ...blankMission(),
      start: "2026-10-29T10:00",
      end: "2026-10-29T11:00",
      evidence: [{ id: "e" }],
      approval: { name: "A" },
      issues: [{ id: "i" }],
    };
    const copy = copyMission(m);
    expect(copy.id).not.toBe(m.id);
    expect(copy.start).toBe("");
    expect(copy.evidence).toEqual([]);
    expect(copy.approval).toBeNull();
    expect(copy.issues).toEqual([]);
  });
  it("handles BST/GMT and refuses ambiguous and missing local times", () => {
    expect(londonToUtc("2026-07-01T12:00")).toBe("2026-07-01T11:00:00.000Z");
    expect(londonToUtc("2026-12-01T12:00")).toBe("2026-12-01T12:00:00.000Z");
    expect(() => londonToUtc("2026-03-29T01:30")).toThrow(/does not exist/);
    expect(() => londonToUtc("2026-10-25T01:30")).toThrow(/ambiguous/);
    expect(londonToUtc("2026-10-25T01:30", "GMT")).toBe("2026-10-25T01:30:00.000Z");
  });
  it("blocks incompatible payload and does not mistake RGB for thermal or LiDAR", () => {
    const m = { ...blankMission(), profileId: "mavic-3e", payloadId: "zenmuse-l2", templateId: "lidar" };
    expect(assessMission(m, {}).actions.some((a) => a.key === "compatibility")).toBe(true);
    expect(EQUIPMENT_PROFILES.find((p) => p.id === "mavic-3e").capabilities).not.toContain("thermal");
  });
  it("requires complete, dated, attributed evidence", () => {
    expect(() => addEvidence(blankMission(), { kind: "airspace", note: "fine" })).toThrow();
    expect(() => issuePack(blankMission(), {}, { name: "Tester", role: "admin" }, false)).toThrow();
    expect(() => issuePack(blankMission(), {}, { name: "Tester", role: "operative" }, true)).toThrow();
  });
  it("does not put LiDAR or RTK physical checks on a setup without those features", () => {
    const list = applicableChecklist({
      ...blankMission(),
      profileId: "mavic-3t",
      payloadId: "integrated-3t",
      useRtk: false,
    });
    expect(list.some((i) => i.id === "rtk")).toBe(false);
    expect(list.some((i) => i.id === "lidar")).toBe(false);
    expect(list.every((i) => i.source && i.version && i.role)).toBe(true);
  });
  it("issues a ready operation, preserves history and verifies the server snapshot", () => {
    const { mission, context, now } = readyFixture();
    expect(assessMission(mission, context, now).actions).toEqual([]);
    const issued = issuePack(mission, context, { name: "Pilot", id: "actor", role: "admin" }, true, now);
    expect(validateDroneWrite("drone_missions", [mission], [issued], "actor", context, now)).toBeNull();
    const changed = editMission(issued, { start: "2026-10-30T10:00" });
    expect(changed.issues[0].snapshot.start).toBe("2026-10-29T10:00");
    expect(changed.approval).toBeNull();
    expect(assessMission(issued, { ...context, assets: [{ ...context.assets[0], result: "fail" }] }, now).status).toBe(
      "Expired / Recheck required"
    );
    expect(assessMission(issued, context, now + 3 * 3600000).status).toBe("Expired / Recheck required");
  });
  it("blocks stale forecasts, non-finite mass and missing observer records", () => {
    const { mission, context, now } = readyFixture();
    expect(
      assessMission({ ...mission, weather: { validUntil: "2026-10-29T09:00Z" } }, context, now).actions.some(
        (a) => a.key === "forecast"
      )
    ).toBe(true);
    expect(
      assessMission({ ...mission, massKg: "Infinity" }, context, now).actions.some((a) => a.key === "pathway-fields")
    ).toBe(true);
    expect(
      assessMission({ ...mission, observerId: "deleted" }, context, now).actions.some((a) => a.key === "observer")
    ).toBe(true);
  });
  it("blocks all adverse forecast dimensions and unconfirmed limits from approval", () => {
    const { mission, context, now } = readyFixture();
    const bad = {
      ...mission,
      limits: { wind: 10, gust: 12, rain: 0, minTemp: 0, maxTemp: 40, visibility: 1000, confirmed: true },
      weather: {
        validUntil: "2026-10-29T12:00:00Z",
        points: [{ hours: [{ at: "2026-10-29T10:00:00Z", wind: 1, gust: 1, rain: 20, temp: -20, visibility: 50 }] }],
      },
    };
    expect(assessMission(bad, context, now).actions.some((a) => a.key === "forecast-limits")).toBe(true);
    expect(() => issuePack(bad, context, { name: "Pilot", id: "actor", role: "admin" }, true, now)).toThrow();
    expect(
      assessMission({ ...bad, limits: { ...bad.limits, confirmed: false } }, context, now).actions.some(
        (a) => a.key === "forecast-limits"
      )
    ).toBe(true);
  });
  it("detects mission mutation even if a client preserves approval and revision", () => {
    const { mission, context, now } = readyFixture();
    const issued = issuePack(mission, context, { name: "Pilot", id: "actor", role: "admin" }, true, now);
    const tampered = { ...issued, heightM: 400 };
    expect(validateDroneWrite("drone_missions", [issued], [tampered], "actor", context, now)).toBe(
      "snapshot_does_not_match_mission"
    );
    expect(assessMission(tampered, context, now).status).toBe("Expired / Recheck required");
    const removed = { ...issued };
    delete removed.crs;
    expect(validateDroneWrite("drone_missions", [issued], [removed], "actor", context, now)).toBe(
      "snapshot_does_not_match_mission"
    );
  });
  it("rejects a stale async result after a same-revision evidence mutation", () => {
    const { mission, now } = readyFixture();
    const initial = applyMissionMutation([], mission).saved;
    const updated = addEvidence(
      initial,
      {
        kind: "airspace",
        result: "action_required",
        source: "New warning",
        note: "Do not fly",
        reviewer: "Pilot",
        checkedAt: "2026-10-29T09:00:00Z",
        validUntil: "2026-10-29T12:00:00Z",
      },
      now
    );
    const current = applyMissionMutation([initial], updated).saved;
    expect(current.revision).toBe(initial.revision);
    expect(() => applyMissionMutation([current], { ...initial, weather: { status: "available" } })).toThrow(
      /Mission changed/
    );
    expect(current.evidence.find((e) => e.kind === "airspace").result).toBe("action_required");
  });
});
