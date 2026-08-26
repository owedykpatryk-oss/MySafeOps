import { describe, expect, it } from "vitest";
import {
  autofillFromIncident,
  autofillFromOrzCard,
  autofillFromWorker,
  buildPlFormValues,
  initialPlFormValues,
  nextPlFormRef,
  szkolenieOkresoweWaznoscDo,
} from "./plFormsAutofill";

const ORZ_CARD = {
  stanowisko: "Monter rusztowań",
  opis: "Montaż i demontaż rusztowań ramowych",
  zagrozenia: [
    { czynnik: "Upadek z wysokości", zrodlo: "Praca na pomoście powyżej 3 m", skutki: "Uraz", prawdopodobienstwo: "średnie", ciezkosc: "duża", srodki: ["Szelki"] },
    { czynnik: "Hałas", zrodlo: "Praca w pobliżu maszyn", skutki: "Ubytek słuchu", prawdopodobienstwo: "duże", ciezkosc: "średnia", srodki: ["Ochronniki"] },
    { czynnik: "Pył krzemionkowy", zrodlo: "Cięcie materiałów", skutki: "Pylica", prawdopodobienstwo: "średnie", ciezkosc: "duża", srodki: ["FFP3"] },
    { czynnik: "Dźwiganie", zrodlo: "Ręczny transport elementów", skutki: "Uraz kręgosłupa", prawdopodobienstwo: "duże", ciezkosc: "średnia", srodki: ["Transport zespołowy"] },
  ],
};

