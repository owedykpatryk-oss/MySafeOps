export const CERT_LIBRARY = [
  { code: "cscs", label: "CSCS", defaultValidityMonths: 60 },
  { code: "cpcs", label: "CPCS (plant)", defaultValidityMonths: 60 },
  { code: "npors", label: "NPORS (plant)", defaultValidityMonths: 60 },
  { code: "ipaf", label: "IPAF", defaultValidityMonths: 60 },
  { code: "pasma", label: "PASMA", defaultValidityMonths: 60 },
  { code: "ecs", label: "ECS (electrotechnical)", defaultValidityMonths: 60 },
  { code: "eusr", label: "EUSR (utilities)", defaultValidityMonths: 36 },
  { code: "pts", label: "PTS (Personal Track Safety)", defaultValidityMonths: 24 },
  { code: "nrswa", label: "NRSWA / Streetworks", defaultValidityMonths: 60 },
  { code: "smsts", label: "SMSTS", defaultValidityMonths: 60 },
  { code: "sssts", label: "SSSTS", defaultValidityMonths: 60 },
  { code: "iosh_ms", label: "IOSH Managing Safely", defaultValidityMonths: 36 },
  { code: "iosh_ws", label: "IOSH Working Safely", defaultValidityMonths: 36 },
  { code: "nebosh", label: "NEBOSH General Certificate", defaultValidityMonths: 60 },
  { code: "asbestos_awareness", label: "Asbestos Awareness", defaultValidityMonths: 12 },
  { code: "first_aid", label: "First Aid at Work", defaultValidityMonths: 36 },
  { code: "manual_handling", label: "Manual Handling", defaultValidityMonths: 24 },
  { code: "abrasive_wheels", label: "Abrasive Wheels", defaultValidityMonths: 36 },
  { code: "working_at_height", label: "Working at Height", defaultValidityMonths: 24 },
  { code: "confined_space", label: "Confined Space Entry", defaultValidityMonths: 12 },
  { code: "gas_tester", label: "Gas Tester / Monitor", defaultValidityMonths: 12 },
  { code: "electrical_loto", label: "Electrical Isolation / LOTO", defaultValidityMonths: 36 },
  { code: "hot_work_fire_watch", label: "Hot Work / Fire Watch", defaultValidityMonths: 24 },
  { code: "slinger_signaller", label: "Slinger / Signaller", defaultValidityMonths: 60 },
  { code: "gas_safe", label: "Gas Safe Register", defaultValidityMonths: 12 },
  { code: "f_gas", label: "F-Gas (refrigerants)", defaultValidityMonths: 60 },
  { code: "compex", label: "CompEx (hazardous areas)", defaultValidityMonths: 60 },
  { code: "gwo", label: "GWO (wind)", defaultValidityMonths: 24 },
  { code: "irata", label: "IRATA (rope access)", defaultValidityMonths: 36 },
  { code: "utility_mapping", label: "Utility Mapping / PAS128", defaultValidityMonths: 36 },
  { code: "gi_drilling", label: "GI Drilling / Borehole Competence", defaultValidityMonths: 36 },
  { code: "dynamic_probing", label: "Dynamic Probing / DCP", defaultValidityMonths: 36 },
  { code: "contamination_gi", label: "Contaminated Land / GI Sampling", defaultValidityMonths: 36 },
  { code: "nhss12", label: "NHSS12 Traffic Management", defaultValidityMonths: 60 },
  { code: "food_hygiene_l2", label: "Food Hygiene Level 2", defaultValidityMonths: 36 },
];

const CERT_LABEL_BY_CODE = Object.fromEntries(CERT_LIBRARY.map((c) => [c.code, c.label]));

const PERMIT_CERT_REQUIREMENTS = {
  hot_work: ["cscs", "hot_work_fire_watch"],
  electrical: ["ecs", "electrical_loto"],
  work_at_height: ["cscs", "working_at_height"],
  confined_space: ["cscs", "confined_space", "gas_tester"],
  excavation: ["cscs", "asbestos_awareness"],
  lifting: ["cscs", "slinger_signaller", "cpcs"],
  cold_work: ["cscs", "electrical_loto"],
  line_break: ["cscs", "manual_handling"],
  roof_access: ["cscs", "working_at_height", "pasma"],
  night_works: ["cscs", "first_aid"],
  valve_isolation: ["cscs", "electrical_loto"],
  visitor_access: ["cscs"],
  radiography: ["cscs"],
  ground_disturbance: ["cscs", "asbestos_awareness", "gi_drilling", "dynamic_probing"],
  line_clearance: ["cscs", "food_hygiene_l2", "manual_handling"],
  general: ["cscs"],
};

export function certLabel(codeOrName) {
  const k = String(codeOrName || "").trim().toLowerCase();
  return CERT_LABEL_BY_CODE[k] || String(codeOrName || "").trim();
}

export function addMonthsIso(startIso, months) {
  const d = startIso ? new Date(startIso) : new Date();
  if (!Number.isFinite(d.getTime())) return "";
  const x = new Date(d);
  x.setMonth(x.getMonth() + Number(months || 0));
  return x.toISOString().slice(0, 10);
}

export function normalizeWorkerCertifications(worker) {
  const rows = Array.isArray(worker?.certifications) ? worker.certifications : [];
  return rows
    .map((c) => ({
      certCode: String(c?.certCode || c?.code || c?.certType || "").trim().toLowerCase(),
      certType: certLabel(c?.certCode || c?.code || c?.certType || ""),
      expiryDate: String(c?.expiryDate || c?.validUntil || "").slice(0, 10),
      certNumber: String(c?.certNumber || ""),
      provider: String(c?.provider || ""),
    }))
    .filter((c) => c.certCode || c.certType);
}

export function getWorkerCertAlerts(worker, now = new Date()) {
  const certs = normalizeWorkerCertifications(worker);
  const out = [];
  certs.forEach((c) => {
    if (!c.expiryDate) return;
    const t = new Date(c.expiryDate).getTime();
    if (!Number.isFinite(t)) return;
    const days = Math.ceil((t - now.getTime()) / 86400000);
    if (days < 0) out.push({ severity: "expired", days, cert: c });
    else if (days <= 7) out.push({ severity: "critical", days, cert: c });
    else if (days <= 30) out.push({ severity: "warning", days, cert: c });
  });
  return out.sort((a, b) => a.days - b.days);
}

export function evaluateWorkerPermitEligibility(worker, permitType, atIso = new Date().toISOString()) {
  const requiredCodes = PERMIT_CERT_REQUIREMENTS[permitType] || PERMIT_CERT_REQUIREMENTS.general;
  const certs = normalizeWorkerCertifications(worker);
  const byCode = Object.fromEntries(certs.map((c) => [String(c.certCode || "").toLowerCase(), c]));
  const now = new Date(atIso);
  const missing = [];
  const expired = [];
  const expiringSoon = [];
  requiredCodes.forEach((code) => {
    const cert = byCode[code];
    if (!cert) {
      missing.push(certLabel(code));
      return;
    }
    if (!cert.expiryDate) return;
    const t = new Date(cert.expiryDate).getTime();
    if (!Number.isFinite(t)) return;
    const days = Math.ceil((t - now.getTime()) / 86400000);
    if (days < 0) expired.push({ label: certLabel(code), days });
    else if (days <= 30) expiringSoon.push({ label: certLabel(code), days });
  });
  return {
    required: requiredCodes.map((c) => certLabel(c)),
    missing,
    expired,
    expiringSoon,
    eligible: missing.length === 0 && expired.length === 0,
  };
}

