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
});
