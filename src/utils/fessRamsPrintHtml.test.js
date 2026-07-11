/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { buildFessRamsPrintBodyHTML, generateFessPrintHTML } from "./fessRamsPrintHtml";

describe("fessRamsPrintHtml", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("returns empty for non-FESS org", () => {
    setOrgId("acme");
    expect(buildFessRamsPrintBodyHTML({}, [], [], {})).toBe("");
    expect(generateFessPrintHTML({}, [], [], {})).toBe("");
  });

  it("renders Excel-style RA table with FESS branding", () => {
    const html = buildFessRamsPrintBodyHTML(
      {
        title: "RAMS — DOLAV works",
        documentNo: "RAMS-001",
        revision: "1A",
        jobRef: "FP1-DOLAV-2026-100",
        client: "2 Sisters Food Group",
        location: "2SFG Scunthorpe",
        scope: "DOLAV station M&E",
        surveyMethodStatement: "1. Isolate\n\n2. Install",
        fessJobStarterLabel: "DOLAV & MEYN station works",
      },
      [
        {
          activity: "Working at height",
          hazard: "Fall from ladder",
          initialRisk: { L: 4, S: 4, RF: 16 },
          revisedRisk: { L: 2, S: 4, RF: 8 },
          controlMeasures: ["Use tower scaffold", "3 points of contact"],
        },
      ],
      ["Operative A"],
      { proj1: "2SFG Scunthorpe" }
    );
    expect(html).toMatch(/FESS Group/);
    expect(html).toMatch(/Risk assessment/);
    expect(html).toMatch(/Control measures/);
    expect(html).toMatch(/FP1-DOLAV-2026-100/);
    expect(html).toMatch(/Fall from ladder/);
  });

  it("wraps full HTML document", () => {
    const doc = generateFessPrintHTML({ title: "Test RAMS" }, [], [], {});
    expect(doc).toMatch(/<!DOCTYPE html>/i);
    expect(doc).toMatch(/FESS layout/);
  });
});
