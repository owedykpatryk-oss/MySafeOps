import { describe, expect, it } from "vitest";
import { assessComplianceNotification, getCompliancePackContent } from "./compliancePackContent";
import { getNotifiableIncidentsContent, defaultIncidentTypeKey } from "./notifiableIncidentsContent";

describe("compliancePackContent", () => {
  it("returns UK CDM content by default", () => {
    const pack = getCompliancePackContent("uk");
    expect(pack.moduleId).toBe("cdm");
    expect(pack.planFull).toMatch(/Construction Phase Plan/);
  });

  it("returns AU WHS content for au market", () => {
    const pack = getCompliancePackContent("au");
    expect(pack.moduleId).toBe("whs-plan");
    expect(pack.viewIds).toContain("whs-plan");
  });

  it("returns PL BHP content for pl market", () => {
    const pack = getCompliancePackContent("pl");
    expect(pack.moduleId).toBe("bhp-plan");
    expect(pack.locale).toBe("pl-PL");
  });

  it("returns DE SiGe content for de market", () => {
    const pack = getCompliancePackContent("de");
    expect(pack.moduleId).toBe("sige-plan");
    expect(pack.locale).toBe("de-DE");
    expect(pack.planFull).toMatch(/Sicherheits- und Gesundheitsschutzplan/);
    expect(pack.planSections.some((s) => s.key === "anhangII")).toBe(true);
    expect(pack.dutyholderChecks.some((c) => c.k === "anhangIIMapped")).toBe(true);
  });

  it("returns AT BauKG SiGe content for at market", () => {
    const pack = getCompliancePackContent("at");
    expect(pack.moduleId).toBe("sige-plan");
    expect(pack.locale).toBe("de-AT");
    expect(pack.title).toMatch(/BauKG/);
    expect(pack.notificationTitle).toMatch(/BauKG/);
  });

  it("returns CH SiKo content for ch market", () => {
    const pack = getCompliancePackContent("ch");
    expect(pack.moduleId).toBe("sige-plan");
    expect(pack.locale).toBe("de-CH");
    expect(pack.title).toMatch(/BauAV/);
    expect(pack.notificationTitle).toMatch(/SiKo/);
    expect(pack.dutyholders).toContain("Bauleitung");
  });

  it("CH notification framing states SiKo applies regardless of threshold", () => {
    const pack = getCompliancePackContent("ch");
    expect(pack.notificationTitle).not.toMatch(/Vorankündigung/);
    expect(pack.notificationBody).toMatch(/Baubeginn/);
    expect(pack.notificationBody).toMatch(/keine Meldeschwelle/);
  });

  it("assesses AU notification with compatible shape", () => {
    const result = assessComplianceNotification({ estimatedWorkers: 25 }, "au");
    expect(result.notifiable).toBe(true);
    expect(Array.isArray(result.reasons)).toBe(true);
  });

  it("uses the combined Polish duration/headcount threshold", () => {
    expect(assessComplianceNotification({ estimatedWorkers: 25, calendarPhaseDays: 10 }, "pl").notifiable).toBe(false);
    expect(assessComplianceNotification({ estimatedWorkers: 11, calendarPhaseDays: 31 }, "pl").notifiable).toBe(false);
    expect(assessComplianceNotification({ estimatedWorkers: 20, calendarPhaseDays: 31 }, "pl").notifiable).toBe(true);
  });

  it("requires more than 500 person-days in PL, DE and AT", () => {
    for (const marketId of ["pl", "de", "at"]) {
      expect(assessComplianceNotification({ estimatedPersonDays: 500 }, marketId).notifiable).toBe(false);
      expect(assessComplianceNotification({ estimatedPersonDays: 501 }, marketId).notifiable).toBe(true);
    }
  });
});

describe("notifiableIncidentsContent", () => {
  it("returns RIDDOR types for UK", () => {
    const content = getNotifiableIncidentsContent("uk");
    expect(content.moduleId).toBe("riddor");
    expect(content.types.specified).toBeDefined();
  });

  it("returns AU notifiable incident types", () => {
    const content = getNotifiableIncidentsContent("au");
    expect(content.moduleId).toBe("notifiable-incidents");
    expect(content.types.serious_injury).toBeDefined();
    expect(defaultIncidentTypeKey("au")).toBe("serious_injury");
  });

  it("returns PL PIP-oriented incident types", () => {
    const content = getNotifiableIncidentsContent("pl");
    expect(content.regulatorName).toMatch(/Inspekcja Pracy/);
    expect(defaultIncidentTypeKey("pl")).toBe("serious_injury");
  });

  it("returns DE BG-oriented incident types", () => {
    const content = getNotifiableIncidentsContent("de");
    expect(content.regulatorName).toMatch(/BG BAU/);
    expect(defaultIncidentTypeKey("de")).toBe("serious_injury");
  });

  it("returns AT AUVA-oriented incident types", () => {
    const content = getNotifiableIncidentsContent("at");
    expect(content.regulatorName).toMatch(/AUVA/);
    expect(defaultIncidentTypeKey("at")).toBe("serious_injury");
  });

  it("returns CH Suva-oriented incident types", () => {
    const content = getNotifiableIncidentsContent("ch");
    expect(content.regulatorName).toMatch(/Suva/);
    expect(defaultIncidentTypeKey("ch")).toBe("serious_injury");
  });
});
