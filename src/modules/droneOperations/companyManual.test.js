import { it, expect } from "vitest";
import {
  createCompanyManual,
  manualReview,
  manualOutline,
  updateManual,
  saveManualRows,
  manualControlRows,
} from "./companyManual.js";
import { manualSections } from "./droneRegions.js";
const actor = { name: "QA owner", id: "qa" };
const at = "2026-10-29T12:00:00.000Z";
function complete() {
  const manual = createCompanyManual({ name: "Example Survey", address: "Fictional address" }, actor, "au", null, at);
  manual.scope = "Survey coordination";
  manual.documentCode = "OM-001";
  manual.reviewDue = "2027-01-01";
  for (const s of manualSections(manual)) {
    manual.sections[s.id] = "Company-specific procedure supplied for QA.";
    manual.sectionReviews[s.id] = { by: actor.name, at };
  }
  return manual;
}
it("creates company drafts and revisions without carrying signatures", () => {
  const first = complete();
  expect(first.company.name).toBe("Example Survey");
  const next = createCompanyManual({}, actor, "au", { ...first, approvedAt: at, approvedBy: "Old" }, at);
  expect(next.id).not.toBe(first.id);
  expect(next.previousId).toBe(first.id);
  expect(next.company).toEqual(first.company);
  expect(next.sections).toEqual(first.sections);
  expect(next.sectionReviews).toEqual({});
  expect(next.approvedAt).toBeUndefined();
  next.sections.operator = "Changed";
  expect(first.sections.operator).not.toBe("Changed");
});
it("distinguishes text completion from review and rejects placeholders and impossible review dates", () => {
  const m = complete();
  expect(manualReview(m, at).issues).toEqual([]);
  const outlined = manualOutline({ ...m, sections: {}, sectionReviews: {} });
  expect(manualReview({ ...m, ...outlined }, at).issues.length).toBeGreaterThan(0);
  expect(outlined.sections.operator).toContain("[TO COMPLETE:");
  expect(manualOutline(m).sections.operator).toBe(m.sections.operator);
  for (const reviewDue of ["2026-02-30", "2026-01-01", ""])
    expect(manualReview({ ...m, reviewDue }, at).issues).toContainEqual(expect.objectContaining({ key: "reviewDue" }));
  expect(manualReview({ ...m, sectionReviews: {} }, at).reviewed).toBe(0);
});
it("invalidates edited chapter review and never edits a locked version", () => {
  const m = complete();
  const changed = updateManual(m, { sections: { ...m.sections, operator: "Changed procedure" } }, at);
  expect(changed.sectionReviews.operator).toBeUndefined();
  expect(changed.sectionReviews.people).toBeDefined();
  expect(() => updateManual({ ...m, approvedAt: at }, { title: "Overwrite" }, at)).toThrow(/locked/i);
});
it("rejects stale saves, duplicate creation and locked overwrite without changing rows", () => {
  const m = complete();
  const rows = [m];
  const changed = updateManual(m, { title: "New title" }, at);
  expect(saveManualRows(rows, changed, m)[0].title).toBe("New title");
  expect(() => saveManualRows([{ ...m, title: "Other change" }], changed, m)).toThrow(/changed/i);
  expect(() => saveManualRows(rows, changed, null)).toThrow();
  expect(() => saveManualRows([{ ...m, approvedAt: at }], changed, { ...m, approvedAt: at })).toThrow(/locked/i);
  expect(rows[0].title).toBe(m.title);
});
it("requires company identity for new review and includes full control details", () => {
  const m = complete();
  expect(manualReview({ ...m, company: { name: "" } }, at).issues).toContainEqual(
    expect.objectContaining({ key: "company" })
  );
  expect(manualControlRows(m).flat().join(" ")).toContain("Example Survey");
  expect(manualControlRows(m).flat().join(" ")).toContain("OM-001");
});
