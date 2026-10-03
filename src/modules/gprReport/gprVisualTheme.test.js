import { describe, expect, it } from "vitest";
import { gprThemeCssVariables, resolveGprVisualTheme, safeGprHexColor } from "./gprVisualTheme.js";

describe("GPR visual themes", () => {
  it("keeps organisation colours for legacy and brand reports", () => {
    const theme = resolveGprVisualTheme({}, { primaryColor: "#123456", accentColor: "#abcdef" });
    expect(theme.primary).toBe("#123456");
    expect(theme.accent).toBe("#abcdef");
    expect(theme.accentSoft).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("resolves a preset independently from organisation branding", () => {
    const theme = resolveGprVisualTheme(
      { visualTheme: { presetKey: "site_gold" } },
      { primaryColor: "#123456", accentColor: "#abcdef" }
    );
    expect(theme.primary).toBe("#172554");
    expect(theme.accent).toBe("#F59E0B");
  });

  it("accepts safe custom colours and rejects CSS injection", () => {
    const theme = resolveGprVisualTheme({
      visualTheme: {
        presetKey: "custom",
        primaryColor: "#112233",
        accentColor: "red;}</style><script>alert(1)</script>",
      },
    });
    expect(theme.primary).toBe("#112233");
    expect(theme.accent).toBe("#00A6D6");
    expect(safeGprHexColor("#aabbcc", "#000000")).toBe("#aabbcc");
  });

  it("provides the same resolved colours as editor CSS variables", () => {
    const variables = gprThemeCssVariables({ visualTheme: { presetKey: "survey_green" } });
    expect(variables["--gpr-theme-primary"]).toBe("#064E3B");
    expect(variables["--gpr-theme-accent"]).toBe("#10B981");
  });
});
