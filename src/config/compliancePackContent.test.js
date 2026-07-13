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

  it("assesses AU notification with compatible shape", () => {
    const result = assessComplianceNotification({ estimatedWorkers: 25 }, "au");
    expect(result.notifiable).toBe(true);
    expect(Array.isArray(result.reasons)).toBe(true);
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
});
