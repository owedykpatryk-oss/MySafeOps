import { describe, expect, it } from "vitest";
import PL_INSTRUKCJE, {
  findPlInstrukcja,
  instrukcjaAcknowledgementSummary,
  instrukcjaAcknowledgementText,
  listPlInstrukcjaGroups,
} from "./plInstrukcjeLibrary";
import { buildInstrukcjaPrintHtml } from "./plInstrukcjePrintHtml";

describe("plInstrukcjeLibrary", () => {
  it("daje każdej instrukcji komplet sekcji, których wymaga druk", () => {
    const keys = new Set();
    for (const i of PL_INSTRUKCJE) {
      expect(keys.has(i.key)).toBe(false);
      keys.add(i.key);
      expect(i.tytul).toBeTruthy();
      expect(i.grupa).toBeTruthy();
      expect(i.opis).toBeTruthy();
      // Bez tych czterech sekcji instrukcja stanowiskowa nie jest instrukcją, tylko notatką.
      expect(i.przedPraca.length).toBeGreaterThan(2);
      expect(i.wTrakcie.length).toBeGreaterThan(2);
      expect(i.poPracy.length).toBeGreaterThan(1);
      expect(i.zabronione.length).toBeGreaterThan(2);
      expect(i.awaria.length).toBeGreaterThan(1);
      expect(i.soi.length).toBeGreaterThan(0);
      expect(i.podstawa.length).toBeGreaterThan(0);
      expect(i.uwagiOgolne.some((u) => /orzeczenie lekarskie/i.test(u))).toBe(true);
    }
  });

  it("jest napisana po polsku", () => {
    const prose = PL_INSTRUKCJE.map((i) => [i.tytul, ...i.przedPraca, ...i.zabronione].join(" ")).join(" ");
    expect(prose).toMatch(/[ąćęłńóśźż]/);
    expect(prose).not.toMatch(/\b(the|and|shall|must be)\b/i);
  });

  it("pokrywa sprzęt i prace, które realnie wymagają instrukcji", () => {
    const keys = PL_INSTRUKCJE.map((i) => i.key);
    expect(keys).toContain("szlifierka_katowa");
    expect(keys).toContain("rusztowanie");
    expect(keys).toContain("wozek_widlowy");
    expect(keys).toContain("spawanie");
    expect(keys).toContain("prace_wysokosc_szelki");
    expect(listPlInstrukcjaGroups().length).toBeGreaterThan(3);
  });

  it("znajduje instrukcję po kluczu i zwraca null dla nieznanego", () => {
    expect(findPlInstrukcja("drabina")?.tytul).toMatch(/drabiny/i);
    expect(findPlInstrukcja("nie-ma")).toBe(null);
  });

  describe("zapoznanie pracowników", () => {
    it("liczy tylko wpisy z nazwiskiem i datą", () => {
      const summary = instrukcjaAcknowledgementSummary({
        zapoznani: [
          { imieNazwisko: "Jan Kowalski", data: "2026-08-20" },
          { imieNazwisko: "Anna Nowak", data: "" },
        ],
      });
      expect(summary.total).toBe(2);
      expect(summary.signed).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.complete).toBe(false);
    });

    it("nie uznaje pustej listy za komplet podpisów", () => {
      const summary = instrukcjaAcknowledgementSummary({ zapoznani: [] });
      expect(summary.complete).toBe(false);
      expect(summary.pending).toBe(0);
    });

    it("buduje treść oświadczenia z tytułem instrukcji", () => {
      const lines = instrukcjaAcknowledgementText("Szlifierka kątowa", "2026-08-23");
      expect(lines[0]).toMatch(/Szlifierka kątowa/);
      expect(lines.join(" ")).toMatch(/czynności zabronione/);
      expect(lines.join(" ")).toMatch(/2026-08-23/);
    });
  });

  describe("wydruk", () => {
    it("drukuje wszystkie sekcje i listę zapoznania", () => {
      const src = findPlInstrukcja("rusztowanie");
      const html = buildInstrukcjaPrintHtml(
        { ...src, libraryKey: "rusztowanie", ref: "IS/2026/03", dataWydania: "2026-08-23", zapoznani: [{ imieNazwisko: "Jan Kowalski", stanowisko: "Monter", data: "2026-08-23" }] },
        { orgName: "Budimex Sp. z o.o." }
      );
      expect(html).toMatch(/Czynności przed rozpoczęciem pracy/);
      expect(html).toMatch(/Czynności zabronione/);
      expect(html).toMatch(/Postępowanie w sytuacjach awaryjnych/);
      expect(html).toContain("IS/2026/03");
      expect(html).toContain("Budimex Sp. z o.o.");
      expect(html).toContain("Jan Kowalski");
      expect(html).toMatch(/Oświadczenie o zapoznaniu/);
    });

    it("zostawia puste wiersze na podpisy zbierane na papierze", () => {
      const src = findPlInstrukcja("drabina");
      const html = buildInstrukcjaPrintHtml({ ...src, libraryKey: "drabina", zapoznani: [] }, {});
      // Pusta lista i tak drukuje ponumerowane wiersze do ręcznego wypełnienia.
      expect(html).toMatch(/<td>8<\/td>/);
    });

    it("nie wpuszcza wartości do znaczników wydruku", () => {
      const src = findPlInstrukcja("drabina");
      const html = buildInstrukcjaPrintHtml(
        { ...src, libraryKey: "drabina", komorka: "<script>alert(1)</script>" },
        {}
      );
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("nie drukuje niczego dla nieznanej instrukcji", () => {
      expect(buildInstrukcjaPrintHtml({ libraryKey: "brak" }, {})).toBe("");
    });
  });
});
