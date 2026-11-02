/**
 * Geo-photo image storage — prefer R2 when configured; keep JPEG data URL as offline fallback.
 */
import {
  uploadFileToR2Storage,
  isR2StorageConfigured,
  pickR2ViewUrl,
  fetchR2ObjectBlob,
  isUsableR2PublicUrl,
} from "../lib/r2Storage";
import { dataUrlToBlob } from "./dataUrlBlob";
import { readGeoPhotoOffline, writeGeoPhotoOffline } from "./geoPhotoOfflineStore";
import { getOrgId, countryOperationalStorageKey } from "./orgStorage";

const mediaKey = (key) => `${countryOperationalStorageKey("mysafeops_geo_photo_media")}:${key}`;

async function readCachedImage(key) {
  const cached = await readGeoPhotoOffline(key);
  if (cached?.bytes instanceof ArrayBuffer && cached.bytes.byteLength) {
    return new Blob([cached.bytes], { type: cached.type || "image/jpeg" });
  }
  return cached?.size ? cached : null;
}

async function cacheImage(key, blob) {
  try {
    const bytes = await blob.arrayBuffer();
    return bytes.byteLength ? await writeGeoPhotoOffline(key, { bytes, type: blob.type }) : false;
  } catch { return false; }
}

function imageDataUrl(blob) {
  if (!blob?.size) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" && reader.result.startsWith("data:image/") ? reader.result : null);
    reader.onerror = reader.onabort = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Data URLs also display reliably for cached JPEGs in WebKit. */
export async function resolveGeoPhotoCachedDataUrl(storageKey) {
  if (!storageKey) return null;
  return imageDataUrl(await readCachedImage(mediaKey(storageKey)));
}

/** URL for thumbnails / survey import (embedded data first for offline, else signed/public R2). */
export function geoPhotoDisplayUrl(photo) {
  if (!photo) return "";
  if (photo.photoDataUrl) return photo.photoDataUrl;
  return (
    pickR2ViewUrl({
      signedUrl: photo.photoSignedUrl,
      signedExpiresAt: photo.photoSignedExpiresAt,
      publicUrl: photo.photoPublicUrl,
    }) ||
    (isUsableR2PublicUrl(photo.photoPublicUrl) ? photo.photoPublicUrl : "") ||
    ""
  );
}

/**
 * Keep a locally embedded image when the synced row comes back without one
 * (older rows were pushed to D1 with the base64 stripped and no R2 key).
 */
export function preserveGeoPhotoMedia(localRows, incomingRows) {
  const incoming = Array.isArray(incomingRows) ? incomingRows : [];
  const embedded = new Map();
  for (const row of Array.isArray(localRows) ? localRows : []) {
    if (row?.id && row.photoDataUrl) embedded.set(row.id, { dataUrl: row.photoDataUrl, storageKey: row.photoStorageKey || "" });
  }
  if (!embedded.size) return incoming;
  return incoming.map((row) => {
    if (!row?.id || row.photoDataUrl) return row;
    const local = embedded.get(row.id);
    if (!local || (row.photoStorageKey && row.photoStorageKey !== local.storageKey)) return row;
    return { ...row, photoDataUrl: local.dataUrl };
  });
}

/** True when the photo can be shown now or via authenticated R2 fetch. */
export function geoPhotoHasRenderableMedia(photo) {
  if (!photo) return false;
  if (photo.photoDataUrl || photo.photoStorageKey) return true;
  if (photo.photoSignedUrl) return true;
  return isUsableR2PublicUrl(photo.photoPublicUrl);
}

/**
 * Load image bytes from R2 via authenticated Worker GET /object (for photos that only have a storage key).
 * @param {string} storageKey
 * @returns {Promise<string|null>} object URL (caller should revoke)
 */
export async function resolveGeoPhotoObjectUrl(storageKey) {
  const key = String(storageKey || "").trim();
  if (!key) return null;
  const cacheKey = mediaKey(key);
  const cached = await readCachedImage(cacheKey);
  if (cached?.size) return URL.createObjectURL(cached);
  if (!isR2StorageConfigured()) return null;
  try {
    const blob = await fetchR2ObjectBlob(key);
    if (!blob || !blob.size) return null;
    await cacheImage(cacheKey, blob);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** PDF needs image bytes; public/signed URLs alone cannot be embedded by jsPDF. */
export async function resolveGeoPhotoPdfDataUrl(photo) {
  if (photo?.photoDataUrl?.startsWith("data:image/")) return photo.photoDataUrl;
  const cacheKey = photo?.photoStorageKey ? mediaKey(photo.photoStorageKey) : null;
  let blob = cacheKey ? await readCachedImage(cacheKey) : null;
  if (!blob?.size && photo?.photoStorageKey && isR2StorageConfigured()) {
    try {
      blob = await fetchR2ObjectBlob(photo.photoStorageKey);
    } catch {
      // A valid public/signed URL can still be available.
    }
  }
  if (!blob?.size) {
    const url = geoPhotoDisplayUrl(photo);
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      blob = await response.blob();
    } catch {
      return null;
    }
  }
  if (!blob?.size) return null;
  if (cacheKey) await cacheImage(cacheKey, blob);
  return imageDataUrl(blob);
}

/**
 * Upload compressed JPEG data URL to R2.
 * Returns null when storage unavailable / no org. Throws on auth or network upload failure
 * so the capture UI can keep the local photo and show a message.
 * @param {string} dataUrl
 * @param {{ projectId?: string, photoId?: string }} [opts]
 */
export async function uploadGeoPhotoToR2(dataUrl, opts = {}) {
  if (!dataUrl || !isR2StorageConfigured()) return null;
  const orgId = getOrgId();
  if (!orgId || orgId === "default") return null;

  const scope = countryOperationalStorageKey("mysafeops_geo_photo_media");
  const blob = dataUrlToBlob(dataUrl);
  const safeProject = String(opts.projectId || "unassigned")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 48);
  const file = new File([blob], `${opts.photoId || "geo"}.jpg`, { type: blob.type || "image/jpeg" });
  const uploaded = await uploadFileToR2Storage(file, {
    orgId,
    subPath: `geo-photos/${safeProject}`,
  });
  const photoOfflineCached = uploaded.key ? Boolean(await cacheImage(`${scope}:${uploaded.key}`, blob)) : false;
  return {
    photoOfflineCached,
    photoStorageKey: uploaded.key,
    photoPublicUrl: uploaded.publicUrl || null,
    photoSignedUrl: uploaded.signedUrl || null,
    photoSignedExpiresAt: uploaded.signedExpiresAt || null,
  };
}
