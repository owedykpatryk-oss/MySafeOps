import { describe, it, expect } from "vitest";
import { runPermitQualityGates } from "./permitQualityGates";

describe("runPermitQualityGates", () => {
  it("passes when all core fields valid", () => {
    const r = runPermitQualityGates({
      description: "Work",
      location: "A1",
      issuedBy: "Alice",
      issuedTo: "Bob",
      startDateTime: "2026-04-09T08:00:00.000Z",
      endDateTime: "2026-04-09T10:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.failed).toHaveLength(0);
  });

  it("fails when time range invalid", () => {
    const r = runPermitQualityGates({
      description: "Work",
      location: "A1",
      issuedBy: "Alice",
      issuedTo: "Bob",
      startDateTime: "2026-04-09T10:00:00.000Z",
      endDateTime: "2026-04-09T08:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.failed.some((f) => f.id === "timeRange")).toBe(true);
  });

  it("allows optional issuedTo when configured", () => {
    const r = runPermitQualityGates(
      {
        description: "Work",
        location: "A1",
        issuedBy: "Alice",
        issuedTo: "",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
      },
      { required: { issuedTo: false } }
    );
    expect(r.ok).toBe(true);
  });

  it("returns contextual smart recommendations for hot work", () => {
    const r = runPermitQualityGates(
      {
        type: "hot_work",
        description: "Welding in plant room",
        location: "A1",
        issuedBy: "Alice",
        issuedTo: "Bob",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T10:00:00.000Z",
        notes: "",
        evidenceNotes: "",
        checklist: {},
        checklistItems: [],
      },
      { dynamicMissing: ["Fire watch (minutes)"] }
    );
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.recommendations)).toBe(true);
    expect(r.recommendations.some((x) => String(x?.text || "").toLowerCase().includes("fire watch"))).toBe(true);
    expect(r.recommendations.some((x) => String(x?.text || "").toLowerCase().includes("rams"))).toBe(true);
    expect(r.recommendations.some((x) => x?.autofix)).toBe(true);
  });
});
