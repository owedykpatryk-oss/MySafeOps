import { describe, it, expect } from "vitest";
import {
  flattenDailyBriefingRow,
  flattenCdmPackRow,
  prepareRegisterExport,
  REGISTER_PDF_ADAPTERS,
} from "./registerPdfAdapters";

describe("registerPdfAdapters", () => {
  it("flattens daily briefing nested attendees and topics", () => {
    const row = flattenDailyBriefingRow({
      location: "Block A",
      date: "2026-06-28",
      time: "07:30",
      conductedBy: "Site manager",
      topics: ["PPE", "Evacuation"],
      attendees: [
        { name: "A", present: true, sig: "data:image/png;base64,x" },
        { name: "B", present: true, sig: null },
        { name: "C", present: false, sig: null },
      ],
    });
    expect(row.present).toBe(2);
    expect(row.signed).toBe(1);
    expect(row.topicsSummary).toContain("PPE");
    expect(row.topicsSummary).not.toContain("[object Object]");
  });

  it("uses summary table mode for section bundles", () => {
    const prepared = prepareRegisterExport(
      "daily-briefing",
      [{ location: "X", date: "2026-01-01", attendees: [] }],
      { summary: true },
    );
    expect(prepared.mode).toBe("table");
    expect(prepared.columns).toEqual(REGISTER_PDF_ADAPTERS["daily-briefing"].columns);
  });

  it("uses detail mode for single-module daily briefing export", () => {
    const prepared = prepareRegisterExport("daily-briefing", [{ id: "b1" }], { summary: false });
    expect(prepared.mode).toBe("detail");
    expect(prepared.rows).toHaveLength(1);
  });

  it("flattens CDM projectTitle from pack", () => {
    const row = flattenCdmPackRow({
      projectTitle: "Refurb 12",
      clientName: "Client Ltd",
      dutyholderChecks: { a: true, b: true },
      status: "draft",
    });
    expect(row.projectTitle).toBe("Refurb 12");
    expect(row.cdmChecks).toBe("2/10");
  });
});
