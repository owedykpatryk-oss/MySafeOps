/**
 * OpenStreetMap Nominatim (manual / button-triggered only; respect usage policy).
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * Results are cached in localStorage to reduce repeat requests (same normalised query, 30-day TTL).
 */
export const GEOCODE_CACHE_STORAGE_KEY = "mysafeops_geocode_cache";
/** Required by Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/ */
export const NOMINATIM_USER_AGENT = "MySafeOps/1.0 (UK construction safety; support@mysafeops.com)";
const CACHE_KEY = GEOCODE_CACHE_STORAGE_KEY;
const MAX_ENTRIES = 64;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** @type {Record<string, string>} Nominatim ISO 3166-1 alpha-2 */
const MARKET_COUNTRY_CODES = {
  uk: "gb",
  au: "au",
  pl: "pl",
};

/** @type {Record<string, string>} */
const MARKET_COUNTRY_LABELS = {
  uk: "United Kingdom",
  au: "Australia",
  pl: "Poland",
};

function marketCountryCode(marketId) {
  const id = String(marketId || "uk").toLowerCase();
  return MARKET_COUNTRY_CODES[id] || MARKET_COUNTRY_CODES.uk;
}

export function geocodeCountryLabel(marketId) {
  const id = String(marketId || "uk").toLowerCase();
  return MARKET_COUNTRY_LABELS[id] || MARKET_COUNTRY_LABELS.uk;
}

function normaliseQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const j = raw ? JSON.parse(raw) : null;
    if (j && typeof j.entries === "object" && j.entries !== null) return j;
  } catch {
    /* ignore */
  }
  return { v: 1, entries: {} };
}

function saveCache(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function pruneCache(entries) {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_ENTRIES) return entries;
  keys.sort((a, b) => (entries[b].t || 0) - (entries[a].t || 0));
  const next = {};
  keys.slice(0, MAX_ENTRIES).forEach((k) => {
    next[k] = entries[k];
  });
  return next;
}

export async function geocodeAddressNominatim(address, marketId = "uk") {
  const q = normaliseQuery(address);
  if (!q) return null;

  const countryCode = marketCountryCode(marketId);
  const cacheKey = `${countryCode}|${q}`;
  const cache = loadCache();
  const hit = cache.entries[cacheKey];
  if (hit && typeof hit.lat === "number" && typeof hit.lng === "number" && Date.now() - (hit.t || 0) < TTL_MS) {
    return { lat: hit.lat, lng: hit.lng };
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=${countryCode}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    },
  });
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) return null;
  const lat = Number.parseFloat(data[0].lat);
  const lng = Number.parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  cache.entries[cacheKey] = { lat, lng, t: Date.now() };
  cache.entries = pruneCache(cache.entries);
  saveCache(cache);

  return { lat, lng };
}
