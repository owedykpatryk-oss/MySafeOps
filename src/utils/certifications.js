import { getOrgMarketId } from "./orgMarket";

import { localDateISO } from "./localDate";
export const CERT_LIBRARY = [
  { code: "cscs", label: "CSCS", defaultValidityMonths: 60 },
  { code: "cpcs", label: "CPCS (plant)", defaultValidityMonths: 60 },
  { code: "npors", label: "NPORS (plant)", defaultValidityMonths: 60 },
  { code: "ipaf", label: "IPAF", defaultValidityMonths: 60 },
  { code: "pasma", label: "PASMA", defaultValidityMonths: 60 },
  { code: "ecs", label: "ECS (electrotechnical)", defaultValidityMonths: 60 },
  { code: "eusr", label: "EUSR (utilities)", defaultValidityMonths: 36 },
  { code: "pts", label: "PTS (Personal Track Safety)", defaultValidityMonths: 24 },
  { code: "coss", label: "COSS (Controller of Site Safety)", defaultValidityMonths: 24 },
  { code: "iwa", label: "IWA (Individual Working Alone)", defaultValidityMonths: 24 },
  { code: "es_rail", label: "ES (Engineering Supervisor)", defaultValidityMonths: 24 },
  { code: "picop", label: "PICOP (Person in Charge of Possession)", defaultValidityMonths: 24 },
  { code: "machine_controller", label: "Machine / Crane Controller (MC / CC)", defaultValidityMonths: 24 },
  { code: "rrv_operator", label: "On-track plant (RRV) operator", defaultValidityMonths: 24 },
  { code: "ole_competence", label: "OLE / OLEC competence", defaultValidityMonths: 24 },
  { code: "rail_medical", label: "Rail safety-critical medical & D&A", defaultValidityMonths: 36 },
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

/** AU construction competency tickets (shown for market=au). */
export const AU_CERT_LIBRARY = [
  { code: "white_card", label: "White Card (construction induction)", defaultValidityMonths: 0 },
  { code: "hrwl", label: "HRWL (high-risk work licence)", defaultValidityMonths: 60 },
  { code: "ewpa", label: "EWPA (elevating work platform)", defaultValidityMonths: 60 },
  { code: "ewp", label: "EWP operator competency", defaultValidityMonths: 60 },
  { code: "dogging", label: "Dogging (DG)", defaultValidityMonths: 60 },
  { code: "rigging", label: "Basic / intermediate rigging", defaultValidityMonths: 60 },
  { code: "scaffolding", label: "Scaffolding licence", defaultValidityMonths: 60 },
  { code: "asbestos_awareness", label: "Asbestos awareness (10675NAT)", defaultValidityMonths: 12 },
  { code: "first_aid", label: "Provide first aid (HLTAID011)", defaultValidityMonths: 36 },
  { code: "manual_handling", label: "Manual handling", defaultValidityMonths: 24 },
  { code: "working_at_height", label: "Working at heights", defaultValidityMonths: 24 },
  { code: "confined_space", label: "Confined space entry", defaultValidityMonths: 12 },
  { code: "gas_tester", label: "Gas testing / monitoring", defaultValidityMonths: 12 },
  { code: "electrical_loto", label: "Electrical isolation / LOTO", defaultValidityMonths: 36 },
  { code: "hot_work_fire_watch", label: "Hot work / fire watch", defaultValidityMonths: 24 },
  { code: "slinger_signaller", label: "Dogman / rigger signaller", defaultValidityMonths: 60 },
  { code: "traffic_control", label: "Traffic control (TC)", defaultValidityMonths: 36 },
  { code: "iosh_ms", label: "IOSH Managing Safely", defaultValidityMonths: 36 },
  { code: "iosh_ws", label: "IOSH Working Safely", defaultValidityMonths: 36 },
  { code: "nebosh", label: "NEBOSH General Certificate", defaultValidityMonths: 60 },
];

export const PL_CERT_LIBRARY = [
  { code: "bhp_wstepne", label: "Szkolenie wstępne BHP (instruktaż ogólny)", defaultValidityMonths: 0 },
  { code: "bhp_stanowisko", label: "Instruktaż stanowiskowy BHP", defaultValidityMonths: 0 },
  { code: "bhp_okresowe", label: "Szkolenie okresowe BHP (robotnicy)", defaultValidityMonths: 36 },
  { code: "bhp_okresowe_kier", label: "Szkolenie okresowe BHP (kierownicy / inż.-techn.)", defaultValidityMonths: 60 },
  { code: "badania_profilaktyczne", label: "Badania profilaktyczne — orzeczenie lekarskie", defaultValidityMonths: 24 },
  { code: "badania_wysokosc", label: "Orzeczenie — praca na wysokości powyżej 3 m", defaultValidityMonths: 24 },
  { code: "orzeczenie_sanepid", label: "Orzeczenie do celów sanitarno-epidemiologicznych", defaultValidityMonths: 24 },
  { code: "ghp_gmp", label: "Szkolenie GHP/GMP i HACCP", defaultValidityMonths: 12 },
  { code: "udt", label: "Uprawnienia UDT (ogólne)", defaultValidityMonths: 60 },
  { code: "udt_wozki", label: "UDT — wózki jezdniowe podnośnikowe", defaultValidityMonths: 60 },
  { code: "udt_podesty", label: "UDT — podesty ruchome (I P / II P)", defaultValidityMonths: 60 },
  { code: "udt_zurawie", label: "UDT — żurawie (I Ż / II Ż)", defaultValidityMonths: 60 },
  { code: "operator_maszyn", label: "Operator maszyn budowlanych (książka operatora)", defaultValidityMonths: 0 },
  { code: "rusztowania", label: "Montaż i demontaż rusztowań", defaultValidityMonths: 0 },
  { code: "spawanie", label: "Uprawnienia spawalnicze", defaultValidityMonths: 36 },
  { code: "sep", label: "Świadectwo kwalifikacyjne SEP (ogólne)", defaultValidityMonths: 60 },
  { code: "sep_e", label: "SEP G1 eksploatacja (E) — elektryczne", defaultValidityMonths: 60 },
  { code: "sep_d", label: "SEP G1 dozór (D) — elektryczne", defaultValidityMonths: 60 },
  { code: "sep_g2", label: "SEP G2 (E lub D) — cieplne", defaultValidityMonths: 60 },
  { code: "sep_g3", label: "SEP G3 (E lub D) — gazowe", defaultValidityMonths: 60 },
  { code: "budowlane", label: "Uprawnienia budowlane", defaultValidityMonths: 0 },
  { code: "sluzba_bhp", label: "Szkolenie okresowe służby BHP", defaultValidityMonths: 60 },
  { code: "asbestos_awareness", label: "Azbest — szkolenie przed przystąpieniem do prac", defaultValidityMonths: 12 },
  { code: "first_aid", label: "Pierwsza pomoc — osoba wyznaczona", defaultValidityMonths: 36 },
  { code: "ppoz", label: "Ochrona ppoż. — osoba wyznaczona do zwalczania pożarów", defaultValidityMonths: 36 },
  { code: "manual_handling", label: "Ręczne prace transportowe", defaultValidityMonths: 24 },
  { code: "working_at_height", label: "Prace na wysokości — szkolenie", defaultValidityMonths: 24 },
  { code: "confined_space", label: "Przestrzenie zamknięte", defaultValidityMonths: 12 },
  { code: "gas_tester", label: "Pomiary atmosfery / detekcja gazów", defaultValidityMonths: 12 },
  { code: "electrical_loto", label: "Izolacja energetyczna / LOTO", defaultValidityMonths: 36 },
  { code: "hot_work_fire_watch", label: "Prace niebezpieczne pożarowo / asekuracja", defaultValidityMonths: 24 },
  { code: "slinger_signaller", label: "Sygnalista / hakowy", defaultValidityMonths: 60 },
  { code: "kolej_obszar", label: "Dopuszczenie do pracy w obszarze kolejowym", defaultValidityMonths: 24 },
  { code: "iosh_ms", label: "IOSH Managing Safely", defaultValidityMonths: 36 },
  { code: "iosh_ws", label: "IOSH Working Safely", defaultValidityMonths: 36 },
];

export const DE_CERT_LIBRARY = [
  { code: "unterweisung", label: "Unterweisung (ArbSchG)", defaultValidityMonths: 12 },
  { code: "sifa", label: "Fachkraft für Arbeitssicherheit (Sifa)", defaultValidityMonths: 0 },
  { code: "sigeko", label: "SiGeKo (RAB 30)", defaultValidityMonths: 36 },
  { code: "scc", label: "SCC / SCP", defaultValidityMonths: 36 },
  { code: "ersthelfer", label: "Ersthelfer", defaultValidityMonths: 24 },
  { code: "brandschutzhelfer", label: "Brandschutzhelfer", defaultValidityMonths: 36 },
  { code: "psa_absturz", label: "PSA gegen Absturz", defaultValidityMonths: 12 },
  { code: "hubarbeitsbuehne", label: "Hubarbeitsbühne", defaultValidityMonths: 12 },
  { code: "stapler", label: "Flurförderzeuge / Stapler", defaultValidityMonths: 12 },
  { code: "kran", label: "Kranführer / Anschläger", defaultValidityMonths: 12 },
  { code: "asbest", label: "Asbest — Sachkunde", defaultValidityMonths: 12 },
  { code: "enge_raeume", label: "Enge Räume", defaultValidityMonths: 12 },
  { code: "gasmessung", label: "Gasmessung", defaultValidityMonths: 12 },
  { code: "elektro", label: "Elektrofachkraft / Schalten", defaultValidityMonths: 36 },
  { code: "heissarbeiten", label: "Heißarbeiten / Brandwache", defaultValidityMonths: 24 },
  { code: "manual_handling", label: "Lastenhandhabung", defaultValidityMonths: 24 },
];

const DE_PERMIT_CERT_REQUIREMENTS = {
  hot_work: ["unterweisung", "heissarbeiten"],
  electrical: ["elektro"],
  work_at_height: ["unterweisung", "psa_absturz", "hubarbeitsbuehne"],
  confined_space: ["unterweisung", "enge_raeume", "gasmessung"],
  excavation: ["unterweisung", "asbest"],
  lifting: ["unterweisung", "kran"],
  cold_work: ["unterweisung", "elektro"],
  line_break: ["unterweisung", "manual_handling"],
  roof_access: ["unterweisung", "psa_absturz", "hubarbeitsbuehne"],
  night_works: ["unterweisung", "ersthelfer"],
  valve_isolation: ["unterweisung", "elektro"],
  visitor_access: ["unterweisung"],
  radiography: ["unterweisung"],
  ground_disturbance: ["unterweisung", "asbest"],
  line_clearance: ["unterweisung", "manual_handling"],
  general: ["unterweisung"],
};

const PL_PERMIT_CERT_REQUIREMENTS = {
  hot_work: ["bhp_okresowe", "badania_profilaktyczne", "hot_work_fire_watch", "spawanie"],
  electrical: ["sep_e", "electrical_loto", "badania_profilaktyczne"],
  work_at_height: ["bhp_okresowe", "badania_wysokosc", "working_at_height"],
  confined_space: ["bhp_okresowe", "confined_space", "gas_tester", "badania_profilaktyczne"],
  excavation: ["bhp_okresowe", "operator_maszyn", "badania_profilaktyczne"],
  lifting: ["bhp_okresowe", "slinger_signaller", "udt_zurawie"],
  cold_work: ["bhp_okresowe", "electrical_loto"],
  line_break: ["bhp_okresowe", "manual_handling", "badania_profilaktyczne"],
  roof_access: ["bhp_okresowe", "badania_wysokosc", "working_at_height"],
  night_works: ["bhp_okresowe", "first_aid", "badania_profilaktyczne"],
  valve_isolation: ["bhp_okresowe", "electrical_loto"],
  visitor_access: ["bhp_wstepne"],
  radiography: ["bhp_okresowe", "badania_profilaktyczne"],
  ground_disturbance: ["bhp_okresowe", "operator_maszyn", "asbestos_awareness"],
  line_clearance: ["bhp_okresowe", "orzeczenie_sanepid", "ghp_gmp"],
  rail_corridor_access: ["bhp_okresowe", "kolej_obszar", "badania_profilaktyczne"],
  ole_isolation: ["kolej_obszar", "sep_e", "electrical_loto"],
  on_track_plant: ["kolej_obszar", "operator_maszyn", "udt_zurawie"],
  marine_hydrographic: ["bhp_okresowe", "first_aid"],
  aerial_survey_coordination: ["bhp_okresowe", "badania_profilaktyczne"],
  general: ["bhp_wstepne", "bhp_okresowe"],
};

/** @param {import("../config/markets").MarketId} [marketId] */
export function getCertLibraryForMarket(marketId = "uk") {
  if (marketId === "au") return AU_CERT_LIBRARY;
  if (marketId === "pl") return PL_CERT_LIBRARY;
  if (marketId === "de") return DE_CERT_LIBRARY;
  if (marketId === "at") return DE_CERT_LIBRARY;
  if (marketId === "ch") return DE_CERT_LIBRARY;
  return CERT_LIBRARY;
}

function buildCertLabelMap(marketId = "uk") {
  return Object.fromEntries(getCertLibraryForMarket(marketId).map((c) => [c.code, c.label]));
}

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

const AU_PERMIT_CERT_REQUIREMENTS = {
  hot_work: ["white_card", "hot_work_fire_watch"],
  electrical: ["white_card", "electrical_loto"],
  work_at_height: ["white_card", "working_at_height", "hrwl"],
  confined_space: ["white_card", "confined_space", "gas_tester"],
  excavation: ["white_card", "asbestos_awareness"],
  lifting: ["white_card", "dogging", "hrwl"],
  cold_work: ["white_card", "electrical_loto"],
  line_break: ["white_card", "manual_handling"],
  roof_access: ["white_card", "working_at_height", "ewpa"],
  night_works: ["white_card", "first_aid"],
  valve_isolation: ["white_card", "electrical_loto"],
  visitor_access: ["white_card"],
  radiography: ["white_card"],
  ground_disturbance: ["white_card", "asbestos_awareness"],
  line_clearance: ["white_card", "manual_handling"],
  general: ["white_card"],
};

/** @param {string} permitType @param {import("../config/markets").MarketId} [marketId] */
export function getPermitCertRequirementsForMarket(permitType, marketId = "uk") {
  const map =
    marketId === "au"
      ? AU_PERMIT_CERT_REQUIREMENTS
      : marketId === "pl"
        ? PL_PERMIT_CERT_REQUIREMENTS
        : marketId === "de" || marketId === "at" || marketId === "ch"
          ? DE_PERMIT_CERT_REQUIREMENTS
          : PERMIT_CERT_REQUIREMENTS;
  return map[permitType] || map.general;
}

export function certLabel(codeOrName, marketId = "uk") {
  const k = String(codeOrName || "").trim().toLowerCase();
  const labels = buildCertLabelMap(marketId);
  return labels[k] || buildCertLabelMap("uk")[k] || String(codeOrName || "").trim();
}

export function addMonthsIso(startIso, months) {
  const d = startIso ? new Date(startIso) : new Date();
  if (!Number.isFinite(d.getTime())) return "";
  const x = new Date(d);
  x.setMonth(x.getMonth() + Number(months || 0));
  return localDateISO(x);
}

export function normalizeWorkerCertifications(worker) {
  const rows = Array.isArray(worker?.certifications) ? worker.certifications : [];
  return rows
    .map((c) => ({
      certCode: String(c?.certCode || c?.code || c?.certType || "").trim().toLowerCase(),
      certType: certLabel(c?.certCode || c?.code || c?.certType || "", getOrgMarketId()),
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

export function evaluateWorkerPermitEligibility(worker, permitType, atIso = new Date().toISOString(), marketId = getOrgMarketId()) {
  const requiredCodes = getPermitCertRequirementsForMarket(permitType, marketId);
  const certs = normalizeWorkerCertifications(worker);
  const byCode = Object.fromEntries(certs.map((c) => [String(c.certCode || "").toLowerCase(), c]));
  const now = new Date(atIso);
  const missing = [];
  const expired = [];
  const expiringSoon = [];
  requiredCodes.forEach((code) => {
    const cert = byCode[code];
    if (!cert) {
      missing.push(certLabel(code, marketId));
      return;
    }
    if (!cert.expiryDate) return;
    const t = new Date(cert.expiryDate).getTime();
    if (!Number.isFinite(t)) return;
    const days = Math.ceil((t - now.getTime()) / 86400000);
    if (days < 0) expired.push({ label: certLabel(code, marketId), days });
    else if (days <= 30) expiringSoon.push({ label: certLabel(code, marketId), days });
  });
  return {
    required: requiredCodes.map((c) => certLabel(c, marketId)),
    missing,
    expired,
    expiringSoon,
    eligible: missing.length === 0 && expired.length === 0,
  };
}

