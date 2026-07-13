/**
 * Polish BHP legislation reference — core construction sources.
 */

export const PL_LEGISLATION_LIBRARY = [
  {
    id: "pl_kp_art209",
    title: "Kodeks pracy — obowiązki pracodawcy (art. 207–211)",
    category: "Podstawa prawna",
    summary: "Ogólne obowiązki pracodawcy w zakresie BHP, oceny ryzyka i szkoleń.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19740240141",
    tags: ["kodeks pracy", "BHP", "ocena ryzyka"],
  },
  {
    id: "pl_roz_bhp_podst",
    title: "Rozporządzenie — ogólne przepisy BHP",
    category: "Rozporządzenie",
    summary: "Podstawowe wymagania BHP w zakresie organizacji, szkoleń i środków ochrony.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19970660332",
    tags: ["rozporządzenie", "szkolenia BHP"],
  },
  {
    id: "pl_roz_bhp_bud",
    title: "Rozporządzenie — BHP przy pracach budowlanych",
    category: "Budownictwo",
    summary: "Plan BHP, koordynacja, roboty szczególnie niebezpieczne, IOR na budowie.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20031271358",
    tags: ["budownictwo", "plan BHP", "IOR"],
  },
  {
    id: "pl_pip",
    title: "Państwowa Inspekcja Pracy (PIP)",
    category: "Nadzór",
    summary: "Zgłaszanie wypadków przy pracy i kontrola przestrzegania przepisów BHP.",
    url: "https://www.gov.pl/web/pip",
    tags: ["PIP", "wypadek", "kontrola"],
  },
  {
    id: "pl_roz_pozw_praca",
    title: "Rozporządzenie — prace szczególnie niebezpieczne",
    category: "Pozwolenie na pracę",
    summary: "Wykaz prac wymagających pisemnego pozwolenia i uprawnień.",
    url: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU2002015012",
    tags: ["pozwolenie na pracę", "prace szczególnie niebezpieczne"],
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
