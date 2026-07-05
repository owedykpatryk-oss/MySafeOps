import { describe, it, expect } from "vitest";
import {
  isDigPermitType,
  pas128QualityMeta,
  pas128SurveyMeta,
  mechanicalDigAssessment,
  renderDigGuidancePrintHtml,
  renderPas128QlLadderSvg,
  renderPas128SurveyTypeSvg,
} from "./permitDigGuidance";

describe("permitDigGuidance", () => {
  it("identifies dig permit types", () => {
    expect(isDigPermitType("excavation")).toBe(true);
    expect(isDigPermitType("hot_work")).toBe(false);
  });

  it("returns PAS 128 QL metadata with accuracy bands", () => {
    const b = pas128QualityMeta("QL-B");
    expect(b?.horizontalMm).toBe(250);
    expect(b?.verticalMm).toBe(250);
    const a = pas128QualityMeta("QL-A");
    expect(a?.horizontalMm).toBe(50);
  });

  it("maps B1 survey type to QL-B", () => {
    const b1 = pas128SurveyMeta("B1");
    expect(b1?.mapsToQl).toBe("QL-B");
    expect(b1?.methods).toMatch(/CAT/i);
  });

  it("blocks mechanical dig on Type D with yes", () => {
    const r = mechanicalDigAssessment({
      pas128QualityLevel: "QL-D",
      pas128SurveyType: "D",
      mechanicalDigAllowed: "yes",
    });
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("renders print HTML with PAS128 graphics for excavation", () => {
    const html = renderDigGuidancePrintHtml({
      type: "excavation",
      extraFields: { pas128QualityLevel: "QL-B", pas128SurveyType: "B1" },
    });
    expect(html).toContain("Safe dig");
    expect(html).toContain("PAS 128");
    expect(html).toContain("QL-B");
    expect(html).toContain("<svg");
  });

  it("highlights selected QL in ladder SVG", () => {
    const svg = renderPas128QlLadderSvg({ highlightId: "QL-A" });
    expect(svg).toContain("QL-A");
    expect(svg).toContain("#166534");
  });

  it("highlights B1 in survey type SVG", () => {
    const svg = renderPas128SurveyTypeSvg({ highlightId: "B1" });
    expect(svg).toContain("B1");
  });
});
