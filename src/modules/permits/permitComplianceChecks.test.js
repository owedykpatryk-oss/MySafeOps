import { describe, it, expect } from "vitest";
import { evaluatePermitCompliance } from "./permitComplianceChecks";

describe("evaluatePermitCompliance", () => {
  const items = [{ id: "general_1", text: "Work scope defined", required: true }];

  it("adds hard stop when end is before start", () => {
    const r = evaluatePermitCompliance(
      {
        type: "general",
        description: "Test",
        location: "Here",
        issuedBy: "A",
        issuedTo: "B",
        startDateTime: "2026-04-10T12:00:00.000Z",
        endDateTime: "2026-04-10T08:00:00.000Z",
        checklist: { general_1: true },
      },
      items
    );
    expect(r.invalidTimeRange).toBe(true);
    expect(r.hardStops.length).toBeGreaterThan(0);
  });

  it("reports legalReady when baseline satisfied for general", () => {
    const r = evaluatePermitCompliance(
      {
        type: "general",
        description: "Scope",
        location: "Yard",
        issuedBy: "Issuer",
        issuedTo: "Holder",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: {},
        checklist: {
          general_1: true,
          general_2: true,
          general_4: true,
          general_6: true,
        },
      },
      [
        { id: "general_1", text: "1", required: true },
        { id: "general_2", text: "2", required: true },
        { id: "general_3", text: "3", required: true },
        { id: "general_4", text: "4", required: true },
        { id: "general_5", text: "5", required: true },
        { id: "general_6", text: "6", required: true },
      ]
    );
    expect(r.legalReady).toBe(true);
  });
});
