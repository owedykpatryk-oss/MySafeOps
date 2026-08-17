import { describe, expect, it } from "vitest";
import { documentStatusLabel, documentText, getDocumentCountryPack } from "./documentCountryPack";

describe("document country packs", () => {
  it("provides Polish document labels and legal references", () => {
    expect(documentText("Permit to work", "Permit to work", "pl")).toBe("Pozwolenie na pracę");
    expect(documentStatusLabel("pending_review", "pl")).toBe("OCZEKUJE NA WERYFIKACJĘ");
    expect(getDocumentCountryPack("pl").emergencyNumber).toBe("112");
    expect(getDocumentCountryPack("pl").ramsLegalReferences.join(" ")).toContain("Kodeks pracy");
  });

  it("keeps UK wording and selects Australian WHS references", () => {
    expect(documentText("Location", "Location", "uk")).toBe("Location");
    expect(getDocumentCountryPack("uk").safetyAuthority).toBe("HSE");
    expect(getDocumentCountryPack("uk").ramsLegalReferences.join(" ")).toContain(
      "Health and Safety at Work etc. Act 1974"
    );
    expect(getDocumentCountryPack("uk").ramsLegalReferences.join(" ")).toContain(
      "Construction (Design and Management) Regulations 2015"
    );
    expect(getDocumentCountryPack("au").ramsLegalReferences.join(" ")).toContain("Work Health and Safety");
  });

  it("falls unknown markets back to the UK HSE pack", () => {
    expect(getDocumentCountryPack("de").marketId).toBe("uk");
    expect(getDocumentCountryPack("de").safetyAuthority).toBe("HSE");
    expect(getDocumentCountryPack("de").emergencyNumber).toBe("999");
    expect(documentText("Permit to work", "Permit to work", "de")).toBe("Permit to work");
  });
});
