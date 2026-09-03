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
        authorisedByRole: "Site manager",
        briefingConfirmedAt: "2026-04-09T07:30:00.000Z",
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

  it("keeps UK PUWER/LOLER/CDM/SHE hard-stop labels on UK lifting", () => {
    const r = evaluatePermitCompliance(
      {
        type: "lifting",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: {},
      },
      [],
      { marketId: "uk" }
    );
    const frameworks = r.regulatoryMatrix.map((row) => row.framework).join(" ");
    const labels = r.regulatoryMatrix.map((row) => row.label).join(" ");
    expect(frameworks).toMatch(/LOLER/);
    expect(frameworks).toMatch(/PUWER/);
    expect(frameworks).toMatch(/CDM/);
    expect(labels).toMatch(/appointed person/i);
    expect(r.hardStops.some((msg) => /PUWER\/LOLER\/CDM\/SHE/i.test(msg))).toBe(true);
  });

  it("drops UK LOLER/PUWER/CDM hard-stop labels on Poland and Australia lifting", () => {
    const pl = evaluatePermitCompliance(
      {
        type: "lifting",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: {},
      },
      [],
      { marketId: "pl" }
    );
    const au = evaluatePermitCompliance(
      {
        type: "lifting",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: {},
      },
      [],
      { marketId: "au" }
    );
    const plFrameworks = pl.regulatoryMatrix.map((row) => row.framework).join(" ");
    const auFrameworks = au.regulatoryMatrix.map((row) => row.framework).join(" ");
    const plLabels = pl.regulatoryMatrix.map((row) => row.label).join(" ");
    const auLabels = au.regulatoryMatrix.map((row) => row.label).join(" ");
    expect(plFrameworks).toMatch(/UDT/);
    expect(plFrameworks).toMatch(/BHP/);
    expect(plFrameworks).not.toMatch(/LOLER|PUWER|CDM|SHE|WAHR/);
    expect(plLabels).toMatch(/osoba kompetentna/i);
    expect(plLabels).not.toMatch(/appointed person/i);
    expect(pl.hardStops.some((msg) => /UDT\/BHP/i.test(msg))).toBe(true);
    expect(pl.hardStops.join(" ")).not.toMatch(/LOLER|PUWER|CDM/);
    expect(auFrameworks).toMatch(/WHS/);
    expect(auFrameworks).not.toMatch(/LOLER|PUWER|CDM|SHE|WAHR/);
    expect(auLabels).toMatch(/competent person/i);
    expect(auLabels).not.toMatch(/appointed person/i);
    expect(au.hardStops.some((msg) => /WHS/i.test(msg))).toBe(true);
    expect(au.hardStops.join(" ")).not.toMatch(/LOLER|PUWER|CDM/);
  });
});
