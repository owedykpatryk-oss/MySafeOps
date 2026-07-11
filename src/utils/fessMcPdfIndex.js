/**
 * FESS MC reference PDF index — maps all 22 files in DOCS/FESS/Rams/MC to job starters.
 */
import { FESS_JOB_STARTERS } from "./fessJobStarters";
import { canUseFessExclusiveFeatures } from "./fessExclusive";

/** Canonical list of MC folder PDFs (22 reference jobs). */
export const FESS_MC_PDF_FILES = [
  "2SFG FLIXTON GRILLE M&E.pdf",
  "2SFG RA 2SFG FLIXTON GRILLS MECHANICAL AND ELECTRICAL WORKS.pdf",
  "2SFG SCUNTHORPE DOLAV STATIONS AND MEYN WORKS.pdf",
  "2SFG SCUNTHORPE FP1 WORKS ON SITE.pdf",
  "2SFG SCUNTHORPE KETTLETANK REMOVAL.pdf",
  "2SFG SCUNTHORPE MEYN AND DOLAV STATION WORKS.pdf",
  "2SFG SCUNTHORPE RO INSTALLATION.pdf",
  "2SFG SCUNTHORPE RO ROOM WORKS.pdf",
  "2SFG SCUNTHORPE TANK RELOCATION.pdf",
  "2SFG SCUNTHORPE VARIOUS SUPPLIES.pdf",
  "BUTTERNUT BOX INSTALLATION 251125.pdf",
  "BUTTERNUT BOX SPIRAL CONVEYOR CALLOUT WORKS.pdf",
  "DOVECOAT PARK MACHINE INSTALLATION 140226.pdf",
  "DOVECOAT PARK MACHINE INSTALLATION 140326.pdf",
  "DOVECOAT PARK MACHINE PLACEMENT 130626.pdf",
  "DOVECOAT PARK MACHINE PLACEMENT 140326.pdf",
  "FOODCLEAN LAZENBY PIPE CHANGEOVER.pdf",
  "QUORN UNISTRUT PIPE SUPPORT FRAME.pdf",
  "QUORN WATER PIPE WORK SUPPORT EVAP TOWER.pdf",
  "RA BUTTERNUT BOX INSTALLATION OF 1 X VARIOVAC MACHINE.pdf",
  "RA BUTTERNUT BOX SPIRAL CONVEYOR REPAIR.pdf",
  "RA CRANSWICK LAZENBY PIPE CHANGE OVER.pdf",
];

/**
 * @param {import("./fessJobStarters").FessJobStarter[]} [starters]
 */
export function buildMcPdfToStarterMap(starters = FESS_JOB_STARTERS) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const starter of starters) {
    for (const file of starter.sourceFiles || []) {
      map[file] = starter.key;
    }
  }
  return map;
}

/**
 * @param {import("./fessJobStarters").FessJobStarter[]} [starters]
 */
export function getMcPdfCoverage(starters = FESS_JOB_STARTERS) {
  if (!canUseFessExclusiveFeatures()) {
    return { total: 0, mapped: 0, missing: [], complete: false, byStarter: {} };
  }
  const map = buildMcPdfToStarterMap(starters);
  const mappedSet = new Set(Object.keys(map));
  const missing = FESS_MC_PDF_FILES.filter((f) => !mappedSet.has(f));
  const byStarter = {};
  for (const [file, key] of Object.entries(map)) {
    if (!byStarter[key]) byStarter[key] = [];
    byStarter[key].push(file);
  }
  return {
    total: FESS_MC_PDF_FILES.length,
    mapped: FESS_MC_PDF_FILES.length - missing.length,
    missing,
    complete: missing.length === 0,
    byStarter,
  };
}

/** @param {string} pdfFileName */
export function getStarterKeyForMcPdf(pdfFileName) {
  return buildMcPdfToStarterMap()[String(pdfFileName || "").trim()] || "";
}
