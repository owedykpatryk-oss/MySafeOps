/**
 * Geo-photo image storage — prefer R2 when configured; keep JPEG data URL as offline fallback.
 */
import { uploadFileToR2Storage, isR2StorageConfigured } from "../lib/r2Storage";
import { getOrgId } from "./orgStorage";

/** URL for thumbnails / survey import (R2 public URL or embedded data). */
export function geoPhotoDisplayUrl(photo) {
  if (!photo) return "";
  return photo.photoDataUrl || photo.photoPublicUrl || "";
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
    const res = await fetch(dataUrl);
    const blob = await res.blob();
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
    };
  } catch {
    return null;
  }
}
