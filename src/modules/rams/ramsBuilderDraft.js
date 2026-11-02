/** Session-only recovery copies. Legacy unowned data is deliberately never adopted. */
export const LEGACY_RAMS_DRAFT_KEY = "mysafeops_rams_builder_draft";
export const RAMS_DRAFT_SAVED_EVENT = "mysafeops-rams-draft-saved";
const PREFIX = "mysafeops_rams_draft_v2:";

export function ramsDraftScope({ userId, localOnly = false, storageScope }) {
  if (!storageScope || (!localOnly && !userId)) return null;
  return JSON.stringify([localOnly ? "local" : "account", localOnly ? "" : String(userId), storageScope]);
}

function prefix(scope) { return `${PREFIX}${encodeURIComponent(scope)}:`; }
function key(scope, documentId) { return `${prefix(scope)}${encodeURIComponent(documentId)}`; }

function validState(state, documentId) {
  return state && Number.isInteger(state.step) && state.step >= 1 && state.step <= 4
    && state.form && typeof state.form === "object" && !Array.isArray(state.form)
    && Array.isArray(state.editedRows) && Array.isArray(state.selectedHazards)
    && (state.editingDocument === null || state.editingDocument?.id === documentId);
}

export function readRamsDraft(scope, documentId) {
  if (!scope || !documentId) return null;
  try {
    const draft = JSON.parse(sessionStorage.getItem(key(scope, documentId)));
    if (!draft || draft.version !== 2 || draft.scope !== scope || draft.documentId !== documentId) return null;
    if (!Number.isFinite(draft.savedAt) || !validState(draft, documentId)) return null;
    return draft;
  } catch { return null; }
}

export function listRamsDrafts(scope) {
  if (!scope) return [];
  try {
    const drafts = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const storedKey = sessionStorage.key(i);
      if (!storedKey?.startsWith(prefix(scope))) continue;
      try {
        const draft = readRamsDraft(scope, decodeURIComponent(storedKey.slice(prefix(scope).length)));
        if (draft) drafts.push(draft);
      } catch { /* Preserve malformed keys for recovery. */ }
    }
    return drafts.sort((a, b) => b.savedAt - a.savedAt);
  } catch { return []; }
}

export function latestRamsDraft(scope) { return listRamsDrafts(scope)[0] || null; }

export function writeRamsDraft(scope, documentId, state) {
  if (!scope || !documentId) return false;
  const editingDocument = state?.editingDocument ?? null;
  if (!validState({ ...state, editingDocument }, documentId)) return false;
  try {
    sessionStorage.setItem(key(scope, documentId), JSON.stringify({
      ...state, editingDocument,
      version: 2, scope, documentId, savedAt: Date.now(),
    }));
    return true;
  } catch { return false; }
}

export function clearRamsDraft(scope, documentId) {
  if (!scope || !documentId) return false;
  try { sessionStorage.removeItem(key(scope, documentId)); return true; }
  catch { return false; }
}

export function hasLegacyRamsDraft() {
  try { return sessionStorage.getItem(LEGACY_RAMS_DRAFT_KEY) !== null; }
  catch { return false; }
}
