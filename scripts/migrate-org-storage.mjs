import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const files = [
  "src/modules/RIDDORWizard.jsx",
  "src/modules/MonthlyReport.jsx",
  "src/modules/QRInduction.jsx",
  "src/modules/DocumentTemplates.jsx",
  "src/modules/LoneWorkingLog.jsx",
  "src/modules/VisitorLog.jsx",
  "src/modules/TrainingMatrix.jsx",
  "src/modules/PlantEquipmentRegister.jsx",
  "src/modules/SafetyObservations.jsx",
  "src/modules/EnvironmentalLog.jsx",
  "src/modules/FirstAidRegister.jsx",
  "src/modules/FireSafetyLog.jsx",
  "src/modules/PPERegister.jsx",
  "src/modules/HotWorkRegister.jsx",
  "src/modules/DSEARLog.jsx",
  "src/modules/ElectricalPATLog.jsx",
  "src/modules/LiftingPlanRegister.jsx",
  "src/modules/LOTORegister.jsx",
  "src/modules/GateBook.jsx",
  "src/modules/LadderInspection.jsx",
  "src/modules/AsbestosRegister.jsx",
  "src/modules/ConfinedSpaceLog.jsx",
  "src/modules/MEWPLog.jsx",
  "src/modules/IncidentNearMiss.jsx",
  "src/modules/ScaffoldRegister.jsx",
  "src/modules/TemporaryWorksRegister.jsx",
  "src/modules/InspectionTracker.jsx",
  "src/modules/WaterHygieneLog.jsx",
  "src/modules/WelfareCheckLog.jsx",
  "src/modules/ExcavationLog.jsx",
  "src/modules/NoiseVibrationLog.jsx",
];

const block =
  /\nconst getOrgId = \(\) => localStorage\.getItem\("mysafeops_orgId"\) \|\| "default";\nconst sk = \(k\) => `\$\{k\}_\$\{getOrgId\(\)\}`;\nconst load = \(k, fb\) => \{ try \{ return JSON\.parse\(localStorage\.getItem\(sk\(k\)\) \|\| JSON\.stringify\(fb\)\); \} catch \{ return fb; \} \};\nconst save = \(k, v\) => localStorage\.setItem\(sk\(k\), JSON\.stringify\(v\)\);\n/;

for (const f of files) {
  const p = path.join(root, f);
  let s = fs.readFileSync(p, "utf8");
  if (!block.test(s)) {
    console.error("NO MATCH", f);
    process.exitCode = 1;
    continue;
  }
  s = s.replace(block, "\n");
  const lines = s.split("\n");
  const impIdx = lines.findIndex((l) => l.startsWith("import ") && l.includes("moduleStyles"));
  if (impIdx === -1) {
    console.error("NO moduleStyles", f);
    process.exitCode = 1;
    continue;
  }
  let imp = 'import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";';
  if (f.endsWith("MonthlyReport.jsx")) {
    imp = 'import { loadOrgScoped as load, getOrgId } from "../utils/orgStorage";';
  }
  if (f.endsWith("QRInduction.jsx")) {
    imp = 'import { loadOrgScoped as load, saveOrgScoped as save, getOrgId } from "../utils/orgStorage";';
  }
  lines.splice(impIdx + 1, 0, imp);
  fs.writeFileSync(p, lines.join("\n"));
  console.log("OK", f);
}
