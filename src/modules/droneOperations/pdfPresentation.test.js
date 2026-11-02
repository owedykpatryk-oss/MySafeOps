import { it, expect } from "vitest";
import { checklistGroups, focusedSections } from "./pdfPresentation.js";
import { packMapGeometry, packSections } from "./dronePdf.js";
it("exports distinct landing points and the chosen snapshot journal in full and field documents", () => {
  const m = {
    id: "m",
    revision: 4,
    title: "Field test",
    takeoff: [115, -31],
    landing: [115.1, -31],
    alternateLanding: [115.2, -31],
    fieldJournal: [
      { type: "pause", by: "Test lead", at: "2026-10-29T10:00:00Z", missionRevision: 4, note: "Weather review" },
    ],
  };
  const issue = { snapshot: m, kind: "draft", issuedAt: "2026-10-29T12:00:00Z" };
  expect(packMapGeometry(m).features.map((f) => f.geometry.coordinates)).toEqual([
    m.takeoff,
    m.landing,
    m.alternateLanding,
  ]);
  for (const sections of [packSections(issue), focusedSections(issue, "field")]) {
    const text = sections.flat().join("\n");
    expect(text).toContain("Weather review");
    expect(text).toContain("Test lead");
    expect(text).toContain("115.2, -31");
    expect(text).toContain("not a flight log");
  }
  expect(
    packSections({ ...issue, snapshot: { ...m, fieldJournal: [] } })
      .flat()
      .join("\n")
  ).not.toContain("Weather review");
});
const snapshot = {
  id: "m",
  title: "Test",
  revision: 7,
  aircraftKind: "helicopter",
  regionCode: "au",
  checklistDefinitions: [
    {
      id: "p",
      phase: "planning",
      stage: "Operator coordination",
      text: "Confirm the task",
      role: "Operator",
      version: "v1",
      source: { title: "Operator procedure" },
    },
    { id: "s", phase: "site", stage: "Site access", text: "Confirm access", role: "Survey lead" },
    { id: "f", phase: "flight", stage: "Monitor", text: "Monitor conditions", role: "Pilot" },
  ],
  checklist: {
    p: { status: "done", by: "Alex", at: "2026-10-29T10:00:00Z", note: "Task agreed" },
    s: { status: "done" },
  },
  emergency: "Call the site contact",
  helicopter: { communications: "Agreed STOP call" },
  nextActions: [{ text: "Review weather" }],
};
it("groups by phase and never presents unattributed checks as recorded", () => {
  const groups = checklistGroups(snapshot);
  expect(groups.map((g) => g.phase)).toEqual(["planning", "site", "flight"]);
  expect(groups[0].items[0]).toMatchObject({ status: "Review recorded", role: "Operator" });
  expect(groups[0].items[0].detail).toContain("Operator procedure");
  expect(groups[1].items[0].status).toBe("Review needed");
  expect(groups[2].items[0].status).toBe("Review needed");
});
it("assembles field and operator sheets without changing the mission or claiming flight approval", () => {
  const issue = { kind: "approved", snapshot, issuedAt: "2026-10-29" },
    before = JSON.stringify(issue);
  const field = focusedSections(issue, "field");
  expect(field.flat().join("\n")).toContain("Call the site contact");
  expect(field.flat().join("\n")).toContain("Agreed STOP call");
  expect(field.flat().join("\n")).toContain("Review weather");
  expect(field.flat().join("\n")).toContain("DRAFT");
  const operator = focusedSections(issue, "operator");
  expect(operator.flat().join("\n")).toContain("does not replace");
  expect(JSON.stringify(issue)).toBe(before);
  expect(() => focusedSections(issue, "unknown")).toThrow();
});
