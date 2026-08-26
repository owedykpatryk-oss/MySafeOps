/**
 * German Arbeitsschutz legislation reference — core construction sources.
 */

export const DE_LEGISLATION_LIBRARY = [
  {
    id: "de_arbschg",
    title: "Arbeitsschutzgesetz (ArbSchG)",
    category: "Grundlage",
    summary: "Grundpflichten des Arbeitgebers, Gefährdungsbeurteilung (§ 5) und Unterweisung.",
    url: "https://www.gesetze-im-internet.de/arbschg/",
    tags: ["ArbSchG", "Gefährdungsbeurteilung", "Unterweisung"],
  },
  {
    id: "de_baustellv",
    title: "Baustellenverordnung (BaustellV)",
    category: "Bau",
    summary: "SiGeKo, SiGe-Plan, Vorankündigung und Unterlage für spätere Arbeiten.",
    url: "https://www.gesetze-im-internet.de/baustellv/",
    tags: ["BaustellV", "SiGe-Plan", "SiGeKo", "Vorankündigung"],
  },
  {
    id: "de_baustellv_anhang_ii",
    title: "BaustellV Anhang II — besonders gefährliche Arbeiten",
    category: "Bau",
    summary:
      "Absturz, Verschüttung, Explosion, Gefahrstoffe, Hochspannung, Abbruch, Fertigteilmontage u. a. — im SiGe-Plan mit konkreten Maßnahmen und oft mit Erlaubnisschein/Freigabe.",
    url: "https://www.gesetze-im-internet.de/baustellv/",
    tags: ["Anhang II", "Erlaubnisschein", "SiGe-Plan", "besonders gefährlich"],
  },
  {
    id: "de_baua_baustellv",
    title: "BAuA — Baustellenverordnung Praxis",
    category: "Leitfaden",
    summary: "Behördliche Erläuterungen zu SiGe-Plan, Vorankündigung und Unterrichtung bei einem Arbeitgeber.",
    url: "https://www.baua.de/DE/Themen/Arbeitsgestaltung/Arbeitsstaetten/Bauwirtschaft/Baustellenverordnung.html",
    tags: ["BAuA", "Leitfaden", "SiGe-Plan"],
  },
  {
    id: "de_betrsichv",
    title: "Betriebssicherheitsverordnung (BetrSichV)",
    category: "Anlagen",
    summary: "Sichere Verwendung von Arbeitsmitteln, Prüfung und Erlaubnis.",
    url: "https://www.gesetze-im-internet.de/betrsichv_2015/",
    tags: ["BetrSichV", "Arbeitsmittel", "Prüfung"],
  },
  {
    id: "de_gefstoffv",
    title: "Gefahrstoffverordnung (GefStoffV)",
    category: "Gefahrstoffe",
    summary: "Ermittlung, Schutzmaßnahmen und Betriebsanweisung bei Gefahrstoffen.",
    url: "https://www.gesetze-im-internet.de/gefstoffv_2010/",
    tags: ["GefStoffV", "Betriebsanweisung", "Asbest"],
  },
  {
    id: "de_dguv1",
    title: "DGUV Vorschrift 1 — Grundsätze der Prävention",
    category: "UVT",
    summary: "Pflichten gegenüber dem Unfallversicherungsträger, Unterweisung, Erste Hilfe.",
    url: "https://www.dguv.de/",
    tags: ["DGUV", "BG BAU", "Unfallanzeige"],
  },
  {
    id: "de_arbstaettv",
    title: "Arbeitsstättenverordnung (ArbStättV)",
    category: "Arbeitsstätte",
    summary: "Sozialräume, Verkehrswege und Anforderungen an Baustelleneinrichtungen.",
    url: "https://www.gesetze-im-internet.de/arbst_ttv_2004/",
    tags: ["ArbStättV", "Sozialräume"],
  },
];

export function seedLegislationRegister() {
  const now = new Date().toISOString();
  return DE_LEGISLATION_LIBRARY.map((row, i) => ({
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
