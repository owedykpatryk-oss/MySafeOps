import { describe, expect, it } from "vitest";
import { buildLegalAcceptanceMetadata } from "./legalAcceptance";
import { LEGAL_VERSIONS } from "../config/legalVersions";

describe("buildLegalAcceptanceMetadata", () => {
  it("records acceptance timestamps and document versions", () => {
    const fixed = new Date("2026-07-09T12:00:00.000Z");
    const meta = buildLegalAcceptanceMetadata(fixed);

    expect(meta.terms_accepted_at).toBe("2026-07-09T12:00:00.000Z");
    expect(meta.privacy_accepted_at).toBe("2026-07-09T12:00:00.000Z");
    expect(meta.terms_version).toBe(LEGAL_VERSIONS.uk.terms);
    expect(meta.privacy_version).toBe(LEGAL_VERSIONS.uk.privacy);
  });

  it("records AU legal versions when market is au", () => {
    const meta = buildLegalAcceptanceMetadata(new Date("2026-07-09T12:00:00.000Z"), "au");
    expect(meta.market).toBe("au");
    expect(meta.terms_version).toBe(LEGAL_VERSIONS.au.terms);
    expect(meta.privacy_version).toBe(LEGAL_VERSIONS.au.privacy);
  });
});
