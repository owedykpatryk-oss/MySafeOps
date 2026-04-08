/**
 * One-off: replace standard register header div with PageHero + import.
 * Run from repo root: node scripts/page-hero-register.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mod = path.join(root, "src/modules");

/** badge, title, lead — right column is always exportCsv + add button block preserved from file via regex */
const specs = [
  ["PPERegister.jsx", "PPE", "PPE register", "Issue checks and condition records (local only)."],
  ["LoneWorkingLog.jsx", "LW", "Lone working", "Check-ins and lone worker welfare records (local only)."],
  ["VisitorLog.jsx", "VIS", "Visitor log", "Site visitors, induction status, and host details (local only)."],
  ["TrainingMatrix.jsx", "TM", "Training matrix", "Competency and refresher dates by worker (local only)."],
  ["PlantEquipmentRegister.jsx", "PL", "Plant & equipment", "Plant register, inspections, and handover notes (local only)."],
  ["SafetyObservations.jsx", "OBS", "Safety observations", "Positive interventions and unsafe act observations (local only)."],
  ["EnvironmentalLog.jsx", "ENV", "Environmental log", "Spills, bund checks, and environmental notes (local only)."],
  ["FirstAidRegister.jsx", "FA", "First aid", "Trained personnel and kit locations (HSE-style site cover)."],
  ["FireSafetyLog.jsx", "FIRE", "Fire safety log", "Drills, extinguishers, alarms, and fire marshal records (local only)."],
  ["HotWorkRegister.jsx", "HW", "Hot work register", "Welding, cutting, grinding — align with your fire plan and PTW module."],
  ["DSEARLog.jsx", "DS", "DSEAR register", "Dangerous substances and explosive atmospheres records (local only)."],
  ["ElectricalPATLog.jsx", "PAT", "Electrical / PAT", "PAT and electrical inspection records (local only)."],
  ["LiftingPlanRegister.jsx", "LIFT", "Lifting operations", "Lift plans, equipment, and briefings (local only)."],
  ["LOTORegister.jsx", "LOTO", "LOTO register", "Lock-out tag-out points and isolations (local only)."],
  ["GateBook.jsx", "GT", "Gate book", "Site gate movements and deliveries (local only)."],
  ["LadderInspection.jsx", "LD", "Ladder inspections", "Pre-use and formal ladder inspection records (local only)."],
  ["AsbestosRegister.jsx", "ASB", "Asbestos register", "ACM locations, surveys, and management plan refs (local only)."],
  ["ConfinedSpaceLog.jsx", "CS", "Confined space log", "Entries, gas checks, and standby (local only)."],
  ["MEWPLog.jsx", "MW", "MEWP log", "MEWP pre-use checks and defects (local only)."],
  ["ScaffoldRegister.jsx", "SC", "Scaffold register", "Scaffold tags, inspections, and handovers (local only)."],
  ["TemporaryWorksRegister.jsx", "TW", "Temporary works", "TW design checks and inspections (local only)."],
  ["WaterHygieneLog.jsx", "WH", "Water hygiene", "Outlet temperatures and Legionella-style checks (local only)."],
  ["WelfareCheckLog.jsx", "WF", "Welfare checks", "Toilets, rest, water, drying — welfare monitoring (local only)."],
  ["ExcavationLog.jsx", "EX", "Excavations", "Excavations and permit-to-dig style records (local only)."],
  ["NoiseVibrationLog.jsx", "NV", "Noise & vibration", "Noise and HAV exposure records (local only)."],
];

const blockRe = /<div style=\{\{ display: "flex", justifyContent: "space-between"(?:, alignItems: "flex-start")?, flexWrap: "wrap", gap: 8, marginBottom: 16 \}\}>[\s\S]*?<\/div>\s*(?=\{items\.length)/;

for (const [fname, badge, title, lead] of specs) {
  const p = path.join(mod, fname);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("PageHero")) {
    console.log("skip (has PageHero)", fname);
    continue;
  }
  const m = s.match(blockRe);
  if (!m) {
    console.error("NO BLOCK", fname);
    process.exitCode = 1;
    continue;
  }
  const full = m[0];
  const rightStart = full.indexOf('<div style={{ display: "flex", gap: 8');
  if (rightStart < 0) {
    console.error("NO right column", fname);
    process.exitCode = 1;
    continue;
  }
  let rightCol = full.slice(rightStart);
  rightCol = rightCol.replace(/<\/div>\s*<\/div>\s*$/, "");
  const hero = `      <PageHero
        badgeText="${badge}"
        title="${title}"
        lead="${lead.replace(/"/g, '\\"')}"
        right={${rightCol.trim()}}
      />
`;
  s = s.replace(blockRe, hero);
  if (!s.includes('from "../components/PageHero"') && !s.includes("from '../components/PageHero'")) {
    const impLine = 'import PageHero from "../components/PageHero";';
    const idx = s.indexOf('from "../utils/orgStorage";');
    if (idx === -1) {
      console.error("NO orgStorage import", fname);
      process.exitCode = 1;
      continue;
    }
    const end = idx + 'from "../utils/orgStorage";'.length;
    s = s.slice(0, end) + "\n" + impLine + s.slice(end);
  }
  fs.writeFileSync(p, s);
  console.log("OK", fname);
}
