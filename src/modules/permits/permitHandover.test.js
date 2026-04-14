import { describe, expect, it } from "vitest";
import {
  evaluatePermitHandoverRequirement,
  isCompleteHandoverEntry,
  latestCompletedHandover,
  normalizeShiftHours,
  normalizePermitHandoverLog,
} from "./permitHandover";

describe("permitHandover", () => {
  it("normalizes malformed log input", () => {
    const rows = normalizePermitHandoverLog([{ whatChanged: "Scope update", criticalControlsConfirmed: true }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].whatChanged).toBe("Scope update");
    expect(rows[0].criticalControlsConfirmed).toBe(true);
  });

  it("normalizes shift boundaries and applies default when empty", () => {
    expect(normalizeShiftHours([18, 6, 18, 30, -1])).toEqual([6, 18]);
    expect(normalizeShiftHours([])).toEqual([6, 18]);
  });

  it("detects complete handover entries", () => {
    const entry = {
      whatChanged: "Updated isolations",
      remainingHighRisk: "Live panel nearby",
      criticalControlsConfirmed: true,
      outgoingSupervisor: "Alex",
      incomingSupervisor: "Maya",
      outgoingAcknowledgedAt: "2026-01-10T18:01:00.000Z",
      incomingAcknowledgedAt: "2026-01-10T18:02:00.000Z",
    };
    expect(isCompleteHandoverEntry(entry)).toBe(true);
  });

  it("returns latest completed entry", () => {
    const latest = latestCompletedHandover([
      {
        submittedAt: "2026-01-10T06:01:00.000Z",
        whatChanged: "A",
        remainingHighRisk: "B",
        criticalControlsConfirmed: true,
        outgoingSupervisor: "Old",
        incomingSupervisor: "Old2",
        outgoingAcknowledgedAt: "2026-01-10T06:01:00.000Z",
        incomingAcknowledgedAt: "2026-01-10T06:02:00.000Z",
      },
      {
        submittedAt: "2026-01-10T18:01:00.000Z",
        whatChanged: "C",
        remainingHighRisk: "D",
        criticalControlsConfirmed: true,
        outgoingSupervisor: "New",
        incomingSupervisor: "New2",
        outgoingAcknowledgedAt: "2026-01-10T18:01:00.000Z",
        incomingAcknowledgedAt: "2026-01-10T18:02:00.000Z",
      },
    ]);
    expect(latest?.outgoingSupervisor).toBe("New");
  });

  it("marks active permit as missing handover after boundary", () => {
    const permit = {
      status: "active",
      startDateTime: "2026-01-10T01:00:00.000Z",
      endDateTime: "2026-01-10T23:00:00.000Z",
      handoverLog: [],
    };
    const state = evaluatePermitHandoverRequirement(permit, new Date("2026-01-10T19:00:00.000Z"), { shiftHours: [6, 18] });
    expect(state.required).toBe(true);
    expect(state.missing).toBe(true);
  });

  it("clears missing when complete handover exists after boundary", () => {
    const permit = {
      status: "active",
      startDateTime: "2026-01-10T01:00:00.000Z",
      endDateTime: "2026-01-10T23:00:00.000Z",
      handoverLog: [
        {
          submittedAt: "2026-01-10T18:05:00.000Z",
          whatChanged: "Permit scope narrowed",
          remainingHighRisk: "Potential ignition source",
          criticalControlsConfirmed: true,
          outgoingSupervisor: "Alex",
          incomingSupervisor: "Maya",
          outgoingAcknowledgedAt: "2026-01-10T18:05:00.000Z",
          incomingAcknowledgedAt: "2026-01-10T18:06:00.000Z",
        },
      ],
    };
    const state = evaluatePermitHandoverRequirement(permit, new Date("2026-01-10T19:00:00.000Z"), { shiftHours: [6, 18] });
    expect(state.required).toBe(true);
    expect(state.missing).toBe(false);
  });
});
