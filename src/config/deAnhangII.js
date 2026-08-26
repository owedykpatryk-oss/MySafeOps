/**
 * BaustellV Anhang II — besonders gefährliche Arbeiten.
 * Used for SiGe-Plan prompts, permit recommendations, and DE landing education.
 * Confirm wording against current BaustellV Anhang II before regulatory claims.
 */

/** @typedef {{ id: string; label: string; short: string; permitTypeIds: string[]; gbuHint: string }} DeAnhangIIItem */

/** @type {DeAnhangIIItem[]} */
export const DE_ANHANG_II_WORKS = [
  {
    id: "fall",
    label: "Absturzgefährdung (z. B. Arbeiten in Höhen über 7 m oder auf Dächern)",
    short: "Absturz",
    permitTypeIds: ["work_at_height", "roof_access"],
    gbuHint: "Seitenschutz, PSA gegen Absturz, Rettungsplan, Sperrzone unter der Arbeitsstelle.",
  },
  {
    id: "burial",
    label: "Verschüttungsgefahr (Baugruben, Gräben, Untertage)",
    short: "Verschüttung",
    permitTypeIds: ["excavation", "ground_disturbance", "confined_space"],
    gbuHint: "Verbau / Böschung, Einstieg, Gas- und Wassereinbruch, Leitungsortung vor dem Aufbruch.",
  },
  {
    id: "explosives",
    label: "Arbeiten mit Explosivstoffen oder explosionsgefährlicher Atmosphäre",
    short: "Explosion",
    permitTypeIds: ["hot_work", "confined_space"],
    gbuHint: "Ex-Zone, Freimessen, Heißarbeitsfreigabe, Brandwache.",
  },
  {
    id: "diving",
    label: "Taucherarbeiten",
    short: "Tauchen",
    permitTypeIds: ["general", "confined_space"],
    gbuHint: "Spezialunternehmen, Notfallrettung, Freigabe vor Einsatz.",
  },
  {
    id: "pressure",
    label: "Arbeiten in Druckluft",
    short: "Druckluft",
    permitTypeIds: ["confined_space", "general"],
    gbuHint: "Druckregime, medizinische Tauglichkeit, Notfallorganisation.",
  },
  {
    id: "chemical",
    label: "Arbeiten mit Gefahrstoffen / gesundheitsgefährdenden Stoffen (inkl. Asbest)",
    short: "Gefahrstoffe",
    permitTypeIds: ["hot_work", "confined_space", "general"],
    gbuHint: "GefStoffV-Betriebsanweisung, Erkundung, PSA, Entsorgung.",
  },
  {
    id: "ionising",
    label: "Arbeiten mit ionisierender Strahlung",
    short: "Strahlung",
    permitTypeIds: ["radiography", "general"],
    gbuHint: "Sperrzone, Dosimetrie, Freigabe der Durchstrahlung.",
  },
  {
    id: "hv",
    label: "Arbeiten in der Nähe von Hochspannungsleitungen",
    short: "Hochspannung",
    permitTypeIds: ["electrical", "line_clearance", "lifting"],
    gbuHint: "Annäherungsgrenzen, Freischaltung wo möglich, Einweisung.",
  },
  {
    id: "demolition",
    label: "Abbruch von tragenden Bauteilen / Bauwerken",
    short: "Abbruch",
    permitTypeIds: ["general", "lifting", "work_at_height"],
    gbuHint: "Abbruchkonzept, Standsicherheit, Sperrzonen, Staub/Asbest.",
  },
  {
    id: "assembly",
    label: "Montage oder Demontage von schweren Fertigteilen",
    short: "Fertigteile",
    permitTypeIds: ["lifting", "work_at_height"],
    gbuHint: "Hebeplan, Anschläger, Ausschlusszone, Wettergrenzen.",
  },
];

/** @param {string} permitTypeId */
export function anhangIIItemsForPermit(permitTypeId) {
  const id = String(permitTypeId || "");
  return DE_ANHANG_II_WORKS.filter((item) => item.permitTypeIds.includes(id));
}

/** Short checklist labels for SiGe-Plan UI. */
export function deAnhangIIChecklistLabels() {
  return DE_ANHANG_II_WORKS.map((item) => `${item.short}: ${item.label}`);
}
