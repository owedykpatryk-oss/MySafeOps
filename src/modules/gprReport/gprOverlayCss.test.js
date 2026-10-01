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
});
