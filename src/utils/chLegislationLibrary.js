/**
 * Swiss Arbeitssicherheit / BauAV legislation reference — construction sources.
 */

export const CH_LEGISLATION_LIBRARY = [
  {
    id: "ch_arg",
    title: "Arbeitsgesetz (ArG) und Verordnungen (ArGV 1–4)",
    category: "Grundlage",
    summary: "Gesundheitsschutz, Arbeits- und Ruhezeiten, Sonderschutz bei Bauarbeiten.",
    url: "https://www.fedlex.admin.ch/eli/cc/1966/57_57_57/de",
    tags: ["ArG", "ArGV", "Gesundheitsschutz"],
  },
  {
    id: "ch_bauav",
    title: "Bauarbeitenverordnung (BauAV)",
    category: "Bau",
    summary: "SiKo vor Baubeginn, Notfallorganisation und Schutzmassnahmen auf Baustellen (Art. 4).",
    url: "https://www.fedlex.admin.ch/eli/cc/2021/384/de",
    tags: ["BauAV", "SiKo", "Notfallorganisation"],
  },
  {
    id: "ch_bauav_gefaehrlich",
    title: "BauAV — besonders gefährliche Arbeiten",
    category: "Bau",
    summary:
      "Besonders gefährliche Arbeiten im SiKo mit konkreten Massnahmen und oft mit Freigabe benennen.",
    url: "https://www.fedlex.admin.ch/eli/cc/2021/384/de",
    tags: ["BauAV", "Freigabe", "SiKo", "besonders gefährlich"],
  },
  {
    id: "ch_suva",
    title: "Suva — Unfallversicherung und Prävention",
    category: "Versicherer",
    summary: "Unfallmeldung, Prävention, Betriebskontrolle und Prämienfolgen für Baustellenbetriebe.",
    url: "https://www.suva.ch/",
    tags: ["Suva", "Unfallmeldung", "Prävention"],
  },
  {
    id: "ch_vuv",
    title: "Verordnung über die Unfallverhütung (VUV)",
    category: "Anlagen",
    summary: "Organisation der Arbeitssicherheit, Fachpersonen und Pflichten der Arbeitgeber.",
    url: "https://www.fedlex.admin.ch/eli/cc/1983/1969_1969_1969/de",
    tags: ["VUV", "Arbeitssicherheit", "Fachperson"],
  },
  {
    id: "ch_ekas",
    title: "EKAS-Richtlinien",
    category: "Gefahrstoffe",
    summary: "Branchenspezifische Richtlinien der Eidg. Koordinationskommission für Arbeitssicherheit.",
    url: "https://www.ekas.ch/",
    tags: ["EKAS", "Richtlinien", "Branchenlösung"],
  },
  {
    id: "ch_argv3",
    title: "ArGV 3 — Gesundheitsvorsorge",
    category: "Arbeitsstätte",
    summary: "Sozialräume, Verkehrswege und Anforderungen an Baustelleneinrichtungen.",
    url: "https://www.fedlex.admin.ch/eli/cc/1966/57_57_57/de",
    tags: ["ArGV 3", "Sozialräume"],
  },
];

export function seedLegislationRegister() {
  const now = new Date().toISOString();
  return CH_LEGISLATION_LIBRARY.map((row, i) => ({
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
