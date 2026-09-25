import { describe, expect, it } from "vitest";
import {
  buildDocReference,
  renderPrintDocHeader,
  renderMySafeOpsMarkSvg,
  summarizeRegisterStats,
} from "./pdfBranding.js";

describe("pdfBranding", () => {
  it("builds stable doc reference prefix", () => {
    const ref = buildDocReference({ pdfVersionPrefix: "MSO" }, "Timesheets");
    expect(ref).toMatch(/^MSO-TIMESHEE-\d{8}$/);
  });

  it("summarizes register rows by status", () => {
    const stats = summarizeRegisterStats([
      { status: "open" },
      { status: "closed" },
      { status: "open" },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.byStatus.open).toBe(2);
    expect(stats.byStatus.closed).toBe(1);
  });

  it("renders MySafeOps mark svg", () => {
    const svg = renderMySafeOpsMarkSvg();
    expect(svg).toContain("viewBox");
    expect(svg).toContain("#0d9488");
  });

  it("renders print header with org and badge", () => {
    const html = renderPrintDocHeader(
      { name: "FESS Group", pdfHeader: "Site safety", primaryColor: "#0d9488", accentColor: "#f97316" },
      { docTitle: "Timesheets", docBadge: "REGISTER" }
    );
    expect(html).toContain("FESS Group");
    expect(html).toContain("MySafeOps");
    expect(html).toContain("Timesheets");
    expect(html).toContain("print-brand-stripe");
  });

  it("includes A4 running footer in wrapped print documents", async () => {
    const { wrapPrintHtmlDocument } = await import("./pdfBranding.js");
    const html = wrapPrintHtmlDocument(
      { name: "Acme Civils", pdfFooter: "Acme · controlled" },
      { pageTitle: "Pack", bodyHtml: "<p>Body</p>", headerOpts: { docTitle: "Pack" } }
    );
    expect(html).toContain("print-running-footer");
    expect(html).toContain("@page");
    expect(html).toContain("print-kpi-grid");
  });
});
