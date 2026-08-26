import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL_VERSIONS } from "./legalVersions";

const readLegal = (path) => readFileSync(new URL(`../../public/legal/${path}`, import.meta.url), "utf8");

describe("public legal content readiness", () => {
  it("does not publish obsolete EU ODR links or operational placeholders in the German Impressum", () => {
    const html = readLegal("de/impressum.html");
    expect(html).not.toContain("ec.europa.eu/consumers/odr");
    expect(html).not.toMatch(/\[(?:Telefonnummer|Falls UK-umsatzsteuerpflichtig)/);
    expect(html).toContain("20. Juli 2025");
  });

  it("keeps the German privacy document version aligned with the acceptance version", () => {
    const html = readLegal("de/privacy-policy.html");
    expect(html).toContain(`Version ${LEGAL_VERSIONS.de.privacy}`);
  });
});