describe("plFormsAutofill", () => {
  describe("numeracja druków", () => {
    it("zaczyna od pierwszego numeru w danym roku", () => {
      expect(nextPlFormRef("skierowanie_badania", [], "2026-08-23")).toBe("SK/2026/01");
    });

    it("liczy dalej po istniejących drukach tego samego rodzaju", () => {
      const existing = [
        { formKey: "skierowanie_badania", ref: "SK/2026/01" },
        { formKey: "skierowanie_badania", ref: "SK/2026/07" },
        { formKey: "karta_wypadku", ref: "KW/2026/12" },
        { formKey: "skierowanie_badania", ref: "SK/2025/99" },
      ];
      expect(nextPlFormRef("skierowanie_badania", existing, "2026-08-23")).toBe("SK/2026/08");
      // Inny rodzaj druku ma własną numerację.
      expect(nextPlFormRef("karta_wypadku", existing, "2026-08-23")).toBe("KW/2026/13");
    });

    it("ignoruje numery wpisane ręcznie w innym formacie", () => {
      const existing = [{ formKey: "karta_odziezy", ref: "moja-własna-numeracja" }];
      expect(nextPlFormRef("karta_odziezy", existing, "2026-08-23")).toBe("KEW/2026/01");
    });
  });

  it("ustawia daty wystawienia na dziś, ale nie zgaduje dat zdarzeń", () => {
    const values = initialPlFormValues("skierowanie_badania", { today: "2026-08-23" });
    expect(values.dataWystawienia).toBe("2026-08-23");
    const wypadek = initialPlFormValues("protokol_powypadkowy", { today: "2026-08-23" });
    expect(wypadek.dataSporzadzenia).toBe("2026-08-23");
    expect(wypadek.dataZdarzenia).toBeUndefined();
  });

  it("przenosi dane pracownika do pól osobowych", () => {
    const values = autofillFromWorker("karta_szkolenia_wstepnego", { name: "Anna Nowak", role: "Cieśla" });
    expect(values.imieNazwisko).toBe("Anna Nowak");
    expect(values.stanowisko).toBe("Cieśla");
  });

  it("nie nadpisuje tego, co ktoś już wpisał ręcznie", () => {
    const values = autofillFromWorker(
      "karta_szkolenia_wstepnego",
      { name: "Anna Nowak", role: "Cieśla" },
      { stanowisko: "Brygadzista" }
    );
    expect(values.stanowisko).toBe("Brygadzista");
    expect(values.imieNazwisko).toBe("Anna Nowak");
  });

  describe("karta ORZ → skierowanie na badania", () => {
    it("rozdziela czynniki na grupy, których oczekuje lekarz medycyny pracy", () => {
      const values = autofillFromOrzCard("skierowanie_badania", ORZ_CARD);
      expect(values.stanowisko).toBe("Monter rusztowań");
      expect(values.czynnikiFizyczne).toMatch(/Hałas/);
      expect(values.czynnikiPylowe).toMatch(/Pył krzemionkowy/);
      expect(values.czynnikiUciazliwe).toMatch(/Dźwiganie/);
    });

    it("zaznacza pracę na wysokości i obsługę maszyn na podstawie zagrożeń", () => {
      const values = autofillFromOrzCard("skierowanie_badania", ORZ_CARD);
      expect(values.wysokosc).toBe(true);
      expect(values.maszyny).toBeUndefined();
    });

    it("nie rusza druków innych niż skierowanie", () => {
      expect(autofillFromOrzCard("karta_wypadku", ORZ_CARD, { a: 1 })).toEqual({ a: 1 });
    });
  });

  describe("zdarzenie → druk powypadkowy", () => {
    const incident = {
      id: "inc_1",
      ref: "INC-2026-004",
      occurredAt: "2026-08-20T14:35",
      location: "Poziom -1, szyb windowy",
      description: "Upadek elementu szalunku na stopę pracownika",
      injuryDetail: "Stłuczenie śródstopia",
      personName: "Jan Kowalski",
    };

    it("rozdziela datę i godzinę tam, gdzie druk ma osobne pola", () => {
      const values = autofillFromIncident("zgloszenie_wypadku_pracownika", incident);
      expect(values.dataZdarzenia).toBe("2026-08-20");
      expect(values.godzina).toBe("14:35");
      expect(values.miejsce).toBe("Poziom -1, szyb windowy");
      expect(values.przebieg).toMatch(/szalunku/);
      expect(values.imieNazwisko).toBe("Jan Kowalski");
    });

    it("łączy datę z godziną tam, gdzie druk ma jedno pole", () => {
      const values = autofillFromIncident("protokol_powypadkowy", incident);
      expect(values.dataZdarzenia).toBe("2026-08-20 14:35");
      expect(values.okolicznosci).toMatch(/szalunku/);
      expect(values.numerProtokolu).toBe("INC-2026-004");
    });
  });

  describe("druki higieniczne — lista ekipy", () => {
    it("dopisuje kolejne osoby zamiast nadpisywać poprzednią", () => {
      let values = autofillFromWorker("zezwolenie_strefa_produkcyjna", { name: "Jan Kowalski", role: "Monter" });
      expect(values.osobyWchodzace).toBe("Jan Kowalski — Monter");
      values = autofillFromWorker("zezwolenie_strefa_produkcyjna", { name: "Anna Nowak", role: "Spawacz" }, values);
      expect(values.osobyWchodzace).toBe("Jan Kowalski — Monter\nAnna Nowak — Spawacz");
    });

    it("nie dubluje tej samej osoby", () => {
      const worker = { name: "Jan Kowalski", role: "Monter" };
      let values = autofillFromWorker("zezwolenie_strefa_produkcyjna", worker);
      values = autofillFromWorker("zezwolenie_strefa_produkcyjna", worker, values);
      expect(values.osobyWchodzace).toBe("Jan Kowalski — Monter");
    });
  });

  describe("ważność szkolenia okresowego", () => {
    it("liczy 3 lata dla stanowisk robotniczych i 5 dla kierowniczych", () => {
      expect(szkolenieOkresoweWaznoscDo("pracownicy na stanowiskach robotniczych", "2026-08-23")).toBe("2029-08-23");
      expect(szkolenieOkresoweWaznoscDo("pracodawcy i inne osoby kierujące pracownikami", "2026-08-23")).toBe("2031-08-23");
      expect(szkolenieOkresoweWaznoscDo("pracownicy administracyjno-biurowi", "2026-08-23")).toBe("2032-08-23");
    });

    it("nie zgaduje przy braku daty", () => {
      expect(szkolenieOkresoweWaznoscDo("pracownicy na stanowiskach robotniczych", "")).toBe("");
    });

    it("wypełnia pole ważności przy składaniu druku", () => {
      const values = buildPlFormValues("zaswiadczenie_okresowe", {
        values: { grupaStanowisk: "pracownicy na stanowiskach robotniczych", dataDo: "2026-08-23" },
      });
      expect(values.waznoscDo).toBe("2029-08-23");
    });
  });

  it("składa komplet wartości z kilku źródeł naraz", () => {
    const values = buildPlFormValues("skierowanie_badania", {
      today: "2026-08-23",
      worker: { name: "Anna Nowak", role: "Cieśla" },
      orzCard: ORZ_CARD,
    });
    expect(values.dataWystawienia).toBe("2026-08-23");
    expect(values.imieNazwisko).toBe("Anna Nowak");
    // Pracownik wchodzi pierwszy, więc jego stanowisko wygrywa z tym z karty ORZ.
    expect(values.stanowisko).toBe("Cieśla");
    expect(values.czynnikiPylowe).toMatch(/krzemionkowy/);
  });
});
