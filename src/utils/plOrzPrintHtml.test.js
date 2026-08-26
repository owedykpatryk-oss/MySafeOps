import { describe, expect, it } from "vitest";
import { buildOrzPrintHtml } from "./plOrzPrintHtml.js";
import { findOrzCard } from "./plOrzLibrary.js";
import { isModuleAllowedForMarket } from "../config/marketModules.js";

function record(extra = {}) {
  return { ...findOrzCard("robotnik_budowlany"), dataOceny: "2026-08-23", oceniajacy: "Anna Kowalska", ...extra };
}

describe("plOrzPrintHtml", () => {
  it("prints the assessed table, not the raw scale inputs", () => {
    const html = buildOrzPrintHtml(record(), { orgName: "Firma Budowlana" });
    expect(html).toContain("Ocena ryzyka zawodowego");
    expect(html).toContain("Firma Budowlana");
    expect(html).toContain("2026-08-23");
    expect(html).toContain("PN-N-18002");
    // Every hazard row carries a computed level, so the printed sheet needs no manual scoring.
    expect(html).toContain("Upadek z wysokości");
    expect(html).toContain("duże");
  });

  it("always carries the worker acknowledgement and signature lines", () => {
    const html = buildOrzPrintHtml(record());
    expect(html).toContain("Oświadczenie pracownika");
    expect(html).toMatch(/zapoznałem\(-am\) się z oceną ryzyka zawodowego/);
    expect(html).toContain("Podpis pracownika");
  });

  it("escapes org and site text instead of injecting it", () => {
    const html = buildOrzPrintHtml(record({ komorka: '<script>alert("x")</script>' }));
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("survives a card with no hazards", () => {
    const html = buildOrzPrintHtml({ stanowisko: "Nowe stanowisko", zagrozenia: [] });
    expect(html).toContain("Brak zidentyfikowanych zagrożeń");
  });

  it("keeps the ORZ module on the Polish market only", () => {
    expect(isModuleAllowedForMarket("orz", "pl")).toBe(true);
    expect(isModuleAllowedForMarket("orz", "uk")).toBe(false);
    expect(isModuleAllowedForMarket("orz", "de")).toBe(false);
  });
});
