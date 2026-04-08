import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const multilineBlock = `const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => \`\${k}_\${getOrgId()}\`;
const load = (k, fb) => {
  try {
    return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb));
  } catch {
    return fb;
  }
};
const save = (k, v) => localStorage.setItem(sk(k), JSON.stringify(v));
`;

const files = [
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
  "src/modules/WaterHygieneLog.jsx",
  "src/modules/WelfareCheckLog.jsx",
  "src/modules/ExcavationLog.jsx",
  "src/modules/NoiseVibrationLog.jsx",
  "src/modules/DocumentTemplates.jsx",
];

function insertAfterModuleStyles(lines) {
  const impIdx = lines.findIndex((l) => l.startsWith("import ") && l.includes("moduleStyles"));
  if (impIdx === -1) return null;
  lines.splice(impIdx + 1, 0, 'import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";');
  return lines;
}

for (const f of files) {
  const p = path.join(root, f);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes(multilineBlock)) {
    console.error("NO MULTILINE", f);
    process.exitCode = 1;
    continue;
  }
  s = s.replace(multilineBlock, "");
  const lines = s.split("\n");
  if (!insertAfterModuleStyles(lines)) {
    console.error("NO moduleStyles", f);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(p, lines.join("\n"));
  console.log("OK", f);
}
