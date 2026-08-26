import { describe, expect, it } from "vitest";
import PL_HAZARDS, { PL_HAZARD_CATEGORIES } from "./ramsHazardLibraryPl";
import ALL from "./ramsAllHazards";
import { filterHazardLibraryForMarket } from "./ramsHazardLibraryLoader";
import { BUILTIN_PL_IBWR_PACK_IDS, BUILTIN_PL_PACK_IDS, getBuiltInConstructionPackDefs } from "./constructionQuickPacks";
import PL_IBWR_ROWS, { PL_IBWR_JOBS } from "./ramsIbwrTemplatesPl";

describe("ramsHazardLibraryPl", () => {
  it("gives every Polish hazard the parts an IBWR document needs", () => {
    const categories = new Set(PL_HAZARD_CATEGORIES);
    const ids = new Set();
    for (const h of PL_HAZARDS) {
      expect(h.id.startsWith("pl_")).toBe(true);
      expect(ids.has(h.id)).toBe(false);
      ids.add(h.id);
      expect(h.market).toBe("pl");
      expect(categories.has(h.category)).toBe(true);
      expect(h.activity).toBeTruthy();
      expect(h.hazard).toBeTruthy();
      expect(h.controlMeasures.length).toBeGreaterThan(3);
      expect(h.ppeRequired.length).toBeGreaterThan(0);
      expect(h.regs.length).toBeGreaterThan(0);
      expect(h.revisedRisk.RF).toBeLessThan(h.initialRisk.RF);
    }
  });

  it("is written in Polish, not left as English filler", () => {
    const prose = PL_HAZARDS.map((h) => `${h.activity} ${h.hazard} ${h.controlMeasures.join(" ")}`).join(" ");
    expect(prose).toMatch(/[ąćęłńóśźż]/);
    expect(prose).not.toMatch(/\b(the|and|shall|must be)\b/i);
  });

  it("merges into the shared library so packs can be built from the ids", () => {
    const merged = new Set(ALL.map((h) => h.id));
    for (const h of PL_HAZARDS) expect(merged.has(h.id)).toBe(true);
  });

  it("shows Polish hazards only to a Polish workspace", () => {
    const pl = filterHazardLibraryForMarket(ALL, "pl");
    const uk = filterHazardLibraryForMarket(ALL, "uk");
    expect(pl.some((h) => h.id === "pl_wys_001")).toBe(true);
    expect(uk.some((h) => h.id.startsWith("pl_"))).toBe(false);
    // Nothing else is dropped — the Polish set is additive.
    expect(uk.length).toBe(ALL.length - PL_HAZARDS.length - PL_IBWR_ROWS.length);
  });

  it("builds every Polish quick pack from Polish hazards", () => {
    const defs = getBuiltInConstructionPackDefs("pl").filter((d) => BUILTIN_PL_PACK_IDS.has(d.id));
    expect(defs.length).toBeGreaterThan(4);
    const plIds = new Set(PL_HAZARDS.map((h) => h.id));
    const used = new Set();
    for (const def of defs) {
      expect(def.hazardIds.length).toBeGreaterThan(0);
      for (const id of def.hazardIds) {
        expect(plIds.has(id)).toBe(true);
        used.add(id);
      }
    }
    expect(used.size).toBe(plIds.size);
  });

  it("expands every IBWR job into one library row per stage", () => {
    const rows = PL_IBWR_ROWS;
    expect(rows.length).toBe(PL_IBWR_JOBS.reduce((n, j) => n + j.stages.length, 0));
    for (const row of rows) {
      expect(row.market).toBe("pl");
      expect(row.activity).toMatch(/^Etap \d+: /);
      expect(row.hazard).toBeTruthy();
      // The Polish form splits controls into employer side and worker side — keep both.
      expect(row.controlMeasures.some((c) => c.startsWith("Pracodawca"))).toBe(true);
      expect(row.controlMeasures.some((c) => c.startsWith("Pracownik"))).toBe(true);
      expect(row.revisedRisk.RF).toBeLessThan(row.initialRisk.RF);
    }
  });

  it("gives each IBWR job a ready pack a Polish workspace can apply", () => {
    const defs = getBuiltInConstructionPackDefs("pl").filter((d) => BUILTIN_PL_IBWR_PACK_IDS.has(d.id));
    expect(defs.length).toBe(PL_IBWR_JOBS.length);
    const rowIds = new Set(PL_IBWR_ROWS.map((r) => r.id));
    for (const def of defs) {
      expect(def.hazardIds.length).toBeGreaterThan(3);
      for (const id of def.hazardIds) expect(rowIds.has(id)).toBe(true);
    }
  });
});
