/**
 * Generates full RAMS inventory — parses hazard library JS files directly.
 * Run: node scripts/generate-rams-inventory.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

/** Extract array of hazard objects from a library file via Function eval in isolated scope. */
function loadHazardArray(rel) {
  let src = read(rel);
  src = src.replace(/^import[\s\S]*?;$/gm, "");
  src = src.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, "");
  src = src.replace(/^export\s+(const|let)\s+\w+_CATEGORIES\s*=[\s\S]*?];?\s*$/gm, "");
  src = src.replace(/^export\s+(const|let)\s+/gm, "const ");
  src = src.replace(/^export default /m, "return ");

  // FESS file uses FESS_EXCEL_LIBRARY const
  if (src.includes("FESS_EXCEL_LIBRARY")) {
    const m = src.match(/const FESS_EXCEL_LIBRARY\s*=\s*(\[[\s\S]*?\n\]);/);
    if (m) {
      try {
        return new Function(`return ${m[1]}`)();
      } catch (e) {
        console.warn(`FESS parse fail ${rel}:`, e.message);
      }
    }
  }

  const fn = new Function(src);
  try {
    const result = fn();
    return Array.isArray(result) ? result : [];
  } catch (e) {
    const match = src.match(/(?:const|let)\s+\w+\s*=\s*(\[[\s\S]*\n\]);/);
    if (match) {
      try {
        return new Function(`return ${match[1]}`)();
      } catch {
        /* fall through */
      }
    }
    console.warn(`Could not load ${rel}:`, e.message);
    return [];
  }
}

function loadQuickPacks() {
  const src = read("src/modules/rams/constructionQuickPacks.js");
  const fn = new Function(`
    ${src.replace(/^import[\s\S]*?;$/gm, "").replace(/^export /gm, "")}
    return {
      BUILTIN_CONSTRUCTION_PACK_DEFS,
      BUILTIN_GEOSPATIAL_PACK_DEFS,
      BUILTIN_SITE_INVESTIGATION_PACK_DEFS,
      BUILTIN_FOOD_PHARMA_PACK_DEFS,
    };
  `);
  return fn();
}

function loadActivityCatalog() {
  const src = read("src/modules/rams/constructionActivityCatalog.js");
  const fn = new Function(`
    ${src.replace(/^export /gm, "")}
    return { CONSTRUCTION_ACTIVITY_CATALOG, CORE_RAMS_ACTIVITY_MODULES };
  `);
  return fn();
}

function loadStarters() {
  const src = read("src/utils/ramsIndustryStarters.js");
  const fn = new Function(`
    ${src.replace(/^import[\s\S]*?;$/gm, "").replace(/^export /gm, "")}
    return TRADE_RAMS_STARTERS;
  `);
  return fn();
}

function loadIndustryPacks() {
  const src = read("src/utils/orgIndustryPacks.js");
  const fn = new Function(`
    ${src.replace(/^import[\s\S]*?;$/gm, "").replace(/^export /gm, "")}
    return INDUSTRY_PACKS;
  `);
  return fn();
}

function loadPrintSections() {
  const src = read("src/modules/rams/ramsSectionConfig.js");
  const fn = new Function(`
    ${src.replace(/^export /gm, "")}
    return RAMS_PRINT_SECTIONS;
  `);
  return fn();
}

function loadPermitTypes() {
  const src = read("src/modules/permits/permitTypes.js");
  const fn = new Function(`
    ${src.replace(/^export /gm, "")}
    return PERMIT_TYPES;
  `);
  return fn();
}

function loadMoreSections() {
  const src = read("src/navigation/appModules.js");
  const fn = new Function(`
    ${src.replace(/^import[\s\S]*?;$/gm, "").replace(/^export /gm, "")}
    return { MORE_SECTIONS, MORE_TABS, NAV_TAB_IDS };
  `);
  return fn();
}

function extractCategories(files) {
  const cats = new Set();
  for (const f of files) {
    const src = read(f);
    const m = src.match(/(?:TRADE_CATEGORIES|EXTENDED_CATEGORIES|PRO_CATEGORIES|CONSTRUCTION_CATEGORIES|SUPPLEMENT_CATEGORIES|term|GEOSPATIAL_CATEGORIES|SITE_INVESTIGATION_CATEGORIES|FESS_EXCEL_CATEGORIES)\s*=\s*(\[[\s\S]*?\]);/);
    if (m) {
      try {
        const arr = new Function(`return ${m[1]}`)();
        arr.forEach((c) => cats.add(c));
      } catch { /* skip */ }
    }
    // Also extract from export const X_CATEGORIES
    for (const cm of src.matchAll(/export const (\w+_CATEGORIES)\s*=\s*(\[[\s\S]*?\]);/g)) {
      try {
        new Function(`return ${cm[2]}`)().forEach((c) => cats.add(c));
      } catch { /* skip */ }
    }
  }
  return [...cats];
}

