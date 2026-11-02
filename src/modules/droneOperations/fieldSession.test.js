import { describe, expect, it } from "vitest";
import { appendFieldEvent, fieldSessionState, validateFieldJournal } from "./fieldSession.js";
import { blankMission, copyMission, matchesApprovedSnapshot, editMission, assessMission } from "./droneMission.js";
import { operatorDecisionFingerprint } from "./helicopterAssessment.js";
import { validateDroneWrite } from "../../../shared/droneStorageGuard.mjs";

const actor = { id: "actor", name: "Survey lead", role: "supervisor" };
const now = Date.parse("2026-10-29T09:00:00Z");
const add = (m, type, note = "", at = now) => appendFieldEvent(m, type, note, actor, at);

describe("field session records", () => {
  it("rejects inherited object names as event types", () => {
    const initial = blankMission(),
      started = add(initial, "start");
    for (const type of ["constructor", "toString", "__proto__", "hasOwnProperty", ["start"]]) {
      expect(() => add(initial, type, "Invalid event")).toThrow();
      expect(
        validateFieldJournal([], [{ ...started.fieldJournal[0], type }], actor.id, initial.revision, now)
      ).toBeTruthy();
    }
  });
  it("accepts an offline start then cancellation and close when the complete journal syncs together", () => {
    const initial = blankMission();
    const started = add(initial, "start");
    const closed = add({ ...started, cancelled: true }, "close", "Mission cancelled on site");
    expect(validateDroneWrite("drone_missions", [initial], [closed], actor.id, {}, now)).toBeNull();
  });
  it("records start, pause, resume and close without granting flight approval", () => {
    let m = blankMission();
    m = add(m, "start");
    expect(fieldSessionState(m.fieldJournal)).toBe("active");
    expect(() => add(m, "start")).toThrow();
    expect(() => add(m, "pause")).toThrow(/note/i);
    m = add(m, "pause", "Wind review");
    expect(fieldSessionState(m.fieldJournal)).toBe("paused");
    m = add(m, "resume", "Team rebriefed");
    m = add(m, "close", "Equipment accounted for");
    expect(fieldSessionState(m.fieldJournal)).toBe("closed");
    expect(() => add(m, "resume", "Again")).toThrow();
    expect(m.approval).toBeNull();
    expect(m.fieldJournal).toHaveLength(4);
    expect(copyMission(m).fieldJournal).toEqual([]);
  });
  it("preserves the planning revision and approval fingerprint while critical location edits reset checks", () => {
    const m = blankMission({ approval: { at: "original" }, checklist: { c: { status: "done" } } });
    const updated = add(m, "start");
    expect(updated.revision).toBe(m.revision);
    expect(updated.approval).toEqual(m.approval);
    expect(matchesApprovedSnapshot(updated, m)).toBe(true);
    expect(operatorDecisionFingerprint(updated)).toBe(operatorDecisionFingerprint(m));
    expect(editMission(updated, { landing: [115, -31] }).checklist).toEqual({});
    expect(editMission(updated, { alternateLanding: [115, -32] }).approval).toBeNull();
  });
  it("blocks unauthorized writes and cancelled starts but permits closing a cancelled session", () => {
    expect(() => appendFieldEvent(blankMission(), "start", "", { ...actor, role: "viewer" }, now)).toThrow();
    expect(() => add(blankMission({ cancelled: true }), "start")).toThrow();
    const m = { ...add(blankMission(), "start"), cancelled: true };
    expect(() => add(m, "close", "Cancelled on site")).not.toThrow();
  });
  it("rejects altered, deleted, reordered, duplicated and forged journal records on the server", () => {
    const m = add(blankMission(), "start");
    expect(validateDroneWrite("drone_missions", [], [m], actor.id, {}, now)).toBeNull();
    const paused = add(m, "pause", "Access blocked");
    expect(validateDroneWrite("drone_missions", [m], [paused], actor.id, {}, now)).toBeNull();
    for (const journal of [
      [],
      [{ ...m.fieldJournal[0], by: "Other" }],
      [...m.fieldJournal, m.fieldJournal[0]],
      [...paused.fieldJournal].reverse(),
    ]) {
      expect(
        validateDroneWrite("drone_missions", [m], [{ ...m, fieldJournal: journal }], actor.id, {}, now)
      ).toBeTruthy();
    }
    expect(validateDroneWrite("drone_missions", [m], [], actor.id, {}, now)).toBeTruthy();
    expect(validateDroneWrite("drone_missions", [m], [paused], "imposter", {}, now)).toBeTruthy();
    expect(validateFieldJournal([], [{ ...m.fieldJournal[0], at: "invalid" }], actor.id, m.revision, now)).toBeTruthy();
    expect(
      validateFieldJournal([], [{ ...m.fieldJournal[0], at: "2099-01-01" }], actor.id, m.revision, now)
    ).toBeTruthy();
    expect(
      validateFieldJournal([], [{ ...m.fieldJournal[0], missionRevision: 100 }], actor.id, m.revision, now)
    ).toBeTruthy();
  });
  it("flags malformed and out-of-region optional landing locations", () => {
    const m = blankMission({ regionCode: "au", landing: ["115", -31], alternateLanding: [-1, 52] });
    const actions = assessMission(m, {}).actions;
    expect(actions.some((a) => a.key === "landing")).toBe(true);
    expect(actions.some((a) => a.key === "region-geometry")).toBe(true);
  });
});
