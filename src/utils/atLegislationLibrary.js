/**
 * Austrian Arbeitsschutz / BauKG legislation reference — construction sources.
 */

export const AT_LEGISLATION_LIBRARY = [
  {
    id: "at_aschg",
    title: "ArbeitnehmerInnenschutzgesetz (ASchG)",
    category: "Grundlage",
    summary: "Evaluierung von Gefahren, Schutzmaßnahmen und Unterweisung der Beschäftigten.",
    url: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910",
    tags: ["ASchG", "Evaluierung", "Unterweisung"],
  },
  {
    id: "at_baukg",
    title: "Bauarbeitenkoordinationsgesetz (BauKG)",
    category: "Bau",
    summary: "SiGeKo, SiGe-Plan, Vorankündigung und Unterlage für spätere Arbeiten auf Baustellen.",
    url: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009027",
    tags: ["BauKG", "SiGe-Plan", "SiGeKo", "Vorankündigung"],
  },
  {
    id: "at_baukg_gefaehrlich",
    title: "BauKG — besonders gefährliche Arbeiten",
    category: "Bau",
    summary:
      "Besonders gefährliche Arbeiten im SiGe-Plan mit konkreten Maßnahmen und oft mit Arbeitsfreigabe/Erlaubnisschein benennen.",
    url: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009027",
    tags: ["BauKG", "Erlaubnisschein", "SiGe-Plan", "besonders gefährlich"],
  },
  {
    id: "at_auva",
    title: "AUVA — Unfallversicherung und Prävention",
    category: "UVT",
    summary: "Unfallanzeige, Prävention und Beratung für Baustellenbetriebe.",
    url: "https://www.auva.at/",
    tags: ["AUVA", "Unfallanzeige", "Prävention"],
  },
  {
    id: "at_amvo",
    title: "Arbeitsmittelverordnung (AM-VO)",
    category: "Anlagen",
    summary: "Sichere Verwendung und Prüfung von Arbeitsmitteln.",
    url: "https://www.ris.bka.gv.at/",
    tags: ["AM-VO", "Arbeitsmittel", "Prüfung"],
  },
  {
    id: "at_gstv",
    title: "Grenzwerteverordnung / Gefahrstoffe (prüfen)",
    category: "Gefahrstoffe",
    summary: "Ermittlung, Schutzmaßnahmen und Betriebsanweisung bei Gefahrstoffen — geltende VO prüfen.",
    url: "https://www.ris.bka.gv.at/",
    tags: ["Gefahrstoffe", "Betriebsanweisung", "Asbest"],
  },
  {
    id: "at_astvo",
    title: "Arbeitsstättenverordnung (AStV)",
    category: "Arbeitsstätte",
    summary: "Sozialräume, Verkehrswege und Anforderungen an Baustelleneinrichtungen.",
    url: "https://www.ris.bka.gv.at/",
    tags: ["AStV", "Sozialräume"],
  },
];

export function seedLegislationRegister() {
  const now = new Date().toISOString();
  return AT_LEGISLATION_LIBRARY.map((row, i) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    url: row.url,
    tags: row.tags,
    status: "current",
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}
