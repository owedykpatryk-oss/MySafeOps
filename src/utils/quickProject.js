/**
 * Quick field project — name (and optionally address / GPS) is enough to start
 * capturing on site. The office completes the rest later in Projects, where
 * projectFormShape() backfills every remaining field on first edit.
 */

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
const NAME_MAX = 120;
const ADDRESS_MAX = 240;

function normaliseName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function coord(value) {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return "";
  return Math.round(n * 1e6) / 1e6;
}

export function postcodeFromAddress(address = "") {
  const m = String(address || "").match(UK_POSTCODE_RE);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : "";
}

/** Field users retype site names — reuse the existing project instead of duplicating it. */
export function findProjectByName(name, projects = []) {
  const key = normaliseName(name);
  if (!key) return null;
  return (Array.isArray(projects) ? projects : []).find((p) => normaliseName(p?.name) === key) || null;
}

export function quickProjectNameError(name, projects = []) {
  const clean = String(name || "").trim();
  if (!clean) return "Enter a site or project name.";
  if (findProjectByName(clean, projects)) return "A project with this name already exists.";
  return "";
}

export function buildQuickProject({ name, address = "", latitude = null, longitude = null, createdBy = "" } = {}) {
  const cleanName = String(name || "").trim().slice(0, NAME_MAX);
  if (!cleanName) return null;
  const cleanAddress = String(address || "").trim().slice(0, ADDRESS_MAX);
  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    site: cleanAddress,
    address: cleanAddress,
    postcode: postcodeFromAddress(cleanAddress),
    client: "",
    code: "",
    lat: coord(latitude),
    lng: coord(longitude),
    closed: false,
    quickCreated: true,
    createdBy: String(createdBy || "").trim(),
    createdAt: new Date().toISOString(),
  };
}
