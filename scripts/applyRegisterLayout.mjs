/**
 * One-shot codemod: add RegisterModuleShell + exportModuleId to register modules.
 * Run: node scripts/applyRegisterLayout.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.join(__dirname, "../src/modules");

/** @type {Record<string, { file: string; itemsVar?: string }>} */
const REGISTER_MODULES = {
  coshh: { file: "COSHHRegister.jsx", itemsVar: "items", skip: true },
  fire: { file: "FireSafetyLog.jsx", itemsVar: "items" },
  visitors: { file: "VisitorLog.jsx", itemsVar: "items" },
  ppe: { file: "PPERegister.jsx", itemsVar: "items" },
  plant: { file: "PlantEquipmentRegister.jsx", itemsVar: "items" },
  training: { file: "TrainingMatrix.jsx", itemsVar: "items" },
  "first-aid": { file: "FirstAidRegister.jsx", itemsVar: "items" },
  incidents: { file: "IncidentNearMiss.jsx", itemsVar: "items", skip: true },
  "incident-actions": { file: "IncidentActionTracker.jsx", itemsVar: "items" },
  emergency: { file: "EmergencyContacts.jsx", itemsVar: "items" },
  "hot-work": { file: "HotWorkRegister.jsx", itemsVar: "items" },
  "lone-working": { file: "LoneWorkingLog.jsx", itemsVar: "items" },
  environmental: { file: "EnvironmentalLog.jsx", itemsVar: "items" },
  observations: { file: "SafetyObservations.jsx", itemsVar: "items" },
  ladders: { file: "LadderInspection.jsx", itemsVar: "items" },
  mewp: { file: "MEWPLog.jsx", itemsVar: "items" },
  gate: { file: "GateBook.jsx", itemsVar: "items" },
  asbestos: { file: "AsbestosRegister.jsx", itemsVar: "items" },
  "confined-space": { file: "ConfinedSpaceLog.jsx", itemsVar: "items" },
  loto: { file: "LOTORegister.jsx", itemsVar: "items" },
  "electrical-pat": { file: "ElectricalPATLog.jsx", itemsVar: "items" },
  lifting: { file: "LiftingPlanRegister.jsx", itemsVar: "items" },
  dsear: { file: "DSEARLog.jsx", itemsVar: "items" },
  noise: { file: "NoiseVibrationLog.jsx", itemsVar: "items" },
  scaffold: { file: "ScaffoldRegister.jsx", itemsVar: "items" },
  excavation: { file: "ExcavationLog.jsx", itemsVar: "items" },
  "temp-works": { file: "TemporaryWorksRegister.jsx", itemsVar: "items" },
  welfare: { file: "WelfareCheckLog.jsx", itemsVar: "items" },
  "water-hygiene": { file: "WaterHygieneLog.jsx", itemsVar: "items" },
  waste: { file: "WasteRegister.jsx", itemsVar: "items" },
  "high-care-access": { file: "HighCareAccessRegister.jsx", itemsVar: "items" },
  "cip-signoff": { file: "CIPSignoffRegister.jsx", itemsVar: "items" },
  "allergen-changeovers": { file: "AllergenChangeoverRegister.jsx", itemsVar: "items" },
  "gmp-deviations": { file: "GMPDeviationLog.jsx", itemsVar: "items" },
  "method-statement": { file: "MethodStatement.jsx", itemsVar: "docs", skip: true },
  riddor: { file: "RIDDORWizard.jsx", itemsVar: "reports", skip: true },
};

function patchFile(moduleId, config) {
  if (config.skip) {
    console.log("skip manual", config.file);
    return false;
  }
  const filePath = path.join(modulesDir, config.file);
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing", config.file);
    return false;
  }
  let src = fs.readFileSync(filePath, "utf8");
  if (src.includes("RegisterModuleShell") || src.includes("RegisterPageLayout")) {
    console.log("skip already wrapped", config.file);
    return false;
  }
  const itemsVar = config.itemsVar || "items";
  const heroRe = /<PageHero[\s\S]*?\/>/;
  const heroMatch = src.match(heroRe);
  if (!heroMatch) {
    console.warn("no PageHero", config.file);
    return false;
  }
  let hero = heroMatch[0];
  if (!hero.includes("exportModuleId")) {
    hero = hero.replace(/<PageHero/, `<PageHero exportModuleId="${moduleId}"`);
  }
  src = src.replace(heroRe, hero);

  if (!src.includes('RegisterModuleShell')) {
    src = src.replace(
      /import PageHero from "\.\.\/components\/PageHero";/,
      'import PageHero from "../components/PageHero";\nimport RegisterModuleShell from "../components/RegisterModuleShell";\nimport { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";'
    );
  }

  const heroIdx = src.indexOf(hero);
  const afterHero = heroIdx + hero.length;
  const shellOpen = `\n\n      <RegisterModuleShell\n        moduleId="${moduleId}"\n        smartContext={{ items: ${itemsVar}, ${itemsVar}: ${itemsVar} }}\n        stats={buildRegisterModuleStats("${moduleId}", ${itemsVar})}\n      >\n`;
  const shellClose = `\n      </RegisterModuleShell>`;

  // Insert shell after PageHero — before footer info boxes if possible
  const footerRe = /\n\s*<div style=\{\{ marginTop:20, padding:"12px 14px"/;
  const footerMatch = src.match(footerRe);
  if (footerMatch && footerMatch.index > afterHero) {
    src = src.slice(0, afterHero) + shellOpen + src.slice(afterHero, footerMatch.index) + shellClose + src.slice(footerMatch.index);
  } else {
    // Close before last `    </div>` of return
    const returnIdx = src.lastIndexOf("    </div>\n  );");
    if (returnIdx <= afterHero) {
      console.warn("could not find wrap point", config.file);
      return false;
    }
    src = src.slice(0, afterHero) + shellOpen + src.slice(afterHero, returnIdx) + shellClose + src.slice(returnIdx);
  }

  fs.writeFileSync(filePath, src);
  console.log("patched", config.file);
  return true;
}

let n = 0;
for (const [id, cfg] of Object.entries(REGISTER_MODULES)) {
  if (patchFile(id, cfg)) n += 1;
}
console.log(`Done: ${n} files patched`);
