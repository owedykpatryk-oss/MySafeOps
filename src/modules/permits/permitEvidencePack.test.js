import { describe, it, expect } from "vitest";
import { buildEvidencePackCsv, buildPermitEvidencePack } from "./permitEvidencePack";
import { evaluatePermitCompliance } from "./permitComplianceChecks";

describe("buildEvidencePackCsv", () => {
  const checklistItems = [
    { id: "general_1", text: "Work scope defined", required: true },
    { id: "general_2", text: "2", required: true },
    { id: "general_3", text: "3", required: true },
    { id: "general_4", text: "4", required: true },
    { id: "general_5", text: "5", required: true },
    { id: "general_6", text: "6", required: true },
  ];

  it("includes UTF-8 BOM and summary rows", () => {
    const permit = {
      id: "p1",
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
      checklist: Object.fromEntries(checklistItems.map((i) => [i.id, true])),
    };
    const compliance = evaluatePermitCompliance(permit, checklistItems);
    const csv = buildEvidencePackCsv(permit, compliance, checklistItems);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("summary,overallPass");
    expect(csv).toContain("PASS");
  });

  it("escapes commas and quotes in CSV cells", () => {
    const permit = {
      id: "p2",
      type: "general",
      location: 'Yard "A", north gate',
      extraFields: {},
      checklist: {},
    };
    const compliance = evaluatePermitCompliance(permit, []);
    const csv = buildEvidencePackCsv(permit, compliance, []);
    expect(csv).toContain('"Yard ""A"", north gate"');
  });
});

describe("buildPermitEvidencePack", () => {
  it("returns overallPass aligned with compliance", () => {
    const permit = { id: "x", type: "general", checklist: {}, extraFields: {} };
    const compliance = { legalReady: false, regulatoryMatrix: [] };
    const pack = buildPermitEvidencePack(permit, compliance, []);
    expect(pack.summary.overallPass).toBe(false);
  });
});
