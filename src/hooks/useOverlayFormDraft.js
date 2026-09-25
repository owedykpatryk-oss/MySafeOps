import { useEffect, useRef } from "react";

/**
 * Persist overlay editor state across iOS camera / PWA remounts.
 */

export function overlayDraftKey(moduleId, recordId) {
  return `mso_overlay_draft_${String(moduleId || "form")}_${String(recordId || "new")}`;
}

export function clearOverlayFormDraft(key) {
  if (!key || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function writeOverlayFormDraft(key, data) {
  if (!key || typeof sessionStorage === "undefined" || data == null) return false;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    try {
      const slim = { ...data };
      delete slim.photo;
      delete slim.photos;
      delete slim.sig;
      delete slim.attendees;
      sessionStorage.setItem(key, JSON.stringify(slim));
      return true;
    } catch {
      return false;
    }
  }
}

export function readOverlayFormDraft(key) {
  if (!key || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeOverlayDraft(prev, draft) {
  if (!draft || typeof draft !== "object") return prev;
  const next = { ...prev, ...draft };
  if (Array.isArray(prev?.photos) && prev.photos.length && !(draft.photos || []).length) {
    next.photos = prev.photos;
  }
  if (prev?.photo && !draft.photo) next.photo = prev.photo;
  return next;
}

export function seedOverlayForm(base, key) {
  const draft = readOverlayFormDraft(key);
  return draft ? mergeOverlayDraft(base, draft) : base;
}

/**
 * @param {string} key
 * @param {object} form
 * @param {Function} setForm
 */
export function useOverlayFormDraft(key, form, setForm) {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!key || restoredRef.current) return;
    restoredRef.current = true;
    const draft = readOverlayFormDraft(key);
    if (!draft) return;
    setForm((prev) => mergeOverlayDraft(prev, draft));
  }, [key, setForm]);

  useEffect(() => {
    if (!key) return undefined;
    const flush = () => writeOverlayFormDraft(key, form);
    const t = window.setTimeout(flush, 400);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [key, form]);
}
