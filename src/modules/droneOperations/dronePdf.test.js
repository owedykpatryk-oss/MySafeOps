import { it, expect } from "vitest";
import { packSections, packMapGeometry } from "./dronePdf.js";
it("exports historical evidence from the issue, including pending checks and the draft label", () => {
  const issue = {
    kind: "draft",
    issuedAt: "2026-10-29T10:00:00Z",
    snapshot: {
      id: "test",
      revision: 4,
      title: "Survey",
      evidence: [
        {
          kind: "airspace",
          result: "action_required",
          note: "FRZ permission outstanding",
          checkedAt: "2026-10-29T09:00Z",
          source: "NATS AIS",
        },
      ],
      nextActions: [{ text: "Review weather" }],
      checklistDefinitions: [{ id: "site", stage: "Site arrival" }],
    },
  };
  const text = packSections(issue)
    .map((s) => s.join("\n"))
    .join("\n");
  expect(text).toContain("DRAFT");
  expect(text).toContain("FRZ permission outstanding");
  expect(text).toContain("Review weather");
  expect(text).toContain("Pending");
  expect(text).not.toContain("CAA approved");
});
it("retains launch coordinates even when outside all polygons", () => {
  const m = {
    takeoff: [-3, 50],
    boundary: {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-1, 51] } }],
    },
  };
  expect(packMapGeometry(m).features.some((f) => f.geometry.type === "Point" && f.geometry.coordinates[0] === -3)).toBe(
    true
  );
  expect(packSections({ kind: "draft", snapshot: m }).flat().join("\n")).toContain("-3, 50");
});