const libraryFiles = [
  "src/modules/rams/ramsHazardLibrary.js",
  "src/modules/rams/ramsHazardLibraryExtended.js",
  "src/modules/rams/ramsHazardLibraryPro.js",
  "src/modules/rams/constructionHazardLibrary.js",
  "src/modules/rams/ramsHazardLibrarySupplement.js",
  "src/modules/rams/ramsHazardLibraryGeospatial.js",
  "src/modules/rams/ramsHazardLibrarySiteInvestigation.js",
  "src/modules/rams/fessExcelHazardLibrary.js",
];

const CORE = [];
const CORE_IDS = new Set();
for (const f of libraryFiles.slice(0, -1)) {
  for (const h of loadHazardArray(f)) {
    if (!CORE_IDS.has(h.id)) {
      CORE.push(h);
      CORE_IDS.add(h.id);
    }
  }
}
const FESS = loadHazardArray("src/modules/rams/fessExcelHazardLibrary.js");
const ALL = [...CORE, ...FESS.filter((h) => !CORE_IDS.has(h.id))];

const TRADE_CATEGORIES = extractCategories(libraryFiles);
// Ensure order from merged list
const catOrder = [];
for (const h of ALL) {
  if (!catOrder.includes(h.category)) catOrder.push(h.category);
}

const packs = loadQuickPacks();
const { CONSTRUCTION_ACTIVITY_CATALOG, CORE_RAMS_ACTIVITY_MODULES } = loadActivityCatalog();
const TRADE_RAMS_STARTERS = loadStarters();
const INDUSTRY_PACKS = loadIndustryPacks();
const RAMS_PRINT_SECTIONS = loadPrintSections();
const PERMIT_TYPES = loadPermitTypes();
const { MORE_SECTIONS, MORE_TABS, NAV_TAB_IDS } = loadMoreSections();
const MORE_BY_ID = Object.fromEntries(MORE_TABS.map((t) => [t.id, t]));
const builderSrc = read("src/modules/rams/RAMSTemplateBuilder.jsx");

const allPackGroups = [
  ["CONSTRUCTION & CIVILS", packs.BUILTIN_CONSTRUCTION_PACK_DEFS],
  ["GEOSPATIAL / SURVEYING", packs.BUILTIN_GEOSPATIAL_PACK_DEFS],
  ["SITE INVESTIGATION", packs.BUILTIN_SITE_INVESTIGATION_PACK_DEFS],
  ["FOOD & PHARMA (FESS)", packs.BUILTIN_FOOD_PHARMA_PACK_DEFS],
];
const totalQuickPacks = allPackGroups.reduce((n, [, d]) => n + d.length, 0);
const totalPermitTypes = Object.keys(PERMIT_TYPES).length;

const lines = [];
const ln = (s = "") => lines.push(s);

ln("================================================================================");
ln("MYSAFEOPS — PELNY INWENTARZ RAMS, RISK ASSESSMENT, METHOD STATEMENT I DOKUMENTOW");
ln(`Wygenerowano: ${new Date().toISOString().slice(0, 10)}`);
ln("================================================================================");
ln("");
ln("OPIS PLIKU (po polsku):");
ln("  Ten plik zawiera KOMPLETNY spis wszystkiego co mamy w MySafeOps dotyczacego RAMS:");
ln(`  - ${ALL.length} wiersze hazardow (Risk Assessment Matrix) w ${catOrder.length} kategoriach`);
ln(`  - ${totalQuickPacks} built-in quick packs (gotowe zestawy hazardow)`);
ln(`  - ${Object.keys(TRADE_RAMS_STARTERS).length} trade RAMS starters + surveying packs (scope + method statement)`);
ln(`  - ${totalPermitTypes} typow permitow (Permit to Work)`);
ln("  - Wszystkie moduly dokumentow w aplikacji");
ln("  - Kazdy hazard opisany: aktywnosc, zagrozenie, L/S/RF, kontrole, PPE, przepisy");
ln("");
ln("Zrodlo danych FESS/food-pharma: FESS_GROUP_RAMS_MASTER_ANALYSIS.xlsx");
ln("  Kategorie Excel: Food Factory M&E, Construction & Groundworks, Survey & Geodesy,");
ln("  Lifting Operations, Pet Food Production, Food Production Line");
ln("");

