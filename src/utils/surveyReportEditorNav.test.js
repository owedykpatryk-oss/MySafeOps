import { describe, expect, it } from "vitest";
import { groupSurveyReportsByProject } from "../modules/surveyReport/surveyReportEditorNav";

describe("surveyReportEditorNav", () => {
  it("groups reports by project label", () => {
    const groups = groupSurveyReportsByProject(
      [
        { id: "r1", projectId: "p1", title: "A" },
        { id: "r2", projectId: "p2", title: "B" },
        { id: "r3", projectId: "p1", title: "C" },
      ],
      [{ id: "p1", name: "Alpha" }, { id: "p2", name: "Beta" }]
    );
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.projectId === "p1")?.reports).toHaveLength(2);
  });
});
