/**
 * Slim payloads before D1 PUT — keep full media in React state / local cache,
 * avoid rewriting multi‑MB base64 blobs on every keystroke under concurrent editors.
 */

function stripDataUrlField(obj, key = "dataUrl") {
  if (!obj || typeof obj !== "object") return obj;
  const url = obj[key];
  if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
    return { ...obj, [key]: url.trim() };
  }
  if (typeof url === "string" && url.startsWith("data:")) {
    const { [key]: _drop, ...rest } = obj;
    return { ...rest, [key]: "", hasLocalMedia: true };
  }
  return obj;
}

/** @param {unknown} reports */
export function stripSurveyReportsForD1(reports) {
  if (!Array.isArray(reports)) return reports;
  return reports.map((row) => {
    if (!row || typeof row !== "object") return row;
    const photos = Array.isArray(row.photos) ? row.photos.map((ph) => stripDataUrlField(ph)) : row.photos;
    return { ...row, photos };
  });
}

/** Embedded images kept in the synced payload when R2 has no copy (keeps the KV value sane). */
const GEO_PHOTO_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function geoPhotoHasRemoteCopy(ph) {
  if (String(ph?.photoStorageKey || "").trim()) return true;
  return isHttpUrl(ph?.photoSignedUrl) || isHttpUrl(ph?.photoPublicUrl);
}

function geoPhotoTime(ph) {
  const t = Date.parse(String(ph?.timestampUtc || ph?.updatedAt || ph?.createdAt || ""));
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param {unknown} photos
 * Rows whose only copy is the embedded base64 keep it: a stripped row renders as a
 * blank photo on every other device, and the bytes are then gone for good.
 */
export function stripGeoPhotosForD1(photos) {
  if (!Array.isArray(photos)) return photos;

  const keepEmbedded = new Set();
  let budget = GEO_PHOTO_EMBED_BUDGET_BYTES;
  const orphans = photos
    .filter(
      (ph) =>
        ph?.id &&
        typeof ph.photoDataUrl === "string" &&
        ph.photoDataUrl.startsWith("data:") &&
        !geoPhotoHasRemoteCopy(ph)
    )
    .sort((a, b) => geoPhotoTime(b) - geoPhotoTime(a));
  for (const ph of orphans) {
    const size = ph.photoDataUrl.length;
    if (size > budget) continue;
    budget -= size;
    keepEmbedded.add(ph.id);
  }

  return photos.map((ph) => {
    if (!ph || typeof ph !== "object") return ph;
    if (ph.id && keepEmbedded.has(ph.id)) return ph;
    // Geo-photos use photoDataUrl; keep legacy dataUrl strip for older rows.
    return stripDataUrlField(stripDataUrlField(ph, "photoDataUrl"), "dataUrl");
  });
}

/** Daily briefing / toolbox — strip attendee signature data URLs */
export function stripBriefingsForD1(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const attendees = Array.isArray(row.attendees)
      ? row.attendees.map((a) => {
          if (!a || typeof a !== "object") return a;
          const sig = a.sig || a.signature;
          if (typeof sig === "string" && sig.startsWith("data:")) {
            const { sig: _s, signature: _sig, ...rest } = a;
            return { ...rest, sig: "", hasLocalSig: true };
          }
          return a;
        })
      : row.attendees;
    return { ...row, attendees };
  });
}

/** GPR reports — strip radargram / plan figure base64 before D1 PUT */
export function stripGprReportsForD1(reports) {
  if (!Array.isArray(reports)) return reports;
  return reports.map((row) => {
    if (!row || typeof row !== "object") return row;
    const radargrams = Array.isArray(row.radargrams)
      ? row.radargrams.map((rg) => stripDataUrlField(rg))
      : row.radargrams;
    const planFigures = Array.isArray(row.planFigures)
      ? row.planFigures.map((pf) => stripDataUrlField(pf))
      : row.planFigures;
    return { ...row, radargrams, planFigures };
  });
}
