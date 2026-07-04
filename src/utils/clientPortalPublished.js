/**
 * Persist which portal tokens were published to cloud (org-scoped).
 */
import { orgScopedKey } from "./orgStorage";

const STORAGE_SUFFIX = "client_portal_published_tokens";

function storageKey() {
  return orgScopedKey(STORAGE_SUFFIX);
}

export function loadPublishedPortalTokens() {
  try {
    const raw = localStorage.getItem(storageKey());
    const arr = JSON.parse(raw || "[]");
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

export function markPortalPublished(token) {
  if (!token) return;
  const set = loadPublishedPortalTokens();
  set.add(token);
  localStorage.setItem(storageKey(), JSON.stringify([...set]));
}

export function unmarkPortalPublished(token) {
  if (!token) return;
  const set = loadPublishedPortalTokens();
  set.delete(token);
  localStorage.setItem(storageKey(), JSON.stringify([...set]));
}
