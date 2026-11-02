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
    expect(getDocumentCountryPack("uk").ramsLegalReferences.join(" ")).toContain(
      "Health and Safety at Work etc. Act 1974"
    );
    expect(getDocumentCountryPack("uk").ramsLegalReferences.join(" ")).toContain(
      "Construction (Design and Management) Regulations 2015"
    );
    expect(getDocumentCountryPack("uk").ptwLegalReferencePlaceholder).toMatch(/WAHR/);
    expect(getDocumentCountryPack("uk").ptwLegalReferencePlaceholder).toMatch(/LOLER/);
    expect(getDocumentCountryPack("uk").ptwLegalReferencePlaceholder).toMatch(/PUWER/);
    expect(getDocumentCountryPack("pl").ptwLegalReferencePlaceholder).toMatch(/Kodeks pracy|UDT|PIP/);
    expect(getDocumentCountryPack("pl").ptwLegalReferencePlaceholder).not.toMatch(/WAHR|LOLER|PUWER/);
    expect(getDocumentCountryPack("au").ptwLegalReferencePlaceholder).toMatch(/WHS/);
    expect(getDocumentCountryPack("au").ptwLegalReferencePlaceholder).not.toMatch(/WAHR|LOLER|PUWER/);
  });

  it("falls unknown markets back to the UK HSE pack", () => {
    expect(getDocumentCountryPack("unknown-market").marketId).toBe("uk");
    expect(getDocumentCountryPack("unknown-market").safetyAuthority).toBe("HSE");
    expect(getDocumentCountryPack("unknown-market").emergencyNumber).toBe("999");
    expect(documentText("Permit to work", "Permit to work", "unknown-market")).toBe("Permit to work");
  });
});
