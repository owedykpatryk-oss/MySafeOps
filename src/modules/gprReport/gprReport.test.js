import { describe, expect, it } from "vitest";
import { blankGprReport } from "./gprReportConstants.js";
import { buildLimitationsFromKeys, gprReportQuality, nextGprRef, normalizeGprReport, buildAnomaliesGeoJson, buildDuplicateGprPayload, autoNumberAnomalies } from "./gprReportHelpers.js";
import { suggestGprLimitationKeys } from "./gprReportSmart.js";
import { applyIndustryGprTemplate } from "./gprReportTemplateContext.js";

describe("gprReportHelpers", () => {
  it("normalizes legacy partial report", () => {
    const r = normalizeGprReport({ ref: "GPR-2026-001" });
    expect(r.equipment.length).toBeGreaterThan(0);
    expect(r.acquisition.scanMode).toBe("grid");
  });

  it("generates sequential refs", () => {
    const year = new Date().getFullYear();
    const ref = nextGprRef([{ ref: `GPR-${year}-003` }]);
    expect(ref).toBe(`GPR-${year}-004`);
  });

  it("builds limitations from keys", () => {
    const text = buildLimitationsFromKeys(["velocity_uncertainty", "no_verification"]);
    expect(text).toMatch(/velocity/i);
    expect(text).toMatch(/verification/i);
  });

  it("scores report completeness", () => {
    const draft = blankGprReport();
    expect(gprReportQuality(draft).score).toBeLessThan(50);
    const full = blankGprReport({
      ref: "GPR-2026-001",
      surveyor: "Test",
      surveyDate: "2026-01-01",
      equipment: [{ manufacturer: "GSSI", model: "SIR 4000", antennaFrequencyMhz: 400 }],
      groundConditions: { narrative: "Clay", fetchedAt: "2026-01-01" },
      environmental: { description: "Dry" },
      sections: { methodology: "GPR grid", findings: "None", limitations: "Standard" },
      velocityModel: { assumedVelocityCmNs: 10 },
    });
    expect(gprReportQuality(full).score).toBeGreaterThan(70);
  });

  it("exports anomalies as GeoJSON feature collection", () => {
    const report = blankGprReport({
      anomalies: [{ id: "a1", ref: "A1", anomalyType: "utility", depthM: 1.2, confidence: "high" }],
    });
    const geo = buildAnomaliesGeoJson(report);
    expect(geo.type).toBe("FeatureCollection");
    expect(geo.features[0].properties.ref).toBe("A1");
    expect(geo.features[0].properties.anomalyType).toBe("utility");
  });

  it("duplicates report with new id and draft status", () => {
    const original = blankGprReport({ ref: "GPR-2026-001", title: "Site scan", status: "final" });
    const dup = buildDuplicateGprPayload(original);
    expect(dup.id).not.toBe(original.id);
    expect(dup.ref).toBe("");
    expect(dup.title).toBe("Site scan (copy)");
    expect(dup.status).toBe("draft");
  });

  it("auto-numbers anomalies sequentially", () => {
    const report = blankGprReport({
      anomalies: [{ id: "a1" }, { id: "a2" }],
    });
    const numbered = autoNumberAnomalies(report);
    expect(numbered.anomalies[0].ref).toBe("A1");
    expect(numbered.anomalies[1].ref).toBe("A2");
  });
});

describe("gprReportSmart limitations", () => {
  it("suggests clay attenuation limitation", () => {
    const report = blankGprReport({
      groundConditions: { attenuationClass: "high", materialClass: "clay_silt" },
    });
    const keys = suggestGprLimitationKeys(report);
    expect(keys).toContain("attenuation_clay");
    expect(keys).toContain("velocity_uncertainty");
  });
});

describe("gprReportTemplateContext", () => {
  it("applies generic foreword and processing filters without client branding", () => {
    const out = applyIndustryGprTemplate(blankGprReport());
    expect(out.sections.foreword).toMatch(/non-destructive/i);
    expect(out.sections.foreword).not.toMatch(/utility mapping/i);
    expect(out.processing.filters.length).toBeGreaterThan(5);
    expect(out.deliverables.pdf_report).toBe(true);
  });
});
