import { it, expect, vi } from "vitest";
vi.mock("../../utils/pdfBranding.js", () => ({
  ensurePdfUnicodeFont: async () => {},
  setPdfFont: (pdf, style) => pdf.setFont("helvetica", style),
  tryAddLogo: () => 0,
}));
import { createCompanyManualPdf } from "./dronePdf.js";
import { createCompanyManual } from "./companyManual.js";
it("includes the review deadline warning and the revision comparison frozen in the record", async () => {
  const m = createCompanyManual({ name: "QA company" }, { name: "QA owner" }, "uk");
  Object.assign(m, {
    approvedAt: "2020-01-01",
    reviewDue: "2020-02-01",
    previousId: "old",
    amendmentComparison: {
      baseId: "old",
      baseVersion: "QA-BASE",
      items: [{ key: "sections.normal", label: "QA CHANGED PROCEDURE" }],
    },
  });
  const output = (await createCompanyManualPdf(m, {})).output();
  expect(output).toContain("Review overdue");
  expect(output).toContain("QA-BASE");
  expect(output).toContain("QA CHANGED PROCEDURE");
});
it("renders a company cover, control register, procedure text and linked contents without mission wording", async () => {
  const m = createCompanyManual(
    { name: "Example Survey Company" },
    { name: "QA owner" },
    "au",
    null,
    "2026-10-29T12:00:00Z"
  );
  m.documentCode = "OM-EXAMPLE";
  m.scope = "Synthetic coordination scope";
  m.references = "Manufacturer manual: example reference";
  m.distribution = "Example survey team";
  m.sections.operator = "UNIQUE COMPANY POLICY";
  m.sections.emergency = Array.from({ length: 160 }, (_, i) => `Emergency example line ${i}`).join("\n");
  const pdf = await createCompanyManualPdf(m, {});
  const output = pdf.output();
  for (const text of [
    "Example Survey Company",
    "OM-EXAMPLE",
    "UNIQUE COMPANY POLICY",
    "Emergency example line 159",
    "Controlled distribution",
    "Source references",
  ])
    expect(output).toContain(text);
  expect(output).toContain("/Subtype /Link");
  expect(output).toContain("/Outlines");
  expect(output).not.toContain("listed open action(s)");
  expect(output).not.toContain("Survey mission");
  expect(pdf.getNumberOfPages()).toBeGreaterThan(4);
});
