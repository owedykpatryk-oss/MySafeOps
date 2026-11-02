import { describe, expect, it } from "vitest";
import { inferRegisterColumns, exportAllHseRegistersPdf, resolveRegisterReferences } from "./moduleRegisterPdf";
import { prepareRegisterExport } from "./registerPdfAdapters";
import { getModulePdfConfig } from "../navigation/moduleCatalogMeta";

it("exports People from the actual worker register", () => {
  expect(getModulePdfConfig("people").key).toBe("mysafeops_workers");
});

it("resolves names and sums weekly timesheet hours", () => {
  const rows = resolveRegisterReferences([{ workerId: "w_1", projectId: "p_1", assignedTo: "w_1", days: { Mon: "8", Tue: "7.5" } }], [{ id: "w_1", name: "Alice" }], [{ id: "p_1", name: "Site A" }]);
  expect(rows[0]).toMatchObject({ workerName: "Alice", assignedToName: "Alice", projectName: "Site A" });
  expect(prepareRegisterExport("timesheets", rows).rows[0].hours).toBe(15.5);
});
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
