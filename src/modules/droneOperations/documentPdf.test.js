import { it, expect } from "vitest";
import { preparationSections, packSections } from "./dronePdf.js";
it("exports attributed excerpts and context reviews without claiming approval", () => {
  const issue = {
    kind: "draft",
    issuedAt: "2026-10-29",
    snapshot: {
      id: "test",
      revision: 1,
      title: "QA",
      timeZone: "Europe/London",
      workContexts: ["remote"],
      checklistDefinitions: [
        { id: "context-remote", stage: "Remote site", text: "Check contact arrangements", phase: "planning" },
      ],
      checklist: { "context-remote": { note: "QA satellite contact", status: "pending" } },
      sourceFacts: [
        {
          field: "operatorId",
          value: "QA",
          quote: "Operator ID: QA",
          sourceName: "operator.txt",
          hash: "a".repeat(64),
          by: "Lead",
          at: "2026-10-29",
          page: 1,
        },
      ],
      fieldOrigins: { client: { source: "Project: QA", value: "Client", by: "Lead", at: "2026-10-29" } },
      client: "Client",
      nextActions: [{ text: "Record missing evidence" }],
    },
  };
  const full = packSections(issue).flat().join("\n");
  expect(full).toContain("Operator ID: QA");
  expect(full).toContain("Project: QA");
  const briefing = preparationSections(issue, "briefing").flat().join("\n");
  expect(briefing).toContain("Record missing evidence");
  expect(briefing).toContain("QA satellite contact");
  expect(briefing).toContain("DRAFT");
  expect(() => preparationSections(issue, "unknown")).toThrow();
});
