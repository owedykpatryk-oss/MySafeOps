import { describe, expect, it, beforeEach } from "vitest";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml.js";
import { blankSurveyReport } from "./surveyReportConstants.js";
import {
  applyPas128MethodToReport,
  buildPas128MethodologyText,
  includesPas128MethodLimitations,
  pas128MethodLabel,
} from "./pas128MethodPresets.js";

describe("pas128MethodPresets", () => {
  it("labels M-series methods", () => {
    expect(pas128MethodLabel("M4P")).toMatch(/MH\/IC/i);
    expect(pas128MethodLabel("M1")).toMatch(/Desktop/i);
  });

  it("applies M2P methodology and default QL without overwriting existing text", () => {
    const base = blankSurveyReport({
      surveyType: "utility_mapping_survey",
      sections: { methodology: "Custom method from site." },
    });
    const next = applyPas128MethodToReport(base, "M2P", { overwrite: false });
    expect(next.pas128Method).toBe("M2P");
    expect(next.pas128Ql).toBe("B1");
    expect(next.sections.methodology).toBe("Custom method from site.");
    expect(next.limitationKeys).toContain("gpr_depth_limit");
  });

  it("overwrites methodology when requested", () => {
    const base = blankSurveyReport({
      surveyType: "utility_mapping_survey",
      sections: { methodology: "Old text." },
    });
    const next = applyPas128MethodToReport(base, "M3P", { overwrite: true });
    expect(next.sections.methodology).toBe(buildPas128MethodologyText("M3P"));
    expect(next.sections.equipmentUsed).toMatch(/multi-channel array/i);
  });

  it("M1 desktop sets B4 and skips EML/GPR limitation blocks", () => {
    const next = applyPas128MethodToReport(blankSurveyReport(), "M1");
    expect(next.pas128Ql).toBe("B4");
    expect(next.limitationKeys).toContain("desktop_only");
    expect(includesPas128MethodLimitations("M1")).toBe(false);
    expect(includesPas128MethodLimitations("M2")).toBe(true);
  });
});

describe("surveyReportPrintHtml PAS128 method sections", () => {
  beforeEach(() => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  it("renders EML and GPR limitation sections for M4P utility reports", () => {
    const report = applyPas128MethodToReport(
      blankSurveyReport({
        title: "Hospital utility survey",
        surveyType: "utility_mapping_survey",
        sections: {
          scope: "Full utility mapping.",
          methodology: buildPas128MethodologyText("M4P"),
          findings: "Services traced.",
        },
      }),
      "M4P",
      { overwrite: true }
    );
    const html = buildSurveyReportHtml(report, {});
    expect(html).toContain("Limitations of EML");
    expect(html).toContain("Limitations of GPR");
    expect(html).toContain("Survey workflow");
    expect(html).toContain("M4P");
    expect(html).toMatch(/signal from a cable in a duct/i);
    expect(html).toMatch(/10% rule/i);
  });

  it("omits EML/GPR limitation sections for M1 desktop", () => {
    const report = applyPas128MethodToReport(
      blankSurveyReport({
        title: "Desktop search",
        surveyType: "utility_mapping_survey",
        sections: {
          scope: "Desktop records.",
          methodology: buildPas128MethodologyText("M1"),
          findings: "Undertaker responses summarised.",
        },
      }),
      "M1",
      { overwrite: true }
    );
    const html = buildSurveyReportHtml(report, {});
    expect(html).not.toContain("Limitations of EML");
    expect(html).not.toContain("Limitations of GPR");
    expect(html).toContain("M1");
  });
});
