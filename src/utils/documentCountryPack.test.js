import { describe, expect, it } from "vitest";
import { documentStatusLabel, documentText, getDocumentCountryPack } from "./documentCountryPack";

describe("document country packs", () => {
  it("provides Polish document labels and legal references", () => {
    expect(documentText("Permit to work", "Permit to work", "pl")).toBe("Pozwolenie na pracę");
    expect(documentStatusLabel("pending_review", "pl")).toBe("OCZEKUJE NA WERYFIKACJĘ");
    expect(getDocumentCountryPack("pl").emergencyNumber).toBe("112");
    expect(getDocumentCountryPack("pl").ramsLegalReferences.join(" ")).toContain("Kodeks pracy");
  });

  it("provides German document labels and BaustellV references", () => {
    expect(documentText("Permit to work", "Permit to work", "de")).toBe("Erlaubnisschein");
    expect(documentStatusLabel("pending_review", "de")).toBe("IN PRÜFUNG");
    expect(getDocumentCountryPack("de").emergencyNumber).toBe("112");
    expect(getDocumentCountryPack("de").safetyAuthority).toBe("BG BAU");
    expect(getDocumentCountryPack("de").ramsLegalReferences.join(" ")).toContain("Baustellenverordnung");
  });

  it("provides Austrian pack with German document strings", () => {
    expect(documentText("Permit to work", "Permit to work", "at")).toBe("Erlaubnisschein");
    expect(getDocumentCountryPack("at").safetyAuthority).toBe("AUVA");
    expect(getDocumentCountryPack("at").language).toBe("de-AT");
    expect(getDocumentCountryPack("at").ramsLegalReferences.join(" ")).toContain("Bauarbeitenkoordinationsgesetz");
  });

  it("provides Swiss pack with German document strings and Suva/BauAV references", () => {
    expect(documentText("Permit to work", "Permit to work", "ch")).toBe("Erlaubnisschein");
    expect(getDocumentCountryPack("ch").safetyAuthority).toBe("Suva");
    expect(getDocumentCountryPack("ch").language).toBe("de-CH");
    expect(getDocumentCountryPack("ch").emergencyNumber).toBe("112 / 144");
    expect(getDocumentCountryPack("ch").ramsLegalReferences.join(" ")).toContain("Bauarbeitenverordnung");
  });

  it("keeps UK wording and selects Australian WHS references", () => {
    expect(documentText("Location", "Location", "uk")).toBe("Location");
    expect(getDocumentCountryPack("uk").safetyAuthority).toBe("HSE");
    expect(getDocumentCountryPack("au").ramsLegalReferences.join(" ")).toContain("Work Health and Safety");
  });
});
