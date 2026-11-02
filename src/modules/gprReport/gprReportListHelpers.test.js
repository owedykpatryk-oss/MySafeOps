import { describe, expect, it } from "vitest";
import { blankGprReport } from "./gprReportConstants.js";
import { filterGprReports, groupGprReportsByProject, suggestDeliverableFlags } from "./gprReportListHelpers.js";
import { summarizeGprReportList } from "./gprReportHelpers.js";

describe("gprReportListHelpers", () => {
  const reports = [
    blankGprReport({ id: "a", ref: "GPR-2026-001", status: "draft", projectId: "p1", title: "Alpha" }),
    blankGprReport({ id: "b", ref: "GPR-2026-002", status: "final", projectId: "p1" }),
  ];

  it("filters by status and search", () => {
    expect(filterGprReports(reports, { status: "final" })).toHaveLength(1);
    expect(filterGprReports(reports, { search: "alpha" })).toHaveLength(1);
  });

  it("groups by project", () => {
    const groups = groupGprReportsByProject(reports, [{ id: "p1", name: "Site One" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reports).toHaveLength(2);
    expect(groups[0].projectName).toBe("Site One");
  });

  it("suggests deliverable flags from evidence", () => {
    const flags = suggestDeliverableFlags(
      blankGprReport({ radargrams: [{ id: "r1" }], planFigures: [{ id: "p1" }] })
    );
    expect(flags.radargram_figures).toBe(true);
    expect(flags.plan_layout_cad).toBe(true);
  });

  it("does not count deleted sync tombstones in list statistics", () => {
    const summary = summarizeGprReportList([
      ...reports,
      { id: "deleted", deletedAt: "2026-09-24T12:00:00.000Z", updatedAt: "2026-09-24T12:00:00.000Z" },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.finals).toBe(1);
  });
});
