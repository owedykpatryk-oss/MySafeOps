import { it, expect } from "vitest";
import { validateDroneWrite } from "../../../shared/droneStorageGuard.mjs";
import { createCompanyManual } from "./companyManual.js";
import { manualSections } from "./droneRegions.js";
it("requires company-manual completeness at the server review boundary", () => {
  const m = createCompanyManual({}, { name: "Actor", id: "actor" }, "uk");
  m.scope = "QA scope";
  m.approvedAt = new Date().toISOString();
  m.approvedUserId = "actor";
  for (const section of manualSections(m)) m.sections[section.id] = "QA procedure";
  expect(validateDroneWrite("drone_manuals", [], [m], "actor")).toBe("incomplete_manual_review");
});
it("refuses modification or removal of historical issued snapshots", () => {
  const previous = [{ id: "m", issues: [{ id: "issue", snapshot: { title: "Original" } }] }];
  expect(validateDroneWrite("drone_missions", previous, [{ id: "m", issues: [] }], "actor")).toBe(
    "issued_pack_is_immutable"
  );
  expect(validateDroneWrite("drone_missions", previous, [], "actor")).toBe("issued_pack_is_immutable");
  expect(
    validateDroneWrite(
      "drone_missions",
      previous,
      [{ id: "m", issues: [{ id: "issue", snapshot: { title: "Changed" } }] }],
      "actor"
    )
  ).toBe("issued_pack_is_immutable");
});
it("refuses editing a reviewed manual version", () => {
  const previous = [{ id: "manual", title: "v1", approvedAt: "2026-10-29" }];
  expect(validateDroneWrite("drone_manuals", previous, [{ ...previous[0], title: "Changed" }], "actor")).toBe(
    "reviewed_manual_is_immutable"
  );
});
it("rejects forged approval identity and duplicate row ids", () => {
  expect(
    validateDroneWrite("drone_missions", [], [{ id: "m", approval: { userId: "another" }, issues: [] }], "actor")
  ).toBe("invalid_approval_actor");
  expect(validateDroneWrite("drone_missions", [], [{ id: "m" }, { id: "m" }], "actor")).toBe("invalid_drone_rows");
});
