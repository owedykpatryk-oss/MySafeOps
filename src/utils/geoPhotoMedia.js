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
import { getOrgId } from "./orgStorage";

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
  if (!key || !isR2StorageConfigured()) return null;
  try {
    const blob = await fetchR2ObjectBlob(key);
    if (!blob || !blob.size) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Upload compressed JPEG data URL to R2. Returns null when storage unavailable or upload fails.
 * @param {string} dataUrl
 * @param {{ projectId?: string, photoId?: string }} [opts]
 */
export async function uploadGeoPhotoToR2(dataUrl, opts = {}) {
  if (!dataUrl || !isR2StorageConfigured()) return null;
  const orgId = getOrgId();
  if (!orgId || orgId === "default") return null;

  try {
    const blob = dataUrlToBlob(dataUrl);
    const safeProject = String(opts.projectId || "unassigned")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 48);
    const file = new File([blob], `${opts.photoId || "geo"}.jpg`, { type: blob.type || "image/jpeg" });
    const uploaded = await uploadFileToR2Storage(file, {
      orgId,
      subPath: `geo-photos/${safeProject}`,
    });
    return {
      photoStorageKey: uploaded.key,
      photoPublicUrl: uploaded.publicUrl || null,
      photoSignedUrl: uploaded.signedUrl || null,
      photoSignedExpiresAt: uploaded.signedExpiresAt || null,
    };
  } catch {
    return null;
  }
}
