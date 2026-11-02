import { it, expect } from "vitest";
import {
  manualReviewQueue,
  reviewTiming,
  compareManualRevision,
  appendManualChangeSummary,
  missingCompanyDetails,
} from "./manualAutomation.js";
import { updateManual } from "./companyManual.js";
const now = Date.parse("2026-10-30T12:00:00Z");
const base = {
  id: "v1",
  regionCode: "au",
  aircraftKind: "drone",
  version: "1.0",
  approvedAt: "2026-01-01",
  reviewDue: "2026-10-29",
  company: { name: "Recorded company" },
  sections: { operator: "Actual procedure" },
};
it("identifies overdue, upcoming and invalid dates without interpreting a draft as reviewed", () => {
  expect(reviewTiming(base, now).status).toBe("overdue");
  expect(reviewTiming({ ...base, reviewDue: "2026-10-30" }, now).status).toBe("due-soon");
  expect(reviewTiming({ ...base, reviewDue: "2026-12-01" }, now).status).toBe("current");
  expect(reviewTiming({ ...base, reviewDue: "2026-02-30" }, now).status).toBe("date-missing");
  expect(reviewTiming({ ...base, approvedAt: null }, now).status).toBe("draft");
});
it("does not remind about superseded reviewed ancestors, but a draft replacement does not supersede", () => {
  const draft = { ...base, id: "v2", previousId: "v1", approvedAt: null };
  expect(manualReviewQueue([base, draft], now).find((r) => r.manual.id === "v1").status).toBe("overdue");
  const reviewed = { ...base, id: "v3", previousId: "v2", reviewDue: "2027-01-01" };
  expect(manualReviewQueue([base, draft, reviewed], now).find((r) => r.manual.id === "v1").status).toBe("superseded");
  expect(
    manualReviewQueue([base, { ...reviewed, regionCode: "uk" }], now).find((r) => r.manual.id === "v1").status
  ).toBe("overdue");
  expect(() => manualReviewQueue([{ ...base, previousId: "v1" }], now)).not.toThrow();
});
it("compares actual procedure and company changes without counting generated amendment text or review markers", () => {
  const next = {
    ...base,
    id: "v2",
    previousId: "v1",
    version: "2.0",
    changeNote: "Own record",
    approvedAt: null,
    sections: { ...base.sections, operator: "Updated procedure" },
    company: { ...base.company, phone: "01234" },
  };
  const comparison = compareManualRevision(next, base);
  expect(comparison.items.map((x) => x.key)).toEqual(expect.arrayContaining(["company.phone", "sections.operator"]));
  expect(comparison.items).toHaveLength(2);
  expect(compareManualRevision(next, { ...base, id: "wrong" })).toBeNull();
  expect(compareManualRevision(next, { ...base, regionCode: "uk" })).toBeNull();
  const note = appendManualChangeSummary(next, comparison);
  expect(note).toContain("Own record");
  expect(note).toContain("1.0");
  expect(appendManualChangeSummary({ ...next, changeNote: note }, comparison)).toBe(note);
});
it("fills only missing company fields and invalidates the operator chapter review", () => {
  const manual = {
    ...base,
    approvedAt: null,
    company: { name: "Recorded company", email: "" },
    sectionReviews: { operator: { by: "Owner", at: "2026-01-01" }, fleet: { by: "Owner", at: "2026-01-01" } },
  };
  const suggestions = missingCompanyDetails(manual, {
    name: "Different company",
    email: "qa@example.com",
    phone: "123",
    logo: "ignored",
  });
  expect(suggestions.map((x) => x.key)).toEqual(["email", "phone"]);
  const company = { ...manual.company, ...Object.fromEntries(suggestions.map((x) => [x.key, x.value])) };
  const updated = updateManual(manual, { company });
  expect(updated.company.name).toBe("Recorded company");
  expect(updated.sectionReviews.operator).toBeUndefined();
  expect(updated.sectionReviews.fleet).toBeDefined();
  expect(missingCompanyDetails({ ...manual, company: {} }, { name: "My Organisation" })).toEqual([]);
});