const byCategory = {};
const bySector = {};
for (const h of ALL) {
  if (!byCategory[h.category]) byCategory[h.category] = [];
  byCategory[h.category].push(h);
  const sec = h.sector || "unknown";
  bySector[sec] = (bySector[sec] || 0) + 1;
}

ln("================================================================================");
ln("1. PODSUMOWANIE STATYSTYCZNE");
ln("================================================================================");
ln("");
ln(`Laczna liczba wierszy hazardow w bibliotece: ${ALL.length}`);
ln(`Liczba kategorii hazardow: ${catOrder.length}`);
ln("");
ln("Hazardy wg sektora (pole sector):");
for (const [sec, count] of Object.entries(bySector).sort((a, b) => b[1] - a[1])) {
  ln(`  - ${sec}: ${count}`);
}
ln("");
ln("Liczba hazardow wg kategorii:");
for (const cat of catOrder) {
  ln(`  - ${cat}: ${byCategory[cat].length}`);
}
ln("");

ln("================================================================================");
ln("2. STRUKTURA DOKUMENTU RAMS (Risk Assessment & Method Statement)");
ln("================================================================================");
ln("");
ln("Dokument RAMS w MySafeOps sklada sie z nastepujacych sekcji (druk/PDF):");
for (const s of RAMS_PRINT_SECTIONS) {
  const flags = [s.locked ? "wymagana" : null, s.optIn ? "opcjonalna (opt-in)" : "domyslnie wlaczona"].filter(Boolean).join(", ");
  ln(`  [${s.id}] ${s.title} — ${flags}`);
}
ln("");
ln("Pola metadanych dokumentu RAMS:");
ln("  - title, location, leadEngineer, jobRef, siteId, projectId");
ln("  - scope (zakres prac / opis zadania)");
ln("  - methodSteps[] (kroki metody bezpiecznego wykonania — Method Statement)");
ln("  - hazards[] (macierz oceny ryzyka — Risk Assessment Matrix)");
ln("  - operativeSignatures[] (podpisy operatywow)");
ln("  - weatherSnapshot, hospitalInfo, mapLink, operativeCerts");
ln("  - printSections (ktore sekcje drukowac)");
ln("  - documentContentHash (integralnosc dokumentu)");
ln("");
ln("Kazdy wiersz hazardu (hazards[]) zawiera:");
ln("  - category, activity, hazard");
ln("  - initialRisk: { L (1-5), S (1-5), RF (L×S) }");
ln("  - controlMeasures[] (srodki kontroli)");
ln("  - revisedRisk: { L, S, RF }");
ln("  - ppeRequired[] (wymagane SOI)");
ln("  - regs[] (przepisy UK: HASAWA, CDM, PUWER, LOLER, itd.)");
ln("  - permitTypes[], requiredCerts[] (opcjonalnie)");
ln("");

ln("================================================================================");
ln("3. MODUL METHOD STATEMENT (osobny od RAMS)");
ln("================================================================================");
ln("");
ln("Method Statement to osobny typ dokumentu (modul: method-statement).");
ln("Zawiera sekwencje krokow bezpiecznego wykonania prac bez pelnej macierzy ryzyka.");
ln("Mozna zapisac jako szablon (Document Templates) i powiazac z RAMS.");
ln("");

ln("================================================================================");
ln("4. BUILT-IN QUICK PACKS (pakiety szybkie — gotowe zestawy hazardow)");
ln("================================================================================");
ln("");

for (const [groupName, defs] of allPackGroups) {
  ln(`--- ${groupName} (${defs.length} pakietow) ---`);
  ln("");
  for (const def of defs) {
    ln(`  PAKIET: ${def.name}`);
    ln(`    ID: ${def.id}`);
    ln(`    Sektor: ${def.sector}`);
    ln(`    Przypiety (pinned): ${def.pinned ? "TAK" : "NIE"}`);
    ln(`    Opis: ${def.description || "—"}`);
    ln(`    Liczba hazardIds: ${def.hazardIds.length}`);
    ln(`    Hazard IDs: ${def.hazardIds.join(", ")}`);
    ln("");
  }
}

ln("================================================================================");
ln("5. TRADE RAMS STARTERS (startery branzowe — scope + method + hazard tokens)");
ln("================================================================================");
ln("");
for (const starter of Object.values(TRADE_RAMS_STARTERS)) {
  ln(`  STARTER: ${starter.label} (key: ${starter.key})`);
  ln(`    SCOPE (zakres):`);
  ln(`      ${starter.scope}`);
  ln(`    METHOD (metoda — kroki):`);
  for (const step of starter.method.split("\n\n")) {
    ln(`      ${step.trim()}`);
  }
  ln(`    Hazard tokens: ${starter.hazardTokens.join(", ")}`);
  if (starter.categories?.length) ln(`    Kategorie: ${starter.categories.join(", ")}`);
  ln("");
}

