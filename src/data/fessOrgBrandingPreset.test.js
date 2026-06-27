import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  FESS_ORG_BRANDING_BASE,
  FESS_ORG_SLUG,
  FESS_LOGO_PUBLIC_PATH,
  buildFessOrgBrandingPreset,
} from "./fessOrgBrandingPreset";

describe("fessOrgBrandingPreset", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["x"], { type: "image/png" }),
      }))
    );
    vi.stubGlobal(
      "FileReader",
      class {
        readAsDataURL() {
          this.onload?.({ target: { result: "data:image/png;base64,abc" } });
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports FESS org slug constant", () => {
    expect(FESS_ORG_SLUG).toBe("fess-group");
  });

  it("includes industrial sectors and FESS website", () => {
    expect(FESS_ORG_BRANDING_BASE.website).toBe("https://pl.fessgroup.co.uk/");
    expect(FESS_ORG_BRANDING_BASE.industrySectors).toEqual(
      expect.arrayContaining(["construction", "food_beverage", "pharma", "petrochem"])
    );
    expect(FESS_ORG_BRANDING_BASE.primaryColor).toBe("#f97316");
  });

  it("buildFessOrgBrandingPreset merges base fields and attempts logo fetch", async () => {
    const preset = await buildFessOrgBrandingPreset();
    expect(fetch).toHaveBeenCalledWith(FESS_LOGO_PUBLIC_PATH);
    expect(preset.name).toBe("FESS Group");
    expect(preset.pdfVersionPrefix).toBe("FESS");
    expect(preset).toHaveProperty("logo");
  });
});
