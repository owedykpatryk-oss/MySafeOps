const DEFAULT_PRIMARY = "#0d9488";
const DEFAULT_ACCENT = "#f97316";

/** @param {string} hex */
export function normalizeHex(hex, fallback = DEFAULT_PRIMARY) {
  const raw = String(hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

/** @param {string} hex */
export function hexToRgb(hex) {
  const h = normalizeHex(hex).replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** @param {string} hex @param {number} amount -1..1 (negative = darker) */
export function shadeHex(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c) => Math.round((t - c) * p + c);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** @param {Record<string, unknown>} org from getOrgSettings() */
export function buildOrgBrandingCssVars(org) {
  const primary = normalizeHex(org?.primaryColor, DEFAULT_PRIMARY);
  const accent = normalizeHex(org?.accentColor, DEFAULT_ACCENT);
  const [r, g, b] = hexToRgb(primary);
  return {
    "--color-accent": primary,
    "--color-accent-hover": shadeHex(primary, -0.14),
    "--color-accent-muted": `rgba(${r}, ${g}, ${b}, 0.16)`,
    "--color-accent-subtle": `rgba(${r}, ${g}, ${b}, 0.14)`,
    "--org-accent-secondary": accent,
  };
}

/** @param {string} name */
export function formatOrgDisplayName(name) {
  const n = String(name || "").trim();
  if (!n || n === "My Organisation") return "MySafeOps";
  return n;
}

/** @param {Record<string, unknown>} org */
export function orgHasCustomBranding(org) {
  const name = String(org?.name || "").trim();
  return Boolean(org?.logo || (name && name !== "My Organisation"));
}
