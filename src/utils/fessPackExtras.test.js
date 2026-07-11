/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { seedFessCoshhRegister, FESS_COSHH_STARTER_SUBSTANCES } from "./fessCoshhDefaults";
import { buildFessMethodStatementPackHtml } from "./fessMsPrintHtml";
import { parseRamsMethodSteps, buildMsStepsFromRams } from "./fessMsWorkflow";
import { findLinkedMethodStatement } from "./fessSitePack";

describe("fessCoshhDefaults", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("exposes starter substances", () => {
    expect(FESS_COSHH_STARTER_SUBSTANCES.length).toBeGreaterThanOrEqual(5);
  });

  it("seeds COSHH register for FESS org", () => {
    const first = seedFessCoshhRegister();
    expect(first.created).toBe(FESS_COSHH_STARTER_SUBSTANCES.length);
    const second = seedFessCoshhRegister();
    expect(second.created).toBe(0);
  });
});

describe("fessMsWorkflow", () => {
  it("parses numbered RAMS method steps", () => {
    const steps = parseRamsMethodSteps("1. Sign in\n\n2. Isolate services\n\n3. Test and hand back");
    expect(steps.length).toBe(3);
    expect(steps[1]).toMatch(/Isolate/i);
  });

  it("builds MS steps from RAMS doc", () => {
    const rows = buildMsStepsFromRams(
      { surveyMethodStatement: "1. Mobilise\n\n2. Work safely" },
      () => "id_1"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].seq).toBe(1);
  });
});

describe("fessMsPrintHtml", () => {
  it("renders five-page FESS MS sections", () => {
    const html = buildFessMethodStatementPackHtml(
      { title: "MS test", location: "Site", steps: [{ seq: 1, title: "Mobilise", description: "Sign in" }] },
      ["Operative A"],
      [{ name: "IPA", hazardTypes: ["flammable"], ppeRequired: ["Gloves"], storageLocation: "Van", sdsUrl: "" }],
      null
    );
    expect(html).toMatch(/Page 1 — Mobilisation/i);
    expect(html).toMatch(/Page 5 — Briefing record/i);
    expect(html).toMatch(/COSHH assessment/i);
  });
});

describe("fessSitePack", () => {
  it("finds linked method statement by relatedRamsId", () => {
    const ms = findLinkedMethodStatement(
      { id: "rams_1", projectId: "p1" },
      [
        { id: "ms_a", projectId: "p1", relatedRamsId: "rams_1" },
        { id: "ms_b", projectId: "p1" },
      ]
    );
    expect(ms?.id).toBe("ms_a");
  });
});