ln("================================================================================");
ln("6. SURVEYING PACKS (RAMSTemplateBuilder — SURVEYING_PACKS)");
ln("================================================================================");
ln("");
const spStart = builderSrc.indexOf("const SURVEYING_PACKS = [");
const spEnd = builderSrc.indexOf("function hazardMatchesSurveyPack", spStart);
const spBlock = builderSrc.slice(spStart, spEnd);
const packRegex = /key: "([^"]+)",\s*\n\s*label: "([^"]+)",\s*\n\s*scope:\s*\n\s*"([^"]*(?:\\.[^"]*)*)"/g;
let pm;
while ((pm = packRegex.exec(spBlock)) !== null) {
  ln(`  PAKIET: ${pm[2]} (key: ${pm[1]})`);
  ln(`    Scope: ${pm[3].replace(/\\n/g, " ")}`);
  // extract method
  const afterScope = spBlock.slice(pm.index);
  const methodMatch = afterScope.match(/method:\s*\n\s*"([^"]*(?:\\.[^"]*)*)"/);
  if (methodMatch) {
    ln(`    Method:`);
    for (const step of methodMatch[1].replace(/\\n\\n/g, "\n").split("\n")) {
      ln(`      ${step.trim()}`);
    }
  }
  const tokenMatch = afterScope.match(/hazardTokens: \[([^\]]+)\]/);
  if (tokenMatch) ln(`    Hazard tokens: ${tokenMatch[1].replace(/"/g, "").trim()}`);
  ln("");
}

ln("================================================================================");
ln("7. KATALOG AKTYWNOSCI (CONSTRUCTION_ACTIVITY_CATALOG)");
ln("================================================================================");
ln("");
for (const sector of CONSTRUCTION_ACTIVITY_CATALOG) {
  ln(`  SEKTOR: ${sector.label} (${sector.id})`);
  for (const act of sector.activities) {
    ln(`    - ${act.label} [${act.id}]`);
    ln(`      Hazard tokens: ${act.hazardTokens.join(", ")}`);
    if (act.permitHints?.length) ln(`      Permit hints: ${act.permitHints.join(", ")}`);
    if (act.certHints?.length) ln(`      Cert hints: ${act.certCerts?.join(", ") || act.certHints.join(", ")}`);
  }
  ln("");
}
ln("Moduly aktywnosci cross-cutting (CORE_RAMS_ACTIVITY_MODULES):");
ln(`  ${CORE_RAMS_ACTIVITY_MODULES.join(", ")}`);
ln("");

ln("================================================================================");
ln("8. PROFILE BRANZOWE (INDUSTRY PACKS / workspace profiles)");
ln("================================================================================");
ln("");
for (const [id, pack] of Object.entries(INDUSTRY_PACKS)) {
  ln(`  ${pack.label} (${id})`);
  ln(`    Hint: ${pack.hint}`);
  ln(`    RAMS starter key: ${pack.ramsStarterKey ?? "brak"}`);
  if (pack.industrySectors) ln(`    Sektory: ${pack.industrySectors.join(", ")}`);
  if (pack.showModules?.length) ln(`    Dodatkowe moduly: ${pack.showModules.join(", ")}`);
  if (pack.hiddenModules?.length) ln(`    Ukryte moduly: ${pack.hiddenModules.join(", ")}`);
  ln("");
}

ln("================================================================================");
ln("9. PELNA BIBLIOTEKA HAZARDOW — KAZDY WIERSZ SZCZEGOLOWO");
ln("================================================================================");
ln("");

for (const cat of catOrder) {
  const hazards = byCategory[cat] || [];
  ln("--------------------------------------------------------------------------------");
  ln(`KATEGORIA: ${cat} (${hazards.length} wierszy)`);
  ln("--------------------------------------------------------------------------------");
  ln("");

  for (const h of hazards) {
    ln(`  ID: ${h.id}`);
    ln(`  Sektor: ${h.sector || "—"}`);
    ln(`  Aktywnosc: ${h.activity}`);
    ln(`  Zagrozenie: ${h.hazard}`);
    ln(`  Ryzyko poczatkowe: L=${h.initialRisk?.L} S=${h.initialRisk?.S} RF=${h.initialRisk?.RF}`);
    ln(`  Ryzyko po kontrolach: L=${h.revisedRisk?.L} S=${h.revisedRisk?.S} RF=${h.revisedRisk?.RF}`);
    ln(`  Srodki kontroli:`);
    for (const c of h.controlMeasures || []) ln(`    • ${c}`);
    ln(`  PPE: ${(h.ppeRequired || []).join(", ") || "—"}`);
    ln(`  Przepisy: ${(h.regs || []).join(", ") || "—"}`);
    if (h.permitTypes?.length) ln(`  Permity: ${h.permitTypes.join(", ")}`);
    if (h.requiredCerts?.length) ln(`  Certyfikaty: ${h.requiredCerts.join(", ")}`);
    ln("");
  }
}

ln("================================================================================");
ln("10. PLIKI ZRODLOWE BIBLIOTEK");
ln("================================================================================");
ln("");
for (const f of libraryFiles) ln(`  ${f}`);
ln("  src/modules/rams/ramsAllHazards.js             — merge wszystkich powyższych");
ln("  src/modules/rams/constructionQuickPacks.js     — definicje quick packs");
ln("  src/modules/rams/constructionActivityCatalog.js");
ln("  src/utils/ramsIndustryStarters.js");
ln("  src/modules/rams/RAMSTemplateBuilder.jsx");
ln("  DOCS/FESS/Extra/FESS_GROUP_RAMS_MASTER_ANALYSIS.xlsx");
ln("");

ln("================================================================================");
ln("11. PERMITY (Permit to Work — PTW) — WSZYSTKIE TYPY");
ln("================================================================================");
ln("");
ln("Modul Permits obsluguje permit-to-work powiazany z RAMS (linkedRamsId).");
ln("Kazdy permit ma: checklist, pola dodatkowe, status (draft/review/active/closed).");
ln("");
for (const [key, p] of Object.entries(PERMIT_TYPES)) {
  ln(`  TYP: ${p.label} (key: ${key})`);
  ln(`    Opis: ${p.description}`);
  ln(`    Checklist (${p.checklist.length} punktow):`);
  for (const c of p.checklist) ln(`      - ${c}`);
  if (p.extraFields?.length) {
    ln(`    Pola dodatkowe:`);
    for (const f of p.extraFields) ln(`      - ${f.label} (${f.key}, typ: ${f.type})`);
  }
  ln("");
}

ln("================================================================================");
ln("12. MODULY APLIKACJI (wszystkie dokumenty i rejestry w MySafeOps)");
ln("================================================================================");
ln("");
ln("Glowna nawigacja:");
for (const t of NAV_TAB_IDS) ln(`  - ${t.label} (${t.id})`);
ln("");
for (const section of MORE_SECTIONS) {
  ln(`  --- ${section.title} ---`);
  for (const id of section.ids) {
    const tab = MORE_BY_ID[id];
    if (tab) ln(`    - ${tab.label} (${tab.id})`);
  }
  ln("");
}
ln("Moduly zwiazane z FESS / food-pharma (profile foodPharma):");
ln("  - high-care-access — dostep do stref high-care");
ln("  - cip-signoff — sign-off CIP (Cleaning In Place)");
ln("  - allergen-changeovers — zmiany alergenow miedzy produktami");
ln("  - gmp-deviations — odchylenia GMP");
ln("  - ghp-register — rejestr szkla i twardego plastiku (Glass & Hard Plastic)");
ln("  - dynamic-ra — dynamiczna ocena ryzyka");
ln("  - legislation — rejestr przepisow UK");
ln("  - hygiene-setup — konfiguracja food & pharma");
ln("  - loto — Lock Out Tag Out");
ln("  - dsear — ATEX / DSEAR (substancje wybuchowe)");
ln("  - line_clearance permit — powiazany z line clearance na liniach produkcyjnych");
ln("");
ln("Moduly geodezyjne / surveying:");
ln("  - survey-report — raport geodezyjny (PAS128, deliverables)");
ln("  - geo-photos — zdjecia geolokalizowane");
ln("");
ln("Powiazane typy dokumentow (plan backend D1):");
ln("  rams, method-statement, permit_*, coshh, loler, fire_log, waste_transfer,");
ln("  toolbox_talk, near_miss, incident_report, high_care_access, cip_signoff,");
ln("  allergen_changeover, atex_dsear, gmp_deviation");
ln("");

const outPath = join(root, "DOCS", "FESS", "Extra", "MYSAFEOPS_RAMS_PELNY_INWENTARZ.txt");
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Written ${lines.length} lines to ${outPath}`);
console.log(`Total hazards: ${ALL.length}, categories: ${catOrder.length}`);
