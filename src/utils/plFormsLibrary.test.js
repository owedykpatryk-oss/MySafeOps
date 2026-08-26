import { describe, expect, it } from "vitest";
import {
  findPlForm,
  listPlFormGroups,
  PL_FORMS,
  plFormFields,
  plFormLabel,
  plFormMissingFields,
} from "./plFormsLibrary";
import { buildPlFormPrintHtml } from "./plFormsPrintHtml";

describe("plFormsLibrary", () => {
  it("gives every druk the parts the form and the print need", () => {
    const keys = new Set();
    for (const f of PL_FORMS) {
      expect(keys.has(f.key)).toBe(false);
      keys.add(f.key);
      expect(f.label).toBeTruthy();
      expect(f.grupa).toBeTruthy();
      expect(f.podstawa).toBeTruthy();
      expect(f.sections.length).toBeGreaterThan(0);
      const fieldKeys = new Set();
      for (const s of f.sections) {
        expect(s.title).toBeTruthy();
        expect(s.fields.length).toBeGreaterThan(0);
        for (const field of s.fields) {
          expect(field.label).toBeTruthy();
          // One key per druk — the print reads values by key, so a clash would overwrite.
          expect(fieldKeys.has(field.key)).toBe(false);
          fieldKeys.add(field.key);
          if (field.kind === "select") expect(field.options.length).toBeGreaterThan(1);
        }
      }
    }
  });

  it("covers the statutory forms a Polish site actually needs", () => {
    const keys = PL_FORMS.map((f) => f.key);
    expect(keys).toContain("skierowanie_badania");
    expect(keys).toContain("karta_szkolenia_wstepnego");
    expect(keys).toContain("protokol_powypadkowy");
    expect(keys).toContain("karta_wypadku");
    expect(keys).toContain("karta_wypadku_w_drodze");
    expect(keys).toContain("karta_odziezy");
  });

  it("groups druki and finds them by key", () => {
    expect(listPlFormGroups().length).toBeGreaterThan(1);
    expect(findPlForm("karta_wypadku")?.label).toMatch(/Karta wypadku/);
    expect(findPlForm("nie-ma-takiego")).toBe(null);
    expect(plFormLabel("skierowanie_badania")).toMatch(/Skierowanie/);
  });

  it("reports which required fields are still blank", () => {
    const missing = plFormMissingFields("skierowanie_badania", { imieNazwisko: "Jan Kowalski" });
    expect(missing).not.toContain("Imię i nazwisko");
    expect(missing).toContain("Stanowisko");
    expect(plFormMissingFields("skierowanie_badania", {
      imieNazwisko: "Jan Kowalski",
      stanowisko: "Monter",
      rodzajBadania: "okresowe",
      dataWystawienia: "2026-08-23",
    })).toEqual([]);
  });

  it("prints a filled druk with its values, tickboxes and legal basis", () => {
    const html = buildPlFormPrintHtml(
      {
        id: "druk_1",
        formKey: "skierowanie_badania",
        ref: "SK/2026/14",
        values: { imieNazwisko: "Jan Kowalski", stanowisko: "Monter", rodzajBadania: "okresowe", wysokosc: true },
      },
      { orgName: "Budimex Sp. z o.o." }
    );
    expect(html).toContain("Skierowanie na badania lekarskie");
    expect(html).toContain("Jan Kowalski");
    expect(html).toContain("SK/2026/14");
    expect(html).toContain("Budimex Sp. z o.o.");
    expect(html).toContain("TAK"); // praca na wysokości zaznaczona
    expect(html).toMatch(/Kodeks pracy art\. 229/);
  });

  it("escapes values instead of letting them into the print markup", () => {
    const html = buildPlFormPrintHtml(
      { formKey: "karta_wypadku", values: { imieNazwisko: "<script>alert(1)</script>" } },
      {}
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns nothing for a druk it does not know", () => {
    expect(buildPlFormPrintHtml({ formKey: "brak" }, {})).toBe("");
  });

  it("flattens fields for the form renderer", () => {
    const fields = plFormFields("protokol_powypadkowy");
    expect(fields.length).toBeGreaterThan(15);
    expect(fields.some((f) => f.key === "wnioski")).toBe(true);
  });
});
