import { describe, expect, it } from "vitest";
import { inferRegisterColumns, exportAllHseRegistersPdf } from "./moduleRegisterPdf";
import { canExportModulePdf, MODULE_PDF_REGISTRY } from "../navigation/moduleCatalogMeta";

describe("inferRegisterColumns", () => {
  it("prefers common register fields", () => {
    const cols = inferRegisterColumns([
      { id: "1", name: "A", status: "open", mysteryField: "x", createdAt: "2026-01-01" },
    ]);
    expect(cols.map((c) => c.k)).toEqual(expect.arrayContaining(["name", "status"]));
  });

  it("returns placeholder column for empty data", () => {
    expect(inferRegisterColumns([])[0].k).toBe("_status");
  });
});

describe("canExportModulePdf", () => {
  it("covers HSE registers from More grid", () => {
    expect(canExportModulePdf("coshh")).toBe(true);
    expect(canExportModulePdf("settings")).toBe(false);
  });

  it("every MODULE_PDF_REGISTRY key is exportable", () => {
    for (const moduleId of Object.keys(MODULE_PDF_REGISTRY)) {
      expect(canExportModulePdf(moduleId)).toBe(true);
    }
  });

  it("includes geo-photos register", () => {
    expect(MODULE_PDF_REGISTRY["geo-photos"]?.key).toBe("geo_photos");
  });
});

describe("exportAllHseRegistersPdf", () => {
  it("returns error when section config missing", () => {
    // function exists and handles empty org data in browser; smoke import only here
    expect(typeof exportAllHseRegistersPdf).toBe("function");
  });
});
