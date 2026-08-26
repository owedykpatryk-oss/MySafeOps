/**
 * Polish BHP legislation reference — akty, które realnie trafiają do IBWR, planu BIOZ
 * i rejestru przepisów na budowie. Linki prowadzą do ISAP (tekst pierwotny; sprawdź
 * obowiązujący tekst jednolity przed powołaniem się w dokumencie).
 */

export const PL_LEGISLATION_LIBRARY = [
  {
    id: "pl_kp_art209",
    title: "Kodeks pracy — dział X BHP (art. 207–2374)",
    category: "Podstawa prawna",
    summary:
      "Obowiązki pracodawcy, ocena ryzyka zawodowego, szkolenia, środki ochrony indywidualnej i prawo powstrzymania się od pracy.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19740240141",
    tags: ["kodeks pracy", "BHP", "ocena ryzyka"],
  },
  {
    id: "pl_roz_bhp_podst",
    title: "Rozporządzenie — ogólne przepisy BHP",
    category: "Rozporządzenie",
    summary:
      "Dz.U. 1997 nr 129 poz. 844 (tekst jedn. Dz.U. 2003 nr 169 poz. 1650) — organizacja pracy, pomieszczenia, ŚOI, zaplecze higienicznosanitarne.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19971290844",
    tags: ["rozporządzenie", "ŚOI", "zaplecze"],
  },
  {
    id: "pl_roz_pozw_praca",
    title: "Prace szczególnie niebezpieczne (§ 80–88 ogólnych przepisów BHP)",
    category: "Pozwolenie na pracę",
    summary:
      "Wymóg bezpośredniego nadzoru, instruktażu stanowiskowego i pisemnego pozwolenia dla prac szczególnie niebezpiecznych — podstawa systemu PTW.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19971290844",
    tags: ["pozwolenie na pracę", "prace szczególnie niebezpieczne", "nadzór"],
  },
  {
    id: "pl_roz_bhp_bud",
    title: "Rozporządzenie — BHP podczas wykonywania robót budowlanych",
    category: "Budownictwo",
    summary:
      "Dz.U. 2003 nr 47 poz. 401 — zagospodarowanie placu budowy, rusztowania, wykopy, roboty na wysokości, IBWR dla robót szczególnie niebezpiecznych.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20030470401",
    tags: ["budownictwo", "IBWR", "rusztowania", "wykopy"],
  },
  {
    id: "pl_roz_bioz",
    title: "Rozporządzenie — informacja BIOZ i plan BIOZ",
    category: "Budownictwo",
    summary:
      "Dz.U. 2003 nr 120 poz. 1126 — zakres informacji BIOZ sporządzanej przez projektanta i planu BIOZ przygotowywanego przez kierownika budowy.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20031201126",
    tags: ["plan BIOZ", "informacja BIOZ", "kierownik budowy"],
  },
  {
    id: "pl_prawo_budowlane",
    title: "Ustawa — Prawo budowlane",
    category: "Budownictwo",
    summary:
      "Obowiązki uczestników procesu budowlanego, kierownik budowy, dziennik budowy, zawiadomienie o rozpoczęciu robót.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19940890414",
    tags: ["prawo budowlane", "kierownik budowy", "dziennik budowy"],
  },
  {
    id: "pl_szkolenia_bhp",
    title: "Rozporządzenie — szkolenie w dziedzinie BHP",
    category: "Kompetencje",
    summary:
      "Szkolenie wstępne (instruktaż ogólny i stanowiskowy) oraz okresowe — częstotliwość zależna od stanowiska; karta szkolenia wstępnego.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20041801860",
    tags: ["szkolenie BHP", "instruktaż", "okresowe"],
  },
  {
    id: "pl_badania_lekarskie",
    title: "Rozporządzenie — badania profilaktyczne pracowników",
    category: "Kompetencje",
    summary:
      "Badania wstępne, okresowe i kontrolne, skierowanie i orzeczenie lekarskie — w tym zdolność do pracy na wysokości powyżej 3 m.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19960690332",
    tags: ["badania lekarskie", "orzeczenie", "praca na wysokości"],
  },
  {
    id: "pl_sluzba_bhp",
    title: "Rozporządzenie — służba bezpieczeństwa i higieny pracy",
    category: "Organizacja",
    summary: "Zadania i uprawnienia służby BHP, wymagane kwalifikacje, obowiązek powołania w zależności od zatrudnienia.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19971090704",
    tags: ["służba BHP", "behapowiec", "organizacja"],
  },
  {
    id: "pl_pip_ustawa",
    title: "Ustawa o Państwowej Inspekcji Pracy",
    category: "Nadzór",
    summary: "Uprawnienia inspektorów, zakres kontroli, obowiązki pracodawcy wobec PIP.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20070890589",
    tags: ["PIP", "kontrola", "inspektor pracy"],
  },
  {
    id: "pl_pip",
    title: "Państwowa Inspekcja Pracy (PIP)",
    category: "Nadzór",
    summary: "Zgłaszanie śmiertelnych, ciężkich i zbiorowych wypadków przy pracy oraz strona kontroli i wytycznych.",
    url: "https://www.gov.pl/web/pip",
    tags: ["PIP", "wypadek", "zgłoszenie"],
  },
  {
    id: "pl_wypadki_okolicznosci",
    title: "Rozporządzenie — ustalanie okoliczności i przyczyn wypadków przy pracy",
    category: "Wypadki",
    summary: "Zespół powypadkowy, terminy, dokumentowanie i rejestr wypadków przy pracy.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20091050870",
    tags: ["wypadek", "zespół powypadkowy", "rejestr"],
  },
  {
    id: "pl_protokol_powypadkowy",
    title: "Rozporządzenie — wzór protokołu powypadkowego",
    category: "Wypadki",
    summary: "Obowiązujący wzór protokołu ustalenia okoliczności i przyczyn wypadku przy pracy.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20190001071",
    tags: ["protokół powypadkowy", "wzór"],
  },
  {
    id: "pl_statystyczna_karta",
    title: "Rozporządzenie — statystyczna karta wypadku przy pracy",
    category: "Wypadki",
    summary: "Wzór i terminy przekazania statystycznej karty wypadku (Z-KW) do GUS.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20090140080",
    tags: ["Z-KW", "GUS", "statystyka"],
  },
  {
    id: "pl_maszyny_roboty_ziemne",
    title: "Rozporządzenie — maszyny do robót ziemnych, budowlanych i drogowych",
    category: "Maszyny",
    summary:
      "Wymagania eksploatacyjne i uprawnienia operatorów maszyn budowlanych (książka operatora, klasy uprawnień).",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20011181263",
    tags: ["operator", "maszyny budowlane", "książka operatora"],
  },
  {
    id: "pl_maszyny_min_wymagania",
    title: "Rozporządzenie — minimalne wymagania BHP przy użytkowaniu maszyn",
    category: "Maszyny",
    summary: "Kontrole maszyn po instalacji i okresowe, osłony, urządzenia ochronne, dostosowanie maszyn starszych.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20021911596",
    tags: ["maszyny", "kontrola", "osłony"],
  },
  {
    id: "pl_dozor_techniczny",
    title: "Ustawa o dozorze technicznym (UDT)",
    category: "Maszyny",
    summary:
      "Urządzenia podlegające dozorowi (żurawie, podesty ruchome, wózki jezdniowe), decyzje eksploatacyjne i kwalifikacje obsługi.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20001221321",
    tags: ["UDT", "żuraw", "podest ruchomy", "wózek jezdniowy"],
  },
  {
    id: "pl_kwalifikacje_sep",
    title: "Rozporządzenie — kwalifikacje przy eksploatacji urządzeń, instalacji i sieci",
    category: "Kompetencje",
    summary: "Świadectwa kwalifikacyjne E i D w grupach G1 (elektryczne), G2 (cieplne) i G3 (gazowe) — potocznie SEP.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20220001392",
    tags: ["SEP", "G1", "G2", "G3", "kwalifikacje"],
  },
  {
    id: "pl_azbest_uzytkowanie",
    title: "Rozporządzenie — bezpieczne użytkowanie i usuwanie wyrobów zawierających azbest",
    category: "Substancje niebezpieczne",
    summary: "Ocena stanu wyrobów, zgłoszenie prac, oznakowanie strefy i przekazanie odpadów azbestowych.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20040710649",
    tags: ["azbest", "zgłoszenie", "odpady"],
  },
  {
    id: "pl_azbest_prace",
    title: "Rozporządzenie — BHP przy zabezpieczaniu i usuwaniu azbestu",
    category: "Substancje niebezpieczne",
    summary: "Zasady prowadzenia prac, ŚOI, dekontaminacja i program szkolenia dla pracowników przy azbeście.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20052161824",
    tags: ["azbest", "szkolenie", "dekontaminacja"],
  },
  {
    id: "pl_nds_ndn",
    title: "Rozporządzenie — NDS i NDN czynników szkodliwych",
    category: "Czynniki szkodliwe",
    summary: "Najwyższe dopuszczalne stężenia i natężenia — podstawa pomiarów pyłu (krzemionka), hałasu i drgań.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20180001286",
    tags: ["NDS", "NDN", "pomiary", "krzemionka"],
  },
  {
    id: "pl_badania_pomiary",
    title: "Rozporządzenie — badania i pomiary czynników szkodliwych",
    category: "Czynniki szkodliwe",
    summary:
      "Częstotliwość badań zależna od krotności NDS/NDN, rejestr czynników i karty badań przechowywane 40 lat, pierwsze pomiary w ciągu 30 dni od rozpoczęcia działalności.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20110330166",
    tags: ["pomiary", "rejestr czynników", "karta badań", "NDS", "NDN"],
  },
  {
    id: "pl_halas_drgania",
    title: "Rozporządzenie — hałas i drgania mechaniczne",
    category: "Czynniki szkodliwe",
    summary: "Wartości progów działania, obowiązek pomiarów, ochronniki słuchu i ograniczanie ekspozycji na drgania.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20051571318",
    tags: ["hałas", "drgania", "ochronniki"],
  },
  {
    id: "pl_reczne_prace",
    title: "Rozporządzenie — ręczne prace transportowe",
    category: "Czynniki szkodliwe",
    summary: "Dopuszczalne masy przy podnoszeniu i przenoszeniu, organizacja pracy i środki pomocnicze.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20000260313",
    tags: ["ręczne prace transportowe", "dźwiganie"],
  },
  {
    id: "pl_ppoz_budynki",
    title: "Rozporządzenie — ochrona przeciwpożarowa budynków i terenów",
    category: "Ochrona przeciwpożarowa",
    summary:
      "Warunki prowadzenia prac niebezpiecznych pożarowo, drogi ewakuacyjne, gaśnice i instrukcja bezpieczeństwa pożarowego.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20101090719",
    tags: ["prace pożarowo niebezpieczne", "ewakuacja", "gaśnice"],
  },
];

export function seedLegislationRegister() {
  const now = new Date().toISOString();
  return PL_LEGISLATION_LIBRARY.map((row, i) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    url: row.url,
    tags: row.tags,
    status: "reference",
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}
