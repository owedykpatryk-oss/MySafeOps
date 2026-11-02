import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GPR_EQUIPMENT_PRESETS } from "./gprReportConstants.js";

describe("GPR equipment assets", () => {
  it("ships every local image referenced by an equipment preset", () => {
    const urls = GPR_EQUIPMENT_PRESETS.flatMap((preset) => preset.imageUrls?.length
      ? preset.imageUrls
      : preset.imageUrl ? [preset.imageUrl] : []);

    for (const url of new Set(urls)) {
      expect(url).toMatch(/^\/assets\/gpr\/equipment\/[a-z0-9.-]+$/);
      expect(existsSync(new URL(`../../../public${url}`, import.meta.url)), url).toBe(true);
    }
  });
});
