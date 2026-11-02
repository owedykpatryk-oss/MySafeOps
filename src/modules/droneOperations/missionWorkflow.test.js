import { describe, it, expect } from "vitest";
import {
  nextMissionStep,
  documentQuality,
  closeoutSummary,
  closeoutSections,
  exportReviewKey,
} from "./missionWorkflow.js";
const at = Date.parse("2026-10-29T12:00:00Z");
const definitions = [{ id: "post", phase: "post", stage: "Data handover", role: "Survey lead" }];
const event = (type, time, note = "Recorded note") => ({
  type,
  at: `2026-10-29T${time}:00Z`,
  by: "Alex",
  note,
  missionRevision: 3,
});
const mission = {
  id: "m",
  revision: 3,
  title: "Survey",
  projectId: "p",
  client: "Client",
  location: "Site",
  start: "2026-10-29T09:00",
  end: "2026-10-29T11:00",
  timeZone: "Europe/London",
  fieldJournal: [],
  checklist: {},
  checklistDefinitions: definitions,
  nextActions: [],
  evidence: [],
};
describe("mission workflow", () => {
  it("handles malformed journal entries without crashing document review or export", () => {
    const m = { ...mission, fieldJournal: [null] };
    expect(closeoutSummary(m, definitions, at)).toMatchObject({ state: "invalid", activeMinutes: null });
    expect(documentQuality(m, { at }).some((f) => f.id === "journal-invalid")).toBe(true);
    expect(() => closeoutSections({ snapshot: m, issuedAt: new Date(at).toISOString() })).not.toThrow();
  });
  it("flags missing session attribution and closure note while retaining the recorded chronology", () => {
    const m = {
      ...mission,
      fieldJournal: [
        { type: "start", at: "2026-10-29T09:00:00Z" },
        { type: "close", at: "2026-10-29T10:00:00Z" },
      ],
    };
    expect(closeoutSummary(m, definitions, at)).toMatchObject({ state: "closed", activeMinutes: 60 });
    const findings = documentQuality(m, { at });
    expect(findings.filter((f) => f.id.startsWith("journal-attribution:"))).toHaveLength(2);
    expect(findings.some((f) => f.id === "journal-note:1")).toBe(true);
    const text = closeoutSections({ snapshot: m, issuedAt: new Date(at).toISOString() })
      .flat()
      .join("\n");
    expect(text).not.toContain("session has not been closed");
    expect(text).not.toContain("undefined");
  });
  it("keeps cancellation visible separately from a closed session in review and exported facts", () => {
    const m = { ...mission, cancelled: true, fieldJournal: [event("start", "09:00"), event("close", "10:00")] };
    expect(documentQuality(m, { at }).some((f) => f.id === "mission-cancelled")).toBe(true);
    expect(
      closeoutSections({ snapshot: m, issuedAt: new Date(at).toISOString() })
        .flat()
        .join("\n")
    ).toContain("Mission status: Cancelled");
  });
  it("prioritises session state instead of suggesting flight permission", () => {
    expect(nextMissionStep(mission, [{ key: "time", text: "Confirm times" }], definitions, at)).toMatchObject({
      section: "overview",
      phase: "prepare",
    });
    const paused = { ...mission, fieldJournal: [event("start", "09:00"), event("pause", "09:20")] };
    expect(nextMissionStep(paused, [], definitions, at)).toMatchObject({ section: "field", phase: "paused" });
    expect(nextMissionStep({ ...paused, cancelled: true }, [], definitions, at)).toMatchObject({ phase: "cancelled" });
    const closed = { ...paused, fieldJournal: [...paused.fieldJournal, event("close", "10:00")] };
    expect(nextMissionStep(closed, [], definitions, at)).toMatchObject({ section: "checklist", phase: "handover" });
    closed.checklist = { post: { status: "done", by: "Alex", at: "2026-10-29T10:00:00Z" } };
    expect(nextMissionStep(closed, [], definitions, at)).toMatchObject({ exportKind: "closeout" });
  });
  it("derives coordination time, pauses and closure notes without declaring survey completion", () => {
    const m = {
      ...mission,
      fieldJournal: [
        event("start", "09:00"),
        event("pause", "09:20", "Wind review"),
        event("resume", "09:40"),
        event("close", "10:20", "Data handed over"),
      ],
    };
    const summary = closeoutSummary(m, definitions, at);
    expect(summary).toMatchObject({
      state: "closed",
      activeMinutes: 60,
      pausedMinutes: 20,
      closingNote: "Data handed over",
      postRecorded: 0,
      postTotal: 1,
    });
    expect(summary.pauses[0].note).toBe("Wind review");
    const text = closeoutSections({ snapshot: m, issuedAt: new Date(at).toISOString() })
      .flat()
      .join("\n");
    expect(text).toContain("not flight time");
    expect(text).toContain("Planned deliverables");
    expect(text).not.toContain("Survey completed");
  });
  it("never certifies unrecorded, future or unnamed post-operation checks", () => {
    for (const check of [
      { status: "done" },
      { status: "done", by: "Alex", at: "2099-01-01" },
      { status: "done", by: " ", at: "2026-10-29" },
    ]) {
      const m = { ...mission, checklist: { post: check } };
      expect(closeoutSummary(m, definitions, at).postRecorded).toBe(0);
      expect(documentQuality(m, { at }).some((i) => i.id === "check-attribution:post")).toBe(true);
    }
  });
  it("finds contradictory evidence times, invalid expiry dates and missing source links", () => {
    const m = {
      ...mission,
      evidence: [
        { id: "e", checkedAt: "2026-10-29T11:00Z", validUntil: "2026-10-29T10:00Z", source: "", reviewer: "Alex" },
      ],
      sourceFacts: [{ field: "client", sourceName: "Manual", expiresOn: "2026-02-30" }],
    };
    const ids = documentQuality(m, { at }).map((i) => i.id);
    expect(ids).toContain("evidence-dates:e");
    expect(ids).toContain("evidence-source:e");
    expect(ids).toContain("source-expiry:client:0");
  });
  it("does not invent dates or duration for missing or malformed session records", () => {
    expect(closeoutSummary(mission, definitions, at)).toMatchObject({ state: "idle", activeMinutes: null });
    const m = { ...mission, fieldJournal: [event("start", "10:00"), event("close", "09:00")] };
    expect(closeoutSummary(m, definitions, at)).toMatchObject({ state: "invalid", activeMinutes: null });
    expect(documentQuality(m, { at }).some((i) => i.id === "journal-invalid")).toBe(true);
  });
  it("detects export review changes including linked records and freezes output to the selected snapshot", () => {
    const first = { kind: "draft", issuedAt: new Date(at).toISOString(), snapshot: structuredClone(mission) };
    const key = exportReviewKey(first);
    const later = structuredClone(first);
    later.snapshot.records = { pilot: { name: "New pilot" } };
    expect(exportReviewKey(later)).not.toBe(key);
    later.issuedAt = "2026-10-29T12:00:01Z";
    expect(exportReviewKey({ ...first, issuedAt: later.issuedAt })).toBe(key);
    expect(closeoutSections(first).flat().join("\n")).not.toContain("New pilot");
  });
});
