import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("GPR editor overlay CSS", () => {
  it("keeps the new/edit editor fixed above the report list", () => {
    const cssPath = fileURLToPath(new URL("../../styles/gpr-report.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain(":not(.app-module-overlay)");
    expect(css).toMatch(/\.app-gpr-page-shell\s*>\s*\.app-gpr-module-overlay\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/\.app-gpr-page-shell\s*>\s*\.app-gpr-module-overlay\s*\{[^}]*z-index:\s*var\(--z-overlay,\s*50\)/s);
  });

  it("keeps the live PDF dock from overlapping equipment text", () => {
    const cssPath = fileURLToPath(new URL("../../styles/gpr-report.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");

    expect(css).toMatch(/\.app-gpr-editor-form\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toMatch(/\.app-gpr-equipment-profile\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toMatch(
      /\.app-survey-report-editor--split\s+\.app-gpr-report-editor__body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*380px\)/s
    );
    expect(css).toMatch(/\.app-survey-report-editor--split\s+\.app-gpr-equipment-profile\s*\{[^}]*grid-template-columns:\s*1fr/s);
  });
});
