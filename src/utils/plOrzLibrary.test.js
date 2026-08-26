import { describe, expect, it } from "vitest";
import PL_ORZ_CARDS, {
  ORZ_PROBABILITY,
  ORZ_SEVERITY,
  assessOrzCard,
  findOrzCard,
  listOrzBranze,
  orzAcknowledgementText,
  orzRiskAcceptable,
  orzRiskAction,
  orzRiskLevel,
} from "./plOrzLibrary.js";

describe("plOrzLibrary", () => {
  describe("skala PN-N-18002", () => {
    it("scores every probability and severity pair", () => {
      for (const p of ORZ_PROBABILITY) {
        for (const s of ORZ_SEVERITY) {
          expect(["małe", "średnie", "duże"]).toContain(orzRiskLevel(p, s));
        }
      }
    });

    it("treats only large risk as unacceptable", () => {
      expect(orzRiskLevel("wysoce prawdopodobne", "duża")).toBe("duże");
      expect(orzRiskAcceptable("duże")).toBe(false);
      expect(orzRiskAcceptable("średnie")).toBe(true);
      expect(orzRiskAcceptable("małe")).toBe(true);
      expect(orzRiskAction("duże")).toMatch(/Niedopuszczalne/);
    });

    it("keeps the matrix symmetric where the standard says so", () => {
      expect(orzRiskLevel("mało prawdopodobne", "duża")).toBe("średnie");
      expect(orzRiskLevel("wysoce prawdopodobne", "mała")).toBe("średnie");
      expect(orzRiskLevel("mało prawdopodobne", "mała")).toBe("małe");
    });

    it("returns nothing for values outside the scale", () => {
      expect(orzRiskLevel("czasem", "duża")).toBe(null);
      expect(orzRiskAction(null)).toBe("Brak oceny");
    });
  });

  it("gives every card the parts a Polish ORZ document needs", () => {
    const keys = new Set();
    for (const card of PL_ORZ_CARDS) {
      expect(keys.has(card.key)).toBe(false);
      keys.add(card.key);
      expect(card.stanowisko).toBeTruthy();
      expect(card.opis.length).toBeGreaterThan(30);
      expect(card.badania.length).toBeGreaterThan(0);
      expect(card.szkolenia.length).toBeGreaterThan(0);
      expect(card.zagrozenia.length).toBeGreaterThan(2);
      for (const z of card.zagrozenia) {
        expect(ORZ_PROBABILITY).toContain(z.prawdopodobienstwo);
        expect(ORZ_SEVERITY).toContain(z.ciezkosc);
        expect(z.skutki).toBeTruthy();
        expect(z.srodki.length).toBeGreaterThan(1);
      }
    }
  });

  it("scores a card and reports the highest risk on the position", () => {
    const assessed = assessOrzCard(findOrzCard("robotnik_budowlany"));
    expect(assessed.zagrozenia.every((z) => z.poziom)).toBe(true);
    expect(assessed.najwyzszePoziomRyzyka).toBe("duże");
    expect(assessed.dopuszczalne).toBe(false);
    const upadek = assessed.zagrozenia.find((z) => z.czynnik === "Upadek z wysokości");
    expect(upadek.poziom).toBe("duże");
    expect(upadek.dzialanie).toMatch(/Niedopuszczalne/);
  });

  it("handles a card with no hazards without inventing a level", () => {
    const empty = assessOrzCard({ key: "x", stanowisko: "X", zagrozenia: [] });
    expect(empty.najwyzszePoziomRyzyka).toBe(null);
    expect(empty.dopuszczalne).toBe(true);
  });

  it("covers construction positions and groups them by branża", () => {
    const branze = listOrzBranze();
    expect(branze).toContain("Budownictwo");
    expect(branze.length).toBeGreaterThan(2);
    expect(findOrzCard("nieistniejace")).toBe(null);
  });

  it("writes the acknowledgement the Labour Code expects", () => {
    const lines = orzAcknowledgementText("Robotnik budowlany", "2026-08-23");
    expect(lines[0]).toContain("Robotnik budowlany");
    expect(lines[0]).toContain("2026-08-23");
    expect(lines.join(" ")).toMatch(/środkach profilaktycznych/);
  });
});
