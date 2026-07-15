/**
 * Helpers so weather / A&E stay tied to the current site coordinates.
 */

export function clearSiteEnrichmentFields(form = {}) {
  return {
    ...form,
    nearestHospital: "",
    hospitalDirectionsUrl: "",
    hospitalRouteScreenshotUrl: "",
    hospitalRouteCapturedAt: "",
    weatherSnapshot: "",
    weatherFetchedAt: "",
    weatherAtStartSnapshot: "",
    weatherAtStartDate: "",
    siteEnrichmentFor: "",
    siteEnrichmentAt: "",
  };
}

/** Fingerprint for lat/lng (4 dp ≈ 11 m) used to detect stale enrichment. */
export function siteCoordFingerprint(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";
  return `${la.toFixed(4)},${lo.toFixed(4)}`;
}

export function siteEnrichmentMatchesCoords(form, lat, lng) {
  const fp = siteCoordFingerprint(lat, lng);
  if (!fp) return false;
  return String(form?.siteEnrichmentFor || "") === fp;
}

export function withSiteEnrichment(form, { lat, lng, weather, hospital }) {
  const fp = siteCoordFingerprint(lat, lng);
  return {
    ...form,
    lat: Number.isFinite(Number(lat)) ? String(lat) : form.lat,
    lng: Number.isFinite(Number(lng)) ? String(lng) : form.lng,
    weatherSnapshot: weather?.text || "",
    weatherFetchedAt: weather?.fetchedAt || "",
    nearestHospital: hospital?.summary || "",
    hospitalDirectionsUrl: hospital?.directions_url || "",
    siteEnrichmentFor: fp,
    siteEnrichmentAt: new Date().toISOString(),
  };
}

/**
 * Human label for the enrichment card (postcode preferred, else coords).
 */
export function formatSiteEnrichmentCaption(form) {
  const pc = String(form?.postcode || "").trim();
  const at = form?.siteEnrichmentAt ? new Date(form.siteEnrichmentAt) : null;
  const when =
    at && !Number.isNaN(at.getTime())
      ? at.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "";
  const where = pc || form?.siteEnrichmentFor || "current map pin";
  if (when) return `For ${where} · fetched ${when}`;
  return `For ${where}`;
}
