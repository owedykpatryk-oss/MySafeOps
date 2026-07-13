import { describe, expect, it } from "vitest";
import { blankGprReport } from "./gprReportConstants.js";
import { gprDeliverableProgress, gprEvidenceStats } from "./gprReportPulse.js";

describe("gprReportPulse", () => {
  it("counts deliverable checklist progress", () => {
    const del = gprDeliverableProgress({ pdf_report: true, radargram_figures: true });
    expect(del.done).toBe(2);
    expect(del.pct).toBeGreaterThan(0);
  });

  it("summarises evidence stats", () => {
    const stats = gprEvidenceStats(
      blankGprReport({
        radargrams: [{ id: "1", dataUrl: "x" }],
        scanPanels: [{ id: "p1" }, { id: "p2" }],
        anomalies: [{ id: "a1" }],
      })
    );
    expect(stats.radargrams).toBe(1);
    expect(stats.panels).toBe(2);
    expect(stats.totalEvidence).toBe(3);
  });
});
