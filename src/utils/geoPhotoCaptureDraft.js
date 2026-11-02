import { countryOperationalStorageKey } from "./orgStorage";
import { readGeoPhotoOffline, writeGeoPhotoOffline, deleteGeoPhotoOffline } from "./geoPhotoOfflineStore";

export const CAPTURE_DRAFT_KEY = "mysafeops_geo_photo_capture_draft";
const valid = (draft) => typeof draft?.photoDataUrl === "string" && draft.photoDataUrl.startsWith("data:image/");
export function readSessionCaptureDraft(key = countryOperationalStorageKey(CAPTURE_DRAFT_KEY)) {
  try { const draft = JSON.parse(sessionStorage.getItem(key)); return valid(draft) ? draft : null; }
  catch { return null; }
}
export async function readCaptureDraft(key) {
  const draft = await readGeoPhotoOffline(key);
  return valid(draft) ? draft : null;
}
export async function writeCaptureDraft(draft, key = countryOperationalStorageKey(CAPTURE_DRAFT_KEY)) {
  if (!valid(draft)) return false;
  try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* Durable fallback below. */ }
  const durableSaved = await writeGeoPhotoOffline(key, draft);
  return Boolean(durableSaved);
}
export async function clearCaptureDraft(key = countryOperationalStorageKey(CAPTURE_DRAFT_KEY)) {
  try { sessionStorage.removeItem(key); } catch { /* Durable copy is cleared independently. */ }
  return deleteGeoPhotoOffline(key);
}
