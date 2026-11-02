import { it, expect, vi } from "vitest";
vi.mock("../../utils/pdfBranding.js", () => ({
  ensurePdfUnicodeFont: async () => {},
  setPdfFont: (pdf, style) => pdf.setFont("helvetica", style),
  tryAddLogo: () => 0,
}));
import { createReportDocument } from "./pdfLayout.js";
it("starts an oversized custom heading on the available page without inserting empty pages", async () => {
  const doc = await createReportDocument("Survey pack", {}, "AIR-test", "DRAFT", "2026-10-29");
  doc.section("Custom inspection name ".repeat(500), "Final safety note.");
  expect(doc.entries[0].page).toBe(1);
  expect(doc.finish().output()).toContain("Final safety note.");
});
it("bounds displayed contents labels while retaining the complete custom title in the body", async () => {
  const doc = await createReportDocument("Survey pack", {}, "AIR-test", "DRAFT", "2026-10-29");
  doc.contents();
  doc.startBody();
  const title = Array.from(
    { length: 150 },
    (_, i) => `CHECK${i} A detailed organisation-specific inspection description`
  ).join(" ");
  doc.checklists([
    { title: "Planning", items: [{ title, status: "Review needed", detail: "Full title retained in body." }] },
  ]);
  const original = doc.pdf.text.bind(doc.pdf),
    clipped = [];
  vi.spyOn(doc.pdf, "text").mockImplementation((value, x, y, options) => {
    if (Array.isArray(value) && y + ((value.length - 1) * doc.pdf.getFontSize() * 1.15 * 25.4) / 72 > 266)
      clipped.push(value.length);
    return original(value, x, y, options);
  });
  const output = doc.finish().output();
  expect(clipped).toEqual([]);
  expect(output).toContain("CHECK149");
});
it("keeps continuation labels inside the margin for long custom checklist titles", async () => {
  const doc = await createReportDocument("Survey pack", {}, "AIR-test", "DRAFT", "2026-10-29");
  const original = doc.pdf.text.bind(doc.pdf),
    overflows = [];
  vi.spyOn(doc.pdf, "text").mockImplementation((value, x, y, options) => {
    for (const line of Array.isArray(value) ? value : [value])
      if (String(line).includes("(continued)") && x + doc.pdf.getTextWidth(line) > 194.1) overflows.push(line);
    return original(value, x, y, options);
  });
  doc.checklists([
    {
      title: "Site checks",
      items: [
        {
          title: "Long organisation-specific inspection requirement ".repeat(10),
          status: "Review needed",
          detail: Array.from({ length: 160 }, (_, i) => `Review evidence ${i}`).join("\n"),
        },
      ],
    },
  ]);
  expect(overflows).toEqual([]);
  expect(doc.finish().output()).toContain("Review evidence 159");
});
it("keeps short review items together and carries all long text across pages with real contents links", async () => {
  const doc = await createReportDocument("Survey pack", {}, "AIR-test / R3", "DRAFT", "2026-10-29");
  doc.cover({ title: "Coastal survey", revision: 3, nextActions: [{ text: "Check weather" }] }, [
    ["Client", "QA client"],
  ]);
  doc.contents();
  doc.section("Long evidence", Array.from({ length: 150 }, (_, i) => `Evidence line ${i}`).join("\n"));
  doc.checklists([
    {
      title: "On site",
      items: [
        {
          title: "Landing area",
          status: "Review needed",
          role: "Survey lead",
          detail: "Check the agreed site.\nFinal evidence sentinel",
        },
      ],
    },
  ]);
  const pdf = doc.finish(),
    output = pdf.output();
  expect(pdf.getNumberOfPages()).toBeGreaterThan(3);
  expect(output).toContain("Evidence line 149");
  expect(output).toContain("Final evidence sentinel");
  expect(output).toContain("/Subtype /Link");
  expect(output).toContain("/Outlines");
  expect(doc.entries.every((e) => e.page <= pdf.getNumberOfPages())).toBe(true);
});
