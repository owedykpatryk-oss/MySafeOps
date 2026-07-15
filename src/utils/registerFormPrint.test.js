import { describe, expect, it } from "vitest";
import {
  buildCoshhFormBody,
  buildToolboxFormBody,
  buildInspectionFormBody,
  buildTrainingFormBody,
  buildGenericRegisterFormBody,
  buildRegisterFormDocument,
  formatFormValue,
  humanizeFormKey,
  listRegisterFormModules,
} from "./registerFormPrint";

describe("registerFormPrint", () => {
  it("formats values for print tables", () => {
    expect(formatFormValue(true)).toBe("Yes");
    expect(formatFormValue(false)).toBe("No");
    expect(formatFormValue(["A", "B"])).toBe("A, B");
    expect(humanizeFormKey("riskLevel")).toBe("Risk Level");
  });

  it("builds COSHH assessment with hazard chips and signatures", () => {
    const html = buildCoshhFormBody({
      name: "WD-40",
      riskLevel: "high",
      hazardTypes: ["Flammable"],
      exposureRoutes: ["Inhalation"],
      ppeRequired: ["Nitrile gloves"],
      firstAid: "Wash skin",
    });
    expect(html).toContain("WD-40");
    expect(html).toContain("Flammable");
    expect(html).toContain("Nitrile gloves");
    expect(html).toContain("Authorisation");
    expect(html).toContain("HIGH RISK");
  });

  it("builds toolbox talk with attendance grid", () => {
    const html = buildToolboxFormBody({
      topic: "Working at height",
      presenter: "Pat",
      attendeeCount: 6,
      summary: "Harness checks",
    });
    expect(html).toContain("Working at height");
    expect(html).toContain("Attendance");
    expect(html).toContain("Harness checks");
  });

  it("builds inspection and training forms", () => {
    expect(buildInspectionFormBody({ name: "Chain block", type: "loler", result: "pass" })).toContain("LOLER");
    expect(buildTrainingFormBody({ courseName: "IPAF", workerName: "Alex" })).toContain("IPAF");
  });

  it("builds generic form from columns", () => {
    const html = buildGenericRegisterFormBody(
      { ladderRef: "L-12", result: "pass", location: "Yard" },
      [
        { k: "ladderRef", l: "Ref" },
        { k: "result", l: "Result" },
      ]
    );
    expect(html).toContain("L-12");
    expect(html).toContain("Yard");
  });

  it("wraps document with org branding shell", () => {
    const doc = buildRegisterFormDocument(
      { name: "Acme Civils", primaryColor: "#0C447C" },
      {
        pageTitle: "Test",
        docTitle: "COSHH assessment",
        docSubtitle: "WD-40",
        docBadge: "COSHH",
        bodyHtml: "<p>Body</p>",
      }
    );
    expect(doc).toContain("COSHH assessment");
    expect(doc).toContain("Acme Civils");
    expect(doc).toContain("Body");
    expect(doc).toContain("@page");
  });

  it("exposes form printers for main HSE register modules", () => {
    const ids = listRegisterFormModules();
    expect(ids).toContain("coshh");
    expect(ids).toContain("toolbox-reg");
    expect(ids).toContain("inspections");
    expect(ids).toContain("training");
    expect(ids.length).toBeGreaterThan(20);
  });
});
