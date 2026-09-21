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
    expect(getDocumentCountryPack("au").ramsLegalReferences.join(" ")).toContain("Work Health and Safety");
  });
});
