import { manualSections, regionOf, kindOf } from "./droneRegions.js";

const clean = (value) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
const sameScope = (a, b) => regionOf(a) === regionOf(b) && kindOf(a) === kindOf(b);
const companyFields = {
  name: "Company legal name",
  address: "Company address",
  registrationNo: "Registration / ABN",
  email: "Company email",
  phone: "Company phone",
};
export function reviewTiming(manual, now = Date.now()) {
  if (!manual.approvedAt) return { status: "draft", label: "Working draft" };
  const date = clean(manual.reviewDue),
    end = Date.parse(`${date}T23:59:59.999Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== date)
    return { status: "date-missing", label: "Review date required" };
  if (end < now) return { status: "overdue", label: `Review overdue · ${date}` };
  if (end - now <= 30 * 86400000) return { status: "due-soon", label: `Review due soon · ${date}` };
  return { status: "current", label: `Next review · ${date}` };
}
export function manualReviewQueue(manuals, now = Date.now()) {
  const byId = new Map(manuals.map((m) => [m.id, m])),
    superseded = new Set();
  for (const m of manuals.filter((m) => m.approvedAt)) {
    const seen = new Set([m.id]);
    let id = m.previousId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const prior = byId.get(id);
      if (!prior || !sameScope(m, prior)) break;
      superseded.add(id);
      id = prior.previousId;
    }
  }
  const rank = { overdue: 0, "date-missing": 1, "due-soon": 2, draft: 3, current: 4, superseded: 5 };
  return manuals
    .map((manual) => ({
      manual,
      ...(superseded.has(manual.id)
        ? { status: "superseded", label: "Superseded by a reviewed revision" }
        : reviewTiming(manual, now)),
    }))
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        clean(a.manual.reviewDue).localeCompare(clean(b.manual.reviewDue)) ||
        clean(a.manual.title).localeCompare(clean(b.manual.title))
    );
}
export function missingCompanyDetails(manual, org) {
  return Object.entries(companyFields).flatMap(([key, label]) => {
    const value = clean(org?.[key]);
    return !clean(manual.company?.[key]) && value && !(key === "name" && value === "My Organisation")
      ? [{ key, label, value }]
      : [];
  });
}
export function compareManualRevision(manual, previous) {
  if (!previous?.approvedAt || previous.id !== manual.previousId || !sameScope(manual, previous)) return null;
  const fields = {
    title: "Manual title",
    scope: "Operating scope",
    documentCode: "Document code",
    documentOwner: "Document owner",
    accountableManager: "Accountable manager",
    reviewDue: "Next review date",
    distribution: "Controlled distribution",
    references: "Supporting documents and references",
  };
  const items = [];
  for (const [key, label] of Object.entries(fields))
    if (clean(manual[key]) !== clean(previous[key])) items.push({ key, label });
  for (const [key, label] of Object.entries(companyFields))
    if (clean(manual.company?.[key]) !== clean(previous.company?.[key])) items.push({ key: `company.${key}`, label });
  for (const section of manualSections(manual))
    if (clean(manual.sections?.[section.id]) !== clean(previous.sections?.[section.id]))
      items.push({ key: `sections.${section.id}`, label: section.title });
  return { baseId: previous.id, baseVersion: previous.version, items };
}
export function appendManualChangeSummary(manual, comparison) {
  const existing = clean(manual.changeNote);
  if (!comparison?.items.length) return existing;
  const summary = `Changes detected from version ${comparison.baseVersion}:\n${comparison.items.map((item) => `- ${item.label}`).join("\n")}`;
  return existing.includes(summary) ? existing : [existing, summary].filter(Boolean).join("\n\n");
}
