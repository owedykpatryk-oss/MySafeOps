/**
 * Utility Mapping client catalogue — 3-letter job codes + logo paths.
 * Ref format: UM{YY}-{job}-{CODE} e.g. UM26-1234-WSP
 * Org-exclusive — only used when isUtilityMappingOrg().
 */
import { isUtilityMappingOrg } from "./utilityMappingOrg";

export const UM_CLIENT_LOGO_BASE = "/branding/utility-mapping/clients";

/**
 * @typedef {{ code: string, name: string, file: string }} UmClient
 */

/** @type {UmClient[]} */
export const UM_CLIENTS = [
  { code: "3DS", name: "3DS", file: "3DS.png" },
  { code: "ABC", name: "ABC", file: "ABC.png" },
  { code: "AEC", name: "AEC", file: "AEC.jpg" },
  { code: "AIS", name: "AIS", file: "AIS.jpg" },
  { code: "BAE", name: "BAE Systems", file: "BAE.jpg" },
  { code: "BCC", name: "BCC", file: "BCC.jpg" },
  { code: "BCL", name: "BCL", file: "BCL.png" },
  { code: "BDS", name: "BDS", file: "BDS.jpg" },
  { code: "BEC", name: "BEC", file: "BEC.jpg" },
  { code: "BFS", name: "Brownfield Solutions", file: "BFS.jpg" },
  { code: "BIO", name: "BIO", file: "BIO.jpg" },
  { code: "BIR", name: "Birmingham Drains", file: "BIR.jpg" },
  { code: "BRW", name: "Bridgeway", file: "BRW.png" },
  { code: "BTP", name: "BTP", file: "BTP.jpg" },
  { code: "CAD", name: "CAD", file: "CAD.jpg" },
  { code: "CBS", name: "CBS", file: "CBS.jpg" },
  { code: "CDX", name: "CDX", file: "CDX.jpg" },
  { code: "CMK", name: "CM Kiernan", file: "CMK.jpg" },
  { code: "DGAD", name: "DGAD", file: "DGAD.jpg" },
  { code: "ECSL", name: "ECSL", file: "ECSL.jpg" },
  { code: "EDN", name: "EDN", file: "EDN.jpg" },
  { code: "ELT", name: "ELT", file: "ELT.jpg" },
  { code: "EVA", name: "Evabuild", file: "EVA.jpg" },
  { code: "FAIR", name: "FAIR", file: "FAIR.jpg" },
  { code: "FCL", name: "Faircloth Construction", file: "FCL.jpg" },
  { code: "FWC", name: "FWC", file: "FWC.jpg" },
  { code: "GRP", name: "Group", file: "GRP.png" },
  { code: "GWD", name: "GWD", file: "GWD.jpg" },
  { code: "HBA", name: "HBA", file: "HBA.jpg" },
  { code: "HDR", name: "HDR Group", file: "HDR.png" },
  { code: "HYD", name: "HYD", file: "HYD.jpg" },
  { code: "ISG", name: "ISG", file: "ISG.jpg" },
  { code: "JAC", name: "Jacobs", file: "JAC.jpg" },
  { code: "JLL", name: "JLL", file: "JLL.jpg" },
  { code: "JRA", name: "JRA", file: "JRA.png" },
  { code: "MIN", name: "MIN", file: "MIN.jpg" },
  { code: "MOB", name: "Mobilium Telford", file: "MOB.jpg" },
  { code: "MOD", name: "Modus", file: "MOD.jpg" },
  { code: "MSL", name: "MSL", file: "MSL.jpg" },
  { code: "NHS", name: "NHS Property Services", file: "NHS.jpg" },
  { code: "NMCN", name: "NMCN", file: "NMCN.jpg" },
  { code: "NTX", name: "Networx", file: "NTX.jpg" },
  { code: "RD10", name: "RD10", file: "RD10.jpg" },
  { code: "RED", name: "Reds 10", file: "RED.png" },
  { code: "SBD", name: "SBD", file: "SBD.jpg" },
  { code: "SCH", name: "School", file: "SCH.png" },
  { code: "TOR", name: "Torsion", file: "TOR.jpg" },
  { code: "TPO", name: "TPO", file: "TPO.jpg" },
  { code: "TWU", name: "Thames Water", file: "TWU.jpg" },
  { code: "VEO", name: "VEO", file: "VEO.jpg" },
  { code: "WAR", name: "Warner Surveys", file: "WAR.png" },
  { code: "WBW", name: "WBW", file: "WBW.jpg" },
  { code: "WGY", name: "WGY", file: "WGY.jpg" },
  { code: "WSP", name: "WSP", file: "WSP.png" },
  { code: "YCE", name: "Ysgol Caer Elen", file: "YCE.png" },
  { code: "YPR", name: "Ysgol Preseli", file: "YPR.jpg" },
];

const byCode = new Map(UM_CLIENTS.map((c) => [c.code.toUpperCase(), c]));

/** @returns {UmClient[]} */
export function listUtilityMappingClients() {
  if (!isUtilityMappingOrg()) return [];
  return UM_CLIENTS.slice().sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * @param {string} code
 * @returns {UmClient | null}
 */
export function getUtilityMappingClient(code) {
  if (!isUtilityMappingOrg()) return null;
  const key = String(code || "").trim().toUpperCase();
  if (!key) return null;
  return byCode.get(key) || null;
}

/**
 * Public URL for a client logo, or empty string.
 * @param {string} code
 */
export function utilityMappingClientLogoUrl(code) {
  if (!isUtilityMappingOrg()) return "";
  const c = getUtilityMappingClient(code);
  if (!c) return "";
  return `${UM_CLIENT_LOGO_BASE}/${c.file}`;
}

/**
 * Match free-text client name to a catalogue code.
 * @param {string} clientName
 * @returns {string} code or ""
 */
export function matchUtilityMappingClientCode(clientName) {
  if (!isUtilityMappingOrg()) return "";
  const raw = String(clientName || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (byCode.has(upper)) return upper;
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  for (const c of UM_CLIENTS) {
    if (c.code.toUpperCase() === compact) return c.code;
    if (c.name.toUpperCase() === upper) return c.code;
    if (upper.includes(c.name.toUpperCase()) || c.name.toUpperCase().includes(upper)) return c.code;
  }
  // Already looks like a short code typed by user
  if (/^[A-Z0-9]{2,5}$/.test(compact) && compact.length <= 5) return compact;
  return "";
}
