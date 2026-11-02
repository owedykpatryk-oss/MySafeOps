import { describe, expect, it } from "vitest";
import { blankGprReport, GPR_EQUIPMENT_PRESETS } from "./gprReportConstants.js";
import { buildLimitationsFromKeys, gprReportQuality, nextGprRef, normalizeGprReport, buildAnomaliesGeoJson, buildDuplicateGprPayload, autoNumberAnomalies, upsertGprReportInList } from "./gprReportHelpers.js";
import { suggestGprLimitationKeys } from "./gprReportSmart.js";
import { buildGprBlockers } from "./gprReportBlockers.js";
import { applyIndustryGprTemplate } from "./gprReportTemplateContext.js";

describe("gprReportHelpers", () => {
  it("offers current utility and 3D-array equipment presets with unique keys", () => {
    const byKey = Object.fromEntries(GPR_EQUIPMENT_PRESETS.map((preset) => [preset.key, preset]));
    expect(Object.keys(byKey)).toHaveLength(GPR_EQUIPMENT_PRESETS.length);
    expect(byKey.ids_stream_dp).toMatchObject({ antennaFrequencyMhz: 600, channels: 30 });
    expect(byKey.impulse_pinpointr).toMatchObject({ antennaFrequencyMhz: 400, channels: 2 });
    expect(byKey.impulse_raptor).toMatchObject({ model: "Raptor-45", antennaFrequencyMhz: 450, channels: 8 });
    expect(byKey.mala_mira_hdr).toMatchObject({ antennaFrequencyMhz: 500, channels: 132 });
    expect(byKey.proceq_gp8100).toMatchObject({
      model: "GP8100",
      frequencyRangeMhz: "400–4000",
      channels: 6,
    });
    expect(byKey.proceq_gp8100.imageUrls).toHaveLength(2);
  });

  it("normalizes legacy partial report", () => {
    const r = normalizeGprReport({ ref: "GPR-2026-001" });
    expect(r.equipment.length).toBeGreaterThan(0);
    expect(r.acquisition.scanMode).toBe("grid");
    expect(r.preSurvey.objectives).toEqual([]);
    expect(r.preSurvey.siteChecks.ramsBriefed).toBe(false);
    expect(r.includeGeology).toBe(false);
    expect(r.includeHistoricalEvidence).toBe(false);
  });

  it("keeps desk-study choices optional and preserves legacy evidence", () => {
    const draft = blankGprReport({ groundConditions: { fetchedAt: "2026-01-01" } });
    expect(gprReportQuality(draft).missing).not.toContain("BGS ground data");
    expect(gprReportQuality({ ...draft, includeGeology: true }).missing).not.toContain("BGS ground data");
    expect(normalizeGprReport({ groundConditions: { fetchedAt: "2026-01-01" }, historicalEvidence: [{ id: "old" }] }))
      .toMatchObject({ includeGeology: true, includeHistoricalEvidence: true });
    expect(normalizeGprReport({ ...draft, includeGeology: false }).includeGeology).toBe(false);
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

  it("keeps weather optional in quality scoring and issue checks", () => {
    const report = blankGprReport({ preSurvey: { surveySetting: "indoor", levelBelow: "yes" } });
    expect(gprReportQuality(report).missing).not.toContain("Weather / environment");
    expect(buildGprBlockers(report).blockers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Weather / environment" })]),
    );
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

  it("upserts an open editor report into the list without duplicating", () => {
    const a = blankGprReport({ id: "gpr_1", ref: "GPR-1" });
    const b = { ...a, title: "Site A" };
    const once = upsertGprReportInList([], b);
    const twice = upsertGprReportInList(once, { ...b, title: "Site A updated" });
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twice[0].title).toBe("Site A updated");
  });
});

describe("gprReportSmart limitations", () => {
  it("suggests clay attenuation limitation", () => {
    const report = blankGprReport({
      includeGeology: true,
      groundConditions: { attenuationClass: "high", materialClass: "clay_silt" },
    });
    const keys = suggestGprLimitationKeys(report);
    expect(keys).toContain("attenuation_clay");
    expect(keys).toContain("velocity_uncertainty");
  });

  it("does not turn outdoor rain into an indoor limitation, but keeps observed slab moisture", () => {
    const report = blankGprReport({
      preSurvey: { surveySetting: "indoor" },
      environmental: { rainDuringSurvey: "heavy" },
      groundConditions: { siteObservations: { moisture: "dry" } },
    });
    expect(suggestGprLimitationKeys(report)).not.toContain("weather_moisture");
    expect(suggestGprLimitationKeys({
      ...report,
      groundConditions: { siteObservations: { moisture: "wet" } },
    })).toContain("surface_moisture");
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
