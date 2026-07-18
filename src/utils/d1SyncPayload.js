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

/** @param {unknown} photos */
export function stripGeoPhotosForD1(photos) {
  if (!Array.isArray(photos)) return photos;
  return photos.map((ph) => stripDataUrlField(ph));
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
