import { it, expect } from "vitest";
import {
  reuseConflicts,
  resolveReuseConflict,
  extractExpiryCandidates,
  acceptCandidates,
  automationActions,
} from "./documentAutomation.js";
const mission = {
  regionCode: "au",
  aircraftKind: "helicopter",
  projectId: "p",
  client: "Old client",
  fieldOrigins: { client: { sourceId: "p", source: "Project: Site", value: "Old client" } },
};
const context = { projects: [{ id: "p", name: "Site", client: "New client" }] };
it("requires a deliberate decision on stale reused values and preserves manual edits", () => {
  expect(reuseConflicts(mission, context)[0]).toMatchObject({ field: "client", value: "New client" });
  expect(automationActions(mission, Date.now(), context).some((a) => a.key === "document-reuse")).toBe(true);
  expect(resolveReuseConflict(mission, "client", "update", context, "Lead").client).toBe("New client");
  expect(resolveReuseConflict(mission, "client", "manual", context, "Lead").fieldOrigins).toEqual({});
  expect(reuseConflicts({ ...mission, client: "Typed client" }, context)).toEqual([]);
  expect(reuseConflicts(mission, { projects: [] })[0].available).toBe(false);
  expect(() => resolveReuseConflict(mission, "client", "update", { projects: [] }, "Lead")).toThrow();
});
it("requires review when a different project happens to have the same copied value", () => {
  expect(
    reuseConflicts({ ...mission, projectId: "other" }, { projects: [{ id: "other", client: "Old client" }] })
  ).toHaveLength(1);
});
it("extracts only explicit real ISO expiry dates and keeps conflicting candidates separate", () => {
  const dates = extractExpiryCandidates([
    {
      page: 2,
      text: "Valid until: 2027-02-28\nExpiry date: 2027-02-30\nExpiry date: 02/03/2027\nDocument expiry: 2027-12-01",
    },
  ]);
  expect(dates.map((d) => d.date)).toEqual(["2027-02-28", "2027-12-01"]);
  expect(dates[0].quote).toBe("Valid until: 2027-02-28");
});
it("applies reviewed fields in one patch and rejects conflicting candidates", () => {
  const source = {
    name: "Operator.txt",
    hash: "a".repeat(64),
    expiresOn: "2027-02-28",
    expiryEvidence: { date: "2027-02-28", quote: "Valid until: 2027-02-28", page: 2 },
  };
  const candidates = [
    { field: "helicopter.operatorName", value: "QA Air", quote: "Operator name: QA Air", page: 1 },
    { field: "helicopter.aircraftRegistration", value: "VH-QAT", quote: "Aircraft registration: VH-QAT", page: 1 },
  ];
  const patch = acceptCandidates(mission, source, candidates, "Lead");
  expect(patch.helicopter).toMatchObject({ operatorName: "QA Air", aircraftRegistration: "VH-QAT" });
  expect(patch.sourceFacts).toHaveLength(2);
  expect(patch.sourceFacts[0].expiryEvidence).toEqual(source.expiryEvidence);
  expect(patch.approval).toBeUndefined();
  expect(() =>
    acceptCandidates(
      mission,
      source,
      [...candidates, { ...candidates[0], value: "Other", quote: "Operator name: Other" }],
      "Lead"
    )
  ).toThrow(/one value/i);
});
