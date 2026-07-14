import { describe, expect, it } from "vitest";
import {
  formatConditionalClause,
  summarizeConditionalRule,
} from "./permitConditionalRuleSummary";

describe("permitConditionalRuleSummary", () => {
  const catalogs = {
    permitTypes: { hot_work: { label: "Hot work" } },
    projects: [{ id: "p1", name: "Site A" }],
    fieldCatalog: [{ id: "fireWatch", label: "Fire watch" }],
  };

  it("summarises AND rules with human labels", () => {
    const summary = summarizeConditionalRule(
      {
        whenOperator: "and",
        whenClauses: [
          { field: "permitType", value: "hot_work" },
          { field: "status", value: "issued" },
        ],
        action: "required",
        thenField: "fireWatch",
      },
      catalogs
    );
    expect(summary).toContain("Hot work");
    expect(summary).toContain("Active on site");
    expect(summary).toContain("Require field");
    expect(summary).toContain("Fire watch");
  });

  it("formats empty clause as any", () => {
    expect(formatConditionalClause({ field: "projectId", value: "" }, catalogs)).toBe("Any project");
  });

  it("uses project name when available", () => {
    expect(formatConditionalClause({ field: "projectId", value: "p1" }, catalogs)).toBe("Project is Site A");
  });
});
