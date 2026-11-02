import { countryOperationalStorageKey, loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";

export const RAMS_DOCUMENTS_KEY = "rams_builder_docs";

export function ramsDocumentStorageScope() {
  return countryOperationalStorageKey(RAMS_DOCUMENTS_KEY);
}

function snapshot(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
  });
}

/**
 * Transitional save for the existing list-based editor, not the new per-record store.
 * Confirm local persistence before discarding the recovery draft or leaving the form.
 * The localStorage read/check/write cannot provide cross-tab atomicity.
 */
export function commitRamsDocument({ document, editingDocument, expectedScope }) {
  if (!expectedScope || ramsDocumentStorageScope() !== expectedScope) return { ok: false, reason: "workspace_changed" };
  if (!document?.id || (editingDocument && editingDocument.id !== document.id)) return { ok: false, reason: "invalid_document" };
  try {
    const current = loadOrgScoped(RAMS_DOCUMENTS_KEY, []);
    if (!Array.isArray(current)) return { ok: false, reason: "storage_failed" };
    const existing = current.find((row) => row.id === document.id);
    if (editingDocument ? !existing || existing.deletedAt || snapshot(existing) !== snapshot(editingDocument) : existing) {
      return { ok: false, reason: "document_changed" };
    }
    // Operatives signed a particular content revision, not future edits to it.
    if (editingDocument && document.contentHash !== editingDocument.contentHash) {
      document = { ...document, operativeSignatures: {} };
    }
    const documents = editingDocument
      ? current.map((row) => row.id === document.id ? document : row)
      : [document, ...current];
    if (saveOrgScoped(RAMS_DOCUMENTS_KEY, documents) !== true) return { ok: false, reason: "storage_failed" };
    return { ok: true, documents };
  } catch {
    return { ok: false, reason: "storage_failed" };
  }
}
