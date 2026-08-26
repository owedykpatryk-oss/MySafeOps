/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { saveOrgScoped } from "./orgStorage";
import { collectHarmfulFactorDueItems } from "./plCzynnikiDue";

describe("plCzynnikiDue", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("nie zwraca nic, gdy rejestr jest pusty — także dla rynków innych niż PL", () => {
    expect(collectHarmfulFactorDueItems()).toEqual([]);
  });

  it("zwraca termin wyliczony z krotności", () => {
    saveOrgScoped("pl_czynniki_szkodliwe", [
      {
        id: "c1",
        nazwa: "Hałas",
        rodzaj: "halas",
        stanowisko: "Zagęszczanie gruntu",
        wynik: "90",
        wartoscDopuszczalna: "85",
        dataPomiaru: "2026-01-10",
      },
    ]);
    const items = collectHarmfulFactorDueItems();
    expect(items).toHaveLength(1);
    // Powyżej 0,5 NDN → pomiar co 12 miesięcy.
    expect(items[0].nextDueIso).toBe("2027-01-10");
    expect(items[0].moduleId).toBe("pl-czynniki");
    expect(items[0].stanowisko).toBe("Zagęszczanie gruntu");
  });

  it("pomija wpisy, przy których pracodawca odstąpił od pomiarów", () => {
    saveOrgScoped("pl_czynniki_szkodliwe", [
      {
        id: "c2",
        nazwa: "Pyły niesklasyfikowane inaczej",
        rodzaj: "pyl",
        wynik: "0,5",
        wartoscDopuszczalna: "10",
        dataPomiaru: "2026-01-10",
        odstapiono: true,
      },
    ]);
    expect(collectHarmfulFactorDueItems()).toEqual([]);
  });

  it("pomija wpisy bez wyniku, bo nie ma z czego policzyć terminu", () => {
    saveOrgScoped("pl_czynniki_szkodliwe", [
      { id: "c3", nazwa: "Amoniak", rodzaj: "chemiczny", wynik: "", wartoscDopuszczalna: "14", dataPomiaru: "2026-01-10" },
    ]);
    expect(collectHarmfulFactorDueItems()).toEqual([]);
  });
});
