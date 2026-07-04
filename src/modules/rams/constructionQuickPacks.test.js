import { describe, it, expect } from "vitest";
import ALL from "./ramsAllHazards.js";
import {
  BUILTIN_CONSTRUCTION_PACK_DEFS,
  BUILTIN_GEOSPATIAL_PACK_DEFS,
  BUILTIN_SITE_INVESTIGATION_PACK_DEFS,
  BUILTIN_FOOD_PHARMA_PACK_DEFS,
  buildPackFromDef,
  ensureBuiltInConstructionPacks,
} from "./constructionQuickPacks.js";
import { CONSTRUCTION_ACTIVITY_CATALOG } from "./constructionActivityCatalog.js";

describe("constructionQuickPacks", () => {
  it("builds every built-in pack with at least one template from merged library", () => {
    for (const def of BUILTIN_CONSTRUCTION_PACK_DEFS) {
      const pack = buildPackFromDef(ALL, def);
      expect(pack, def.id).toBeTruthy();
      expect(pack.templates.length).toBeGreaterThan(0);
    }
  });

  it("builds every food & pharma built-in pack from merged library", () => {
    for (const def of BUILTIN_FOOD_PHARMA_PACK_DEFS) {
      const pack = buildPackFromDef(ALL, def);
      expect(pack, def.id).toBeTruthy();
      expect(pack.templates.length).toBeGreaterThan(0);
    }
  });

  it("builds every geospatial built-in pack from merged library", () => {
    for (const def of BUILTIN_GEOSPATIAL_PACK_DEFS) {
      const pack = buildPackFromDef(ALL, def);
      expect(pack, def.id).toBeTruthy();
      expect(pack.templates.length).toBeGreaterThan(0);
    }
    expect(BUILTIN_GEOSPATIAL_PACK_DEFS.length).toBe(6);
  });

  it("builds every site investigation built-in pack from merged library", () => {
    for (const def of BUILTIN_SITE_INVESTIGATION_PACK_DEFS) {
      const pack = buildPackFromDef(ALL, def);
      expect(pack, def.id).toBeTruthy();
      expect(pack.templates.length).toBeGreaterThan(0);
    }
    expect(BUILTIN_SITE_INVESTIGATION_PACK_DEFS.length).toBe(3);
  });

  it("ensureBuiltInConstructionPacks adds missing built-ins once", () => {
    const total =
      BUILTIN_CONSTRUCTION_PACK_DEFS.length +
      BUILTIN_GEOSPATIAL_PACK_DEFS.length +
      BUILTIN_SITE_INVESTIGATION_PACK_DEFS.length +
      BUILTIN_FOOD_PHARMA_PACK_DEFS.length;
    expect(total).toBeGreaterThanOrEqual(37);
    const first = ensureBuiltInConstructionPacks([], ALL);
    expect(first.length).toBe(total);
    expect(first.every((p) => p.builtIn)).toBe(true);
    const second = ensureBuiltInConstructionPacks(first, ALL);
    expect(second.length).toBe(first.length);
  });
});

describe("constructionActivityCatalog", () => {
  it("covers major sectors from CONSTRUCTION.txt", () => {
    const ids = CONSTRUCTION_ACTIVITY_CATALOG.map((s) => s.id);
    expect(ids).toContain("construction");
    expect(ids).toContain("utilities");
    expect(ids).toContain("surveying");
    expect(ids).toContain("highways");
    expect(ids).toContain("rail");
  });
});

describe("fessExcelHazardLibrary merge", () => {
  it("includes FESS Excel hazards in merged library", () => {
    expect(ALL.some((h) => h.id === "fess_001")).toBe(true);
    expect(ALL.some((h) => h.id === "xlift_001")).toBe(true);
    expect(ALL.length).toBeGreaterThan(200);
  });

  it("includes supplement hazards with permitTypes", () => {
    const night = ALL.find((h) => h.id === "cst_night_001");
    expect(night).toBeTruthy();
    expect(night.permitTypes?.length).toBeGreaterThan(0);
    expect(night.requiredCerts?.length).toBeGreaterThan(0);
  });

  it("includes site investigation hazards in merged library", () => {
    expect(ALL.some((h) => h.id === "si_001")).toBe(true);
    expect(ALL.some((h) => h.id === "si_003")).toBe(true);
    expect(ALL.some((h) => h.category === "Site Investigation & Geotechnics")).toBe(true);
  });
});
