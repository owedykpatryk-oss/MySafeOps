import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import { buildRevisionTimeline } from "./surveyReportRevision";

describe("surveyReportRevision", () => {
  it("builds timeline with parent and changes", () => {
    const parent = blankSurveyReport({
      id: "p1",
      ref: "SR-2026-001",
      title: "Issue A",
      status: "final",
      documentControl: { revision: "A", issueDate: "2026-01-10" },
    });
    const child = blankSurveyReport({
      id: "c1",
      parentReportId: "p1",
      parentRevision: "A",
      documentControl: { revision: "B" },
      changesSincePrevious: [{ field: "Findings", before: "Old", after: "New" }],
    });
    const { timeline, changes, parentReportId } = buildRevisionTimeline(child, [parent, child]);
    expect(parentReportId).toBe("p1");
    expect(timeline.some((t) => t.id === "p1")).toBe(true);
    expect(changes).toHaveLength(1);
  });
});
