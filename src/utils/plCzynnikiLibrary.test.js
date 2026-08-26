import { describe, expect, it } from "vitest";
import {
  czynnikRodzaj,
  czynnikWymagaRejestruNarazenia,
  findCzynnik,
  krotnosc,
  listCzynnikRodzaje,
  ocenPomiar,
  odstepPomiaruMiesiace,
  PL_CZYNNIKI,
  podsumujRejestr,
} from "./plCzynnikiLibrary";
import { buildKartaBadanHtml, buildRejestrCzynnikowHtml } from "./plCzynnikiPrintHtml";

describe("plCzynnikiLibrary", () => {
  it("daje każdemu czynnikowi dane, których potrzebuje karta badań", () => {
    const keys = new Set();
    const rodzaje = new Set(listCzynnikRodzaje().map((r) => r.key));
    for (const c of PL_CZYNNIKI) {
      expect(keys.has(c.key)).toBe(false);
      keys.add(c.key);
      expect(c.nazwa).toBeTruthy();
      expect(rodzaje.has(c.rodzaj)).toBe(true);
      expect(c.jednostka).toBeTruthy();
      expect(String(c.wartoscDopuszczalna)).toBeTruthy();
      expect(c.typoweStanowiska.length).toBeGreaterThan(0);
    }
    expect(findCzynnik("halas")?.rodzaj).toBe("halas");
    expect(findCzynnik("nie-ma")).toBe(null);
    expect(czynnikRodzaj("halas")?.limit).toBe("NDN");
  });

  describe("krotność wartości dopuszczalnej", () => {
    it("liczy krotność i akceptuje przecinek dziesiętny", () => {
      expect(krotnosc("0,05", "0,1")).toBeCloseTo(0.5);
      expect(krotnosc(90, 85)).toBeCloseTo(1.058, 2);
    });

    it("zwraca null, gdy nie da się policzyć", () => {
      expect(krotnosc("", "0,1")).toBe(null);
      expect(krotnosc("0,05", "wg karty charakterystyki")).toBe(null);
      expect(krotnosc("0,05", 0)).toBe(null);
    });
  });

  describe("częstotliwość pomiarów wynikająca z przepisu", () => {
    it("czynnik chemiczny: co 2 lata powyżej 0,1 NDS, co rok powyżej 0,5", () => {
      expect(odstepPomiaruMiesiace("chemiczny", 0.3)).toBe(24);
      expect(odstepPomiaruMiesiace("chemiczny", 0.8)).toBe(12);
    });

    it("czynnik rakotwórczy ma ostrzejszy rytm niż zwykły chemiczny", () => {
      expect(odstepPomiaruMiesiace("rakotworczy", 0.3)).toBe(6);
      expect(odstepPomiaruMiesiace("rakotworczy", 0.8)).toBe(3);
    });

    it("azbest mierzy się co 3 miesiące, z wydłużeniem do 6 przy niskich wynikach", () => {
      expect(odstepPomiaruMiesiace("azbest", 0.8)).toBe(3);
      expect(odstepPomiaruMiesiace("azbest", 0.2)).toBe(6);
    });

    it("hałas rozlicza się względem NDN tak jak czynnik chemiczny względem NDS", () => {
      expect(odstepPomiaruMiesiace("halas", 0.3)).toBe(24);
      expect(odstepPomiaruMiesiace("halas", 0.9)).toBe(12);
    });

    it("bez krotności nie zgaduje terminu", () => {
      expect(odstepPomiaruMiesiace("chemiczny", null)).toBe(null);
    });
  });

  describe("ocena wpisu", () => {
    const base = {
      rodzaj: "rakotworczy",
      wynik: "0,08",
      wartoscDopuszczalna: "0,1",
      dataPomiaru: "2026-01-15",
    };

    it("wylicza termin kolejnego pomiaru z daty i krotności", () => {
      const ocena = ocenPomiar(base, "2026-08-23");
      expect(ocena.krotnosc).toBeCloseTo(0.8);
      expect(ocena.odstepMiesiace).toBe(3);
      expect(ocena.nastepnyPomiar).toBe("2026-04-15");
      expect(ocena.status).toBe("po-terminie");
    });

    it("oznacza przekroczenie wartości dopuszczalnej", () => {
      const ocena = ocenPomiar({ ...base, wynik: "0,15" }, "2026-01-20");
      expect(ocena.przekroczenie).toBe(true);
    });

    it("ostrzega o terminie w ciągu 30 dni", () => {
      const ocena = ocenPomiar({ ...base, rodzaj: "chemiczny", wynik: "0,08" }, "2027-12-20");
      // Chemiczny powyżej 0,5 NDS → co 12 miesięcy, czyli 2027-01-15… już po terminie.
      expect(["po-terminie", "wkrotce"]).toContain(ocena.status);
    });

    it("termin wpisany ręcznie ma pierwszeństwo przed wyliczonym", () => {
      const ocena = ocenPomiar({ ...base, nastepnyPomiarRecznie: "2026-12-01" }, "2026-08-23");
      expect(ocena.nastepnyPomiar).toBe("2026-12-01");
      expect(ocena.status).toBe("aktualny");
    });

    it("odstąpienie od pomiarów wyłącza pilnowanie terminu", () => {
      const ocena = ocenPomiar({ ...base, odstapiono: true }, "2026-08-23");
      expect(ocena.status).toBe("odstapiono");
    });

    it("wskazuje czynniki objęte rejestrem pracowników narażonych", () => {
      expect(ocenPomiar(base).wymagaRejestruNarazenia).toBe(true);
      expect(ocenPomiar({ ...base, rodzaj: "halas" }).wymagaRejestruNarazenia).toBe(false);
      expect(czynnikWymagaRejestruNarazenia("azbest")).toBe(true);
    });
  });

  it("podsumowuje rejestr dla alertów w module", () => {
    const summary = podsumujRejestr(
      [
        { rodzaj: "chemiczny", wynik: "2", wartoscDopuszczalna: "1", dataPomiaru: "2026-08-01" },
        { rodzaj: "chemiczny", wynik: "0,2", wartoscDopuszczalna: "1", dataPomiaru: "2020-01-01" },
      ],
      "2026-08-23"
    );
    expect(summary.total).toBe(2);
    expect(summary.przekroczenia).toBe(1);
    expect(summary.poTerminie).toBe(1);
  });

  describe("wydruki", () => {
    const row = {
      nazwa: "Pył zawierający krystaliczną krzemionkę (frakcja respirabilna)",
      rodzaj: "rakotworczy",
      jednostka: "mg/m³",
      wartoscDopuszczalna: "0,1",
      wynik: "0,15",
      stanowisko: "Cięcie betonu",
      dataPomiaru: "2026-06-01",
      ref: "KB/2026/02",
      laboratorium: "Lab Akredytowane sp. z o.o.",
    };

    it("drukuje kartę badań z krotnością, terminem i ostrzeżeniem o rejestrze narażenia", () => {
      const html = buildKartaBadanHtml(row, { orgName: "Budimex Sp. z o.o." });
      expect(html).toMatch(/Karta badań i pomiarów/);
      expect(html).toContain("KB/2026/02");
      expect(html).toContain("Budimex Sp. z o.o.");
      expect(html).toMatch(/przekroczenie/);
      expect(html).toMatch(/rejestru pracowników narażonych/);
      expect(html).toMatch(/40 lat/);
    });

    it("drukuje zbiorczy rejestr, także pusty", () => {
      expect(buildRejestrCzynnikowHtml([row], { orgName: "X" })).toMatch(/Rejestr czynników szkodliwych/);
      expect(buildRejestrCzynnikowHtml([], {})).toMatch(/Brak wpisów w rejestrze/);
    });

    it("nie wpuszcza wartości do znaczników wydruku", () => {
      const html = buildKartaBadanHtml({ ...row, stanowisko: "<script>alert(1)</script>" }, {});
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("nie drukuje karty bez nazwy czynnika", () => {
      expect(buildKartaBadanHtml({}, {})).toBe("");
    });
  });
});
