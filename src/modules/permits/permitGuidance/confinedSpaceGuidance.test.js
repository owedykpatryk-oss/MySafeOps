import { describe, expect, it } from "vitest";
import { renderConfinedRolesSvg } from "./confinedSpaceGuidance.js";

describe("renderConfinedRolesSvg", () => {
  it("escapes HTML/SVG markup in role names", () => {
    const svg = renderConfinedRolesSvg({
      entrantName: `<img src=x onerror=alert(1)>`,
      standbyName: `Bob</text><script>alert(1)</script>`,
    });
    expect(svg).not.toContain("<img");
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("onerror=");
    expect(svg).toContain("&lt;img");
  });
});
