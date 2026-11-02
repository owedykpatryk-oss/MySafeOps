import { describe, it, expect } from "vitest";
import { evaluatePermitCompliance } from "./permitComplianceChecks";
import { getPermitTypesForMarket } from "./permitTypesMarket";
import { getComplianceProfile, getTypeComplianceMeta } from "./ukComplianceMatrix";

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

  it("does not require UK PAS 128 evidence on Poland or Australia excavation", () => {
    const extra = {
      catScanBy: "Jan",
      knownServices: "Woda",
      excavationDepth: 1.2,
      surveyDrawingRef: "CPD-1",
    };
    const uk = evaluatePermitCompliance(
      {
        type: "excavation",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: extra,
      },
      [],
      { marketId: "uk" }
    );
    const pl = evaluatePermitCompliance(
      {
        type: "excavation",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: extra,
      },
      [],
      { marketId: "pl" }
    );
    const au = evaluatePermitCompliance(
      {
        type: "excavation",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: extra,
      },
      [],
      { marketId: "au" }
    );
    expect(uk.missingEvidence).toEqual(expect.arrayContaining(["pas128QualityLevel", "pas128SurveyType"]));
    expect(pl.missingEvidence).not.toContain("pas128QualityLevel");
    expect(pl.missingEvidence).not.toContain("pas128SurveyType");
    expect(au.missingEvidence).not.toContain("pas128QualityLevel");
    expect(au.missingEvidence).not.toContain("pas128SurveyType");
    const savedUkProfile = {
      legalRequiredChecklistIds: [],
      requiredEvidenceFields: ["catScanBy", "pas128QualityLevel", "pas128SurveyType", "surveyDrawingRef"],
    };
    const plOverride = evaluatePermitCompliance(
      {
        type: "excavation",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T16:00:00.000Z",
        extraFields: extra,
      },
      [],
      { marketId: "pl", profileOverride: savedUkProfile }
    );
    expect(plOverride.missingEvidence).not.toContain("pas128QualityLevel");
    expect(plOverride.missingEvidence).not.toContain("pas128SurveyType");
  });

  it("keeps HSE / WAHR rationale on UK PTW and uses PIP / WHS copy off UK", () => {
    const uk = getTypeComplianceMeta("work_at_height", "uk");
    const pl = getTypeComplianceMeta("work_at_height", "pl");
    const au = getTypeComplianceMeta("work_at_height", "au");
    expect(uk.hseUrl).toMatch(/hse\.gov\.uk/);
    expect(uk.linkLabel).toMatch(/HSE/);
    expect(uk.rationale).toMatch(/WAHR/);
    expect(pl.hseUrl).toMatch(/pip\.gov\.pl/);
    expect(pl.linkLabel).toMatch(/PIP/);
    expect(pl.rationale).not.toMatch(/WAHR|HSE|LOLER/);
    expect(au.hseUrl).toMatch(/safeworkaustralia/);
    expect(au.linkLabel).toMatch(/WHS/);
    expect(au.rationale).not.toMatch(/WAHR|HSE|LOLER/);
    expect(getComplianceProfile("excavation", "uk").requiredEvidenceFields).toContain("pas128QualityLevel");
    expect(getComplianceProfile("excavation", "pl").requiredEvidenceFields).not.toContain("pas128QualityLevel");
    expect(getComplianceProfile("excavation", "au").requiredEvidenceFields).not.toContain("pas128SurveyType");
  });

  it("does not require UK checklist IDs that are missing from the Poland form", () => {
    const plItems = getPermitTypesForMarket("pl").excavation.checklist.map((text, i) => ({
      id: `excavation_${i + 1}`,
      text,
      required: true,
    }));
    expect(plItems).toHaveLength(6);
    const checklist = Object.fromEntries(plItems.map((item) => [item.id, true]));
    const extra = {
      catScanBy: "Jan",
      knownServices: "Woda",
      excavationDepth: 1.2,
      surveyDrawingRef: "CPD-1",
    };
    const permit = {
      type: "excavation",
      description: "Wykop",
      location: "Plac",
      issuedBy: "A",
      issuedTo: "B",
      authorisedByRole: "Kierownik",
      briefingConfirmedAt: "2026-04-09T07:30:00.000Z",
      startDateTime: "2026-04-09T08:00:00.000Z",
      endDateTime: "2026-04-09T16:00:00.000Z",
      extraFields: extra,
      checklist,
    };

    expect(getComplianceProfile("excavation", "uk").legalRequiredChecklistIds).toContain("excavation_8");
    expect(getComplianceProfile("excavation", "pl").legalRequiredChecklistIds).not.toContain("excavation_8");
    expect(getComplianceProfile("work_at_height", "uk").legalRequiredChecklistIds).toContain("work_at_height_8");
    expect(getComplianceProfile("work_at_height", "pl").legalRequiredChecklistIds).not.toContain("work_at_height_8");
    expect(getComplianceProfile("electrical", "pl").legalRequiredChecklistIds).not.toContain("electrical_7");

    const pl = evaluatePermitCompliance(permit, plItems, { marketId: "pl" });
    expect(pl.missingChecklist).not.toContain("excavation_8");
    expect(pl.legalReady).toBe(true);

    const plOverride = evaluatePermitCompliance(permit, plItems, {
      marketId: "pl",
      profileOverride: {
        legalRequiredChecklistIds: ["excavation_1", "excavation_8"],
        requiredEvidenceFields: ["catScanBy"],
      },
    });
    expect(plOverride.missingChecklist).not.toContain("excavation_8");
    expect(plOverride.legalReady).toBe(true);

    const ukItems = getPermitTypesForMarket("uk").excavation.checklist.map((text, i) => ({
      id: `excavation_${i + 1}`,
      text,
      required: true,
    }));
    const ukUnchecked = evaluatePermitCompliance(
      {
        ...permit,
        authorisedByRole: "Appointed person",
        extraFields: {
          ...extra,
          pas128QualityLevel: "QL-B",
          pas128SurveyType: "B1",
        },
        checklist: Object.fromEntries(ukItems.map((item) => [item.id, item.id !== "excavation_8"])),
      },
      ukItems,
      { marketId: "uk" }
    );
    expect(ukUnchecked.missingChecklist).toContain("excavation_8");
    expect(ukUnchecked.legalReady).toBe(false);
  });
});
