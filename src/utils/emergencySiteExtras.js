/** Shared org-scoped “site emergency” block used by Emergency contacts + RAMS import. */

import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

const KEY = "emergency_site_extras";

export function loadEmergencySiteExtras() {
  return loadOrgScoped(KEY, {});
}

export function saveEmergencySiteExtras(data) {
  saveOrgScoped(KEY, data);
}

export function googleMapsSearchUrl(query) {
  const q = String(query || "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function googleMapsDirectionsUrl(destination) {
  const d = String(destination || "").trim();
  if (!d) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}`;
}
