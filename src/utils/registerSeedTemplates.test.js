import { describe, expect, it, vi, beforeEach } from "vitest";
import { seedModuleRegisterIfEmpty, seedEmptyRegisters, seedTemplateCount } from "./registerSeedTemplates.js";

vi.mock("./orgStorage.js", () => ({
  loadOrgScoped: vi.fn(() => []),
  saveOrgScoped: vi.fn(),
}));

vi.mock("../navigation/moduleCatalogMeta.js", () => ({
  MODULE_PDF_REGISTRY: {
    fire: { key: "fire_safety_log" },
    riddor: { key: "riddor_reports" },
    coshh: { key: "coshh_items" },
    scaffold: { key: "scaffold_register" },
    unknown: { key: "unknown_key" },
  },
}));

import { loadOrgScoped, saveOrgScoped } from "./orgStorage.js";

describe("registerSeedTemplates", () => {
  beforeEach(() => {
    vi.mocked(loadOrgScoped).mockReturnValue([]);
    vi.mocked(saveOrgScoped).mockClear();
  });

  it("seeds empty fire register", () => {
    const r = seedModuleRegisterIfEmpty("fire");
    expect(r.ok).toBe(true);
    expect(saveOrgScoped).toHaveBeenCalledWith("fire_safety_log", expect.any(Array));
  });

  it("skips non-empty register", () => {
    vi.mocked(loadOrgScoped).mockReturnValue([{ id: "x" }]);
    const r = seedModuleRegisterIfEmpty("fire");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_empty");
  });

  it("batch seeds multiple modules", () => {
    const { seeded } = seedEmptyRegisters(["fire", "riddor", "coshh", "unknown"]);
    expect(seeded).toEqual(["fire", "riddor", "coshh"]);
  });

  it("seeds RIDDOR, COSHH and scaffold templates", () => {
    expect(seedModuleRegisterIfEmpty("riddor").ok).toBe(true);
    expect(seedModuleRegisterIfEmpty("coshh").ok).toBe(true);
    expect(seedModuleRegisterIfEmpty("scaffold").ok).toBe(true);
    expect(saveOrgScoped).toHaveBeenCalledWith("riddor_reports", expect.any(Array));
    expect(saveOrgScoped).toHaveBeenCalledWith("coshh_items", expect.any(Array));
    expect(saveOrgScoped).toHaveBeenCalledWith("scaffold_register", expect.any(Array));
  });

  it("covers 33 HSE seed templates", () => {
    expect(seedTemplateCount()).toBe(33);
  });
});
