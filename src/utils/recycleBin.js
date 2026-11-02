import { loadOrgScoped, saveOrgScoped } from "./orgStorage";
import { replaceWithTombstone } from "./d1ArrayMerge";
import { OPS_TOAST_EVENT_NAME } from "./clientOpsMonitor";
import { getOrgMarketId } from "./orgMarket";
import { tf } from "../i18n/workspaceStrings";

export const RECYCLE_BIN_KEY = "mysafeops_recycle_bin_v1";
export const RECYCLE_RETENTION_DAYS = 7;
const RETENTION_MS = RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_BIN_ITEMS = 400;

const genRecycleId = () => `bin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function isValidEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (!entry.id || !entry.deletedAt || !entry.expiresAt) return false;
  if (!entry.sourceKey || !entry.payload) return false;
  return true;
}

function cleanupEntries(list, now = Date.now()) {
  const source = Array.isArray(list) ? list : [];
  return source
    .filter((entry) => {
      if (!isValidEntry(entry)) return false;
      const expiresAt = new Date(entry.expiresAt).getTime();
      if (Number.isNaN(expiresAt)) return false;
      return expiresAt > now;
    })
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
    .slice(0, MAX_BIN_ITEMS);
}

function readBinRaw() {
  return loadOrgScoped(RECYCLE_BIN_KEY, []);
}

function writeBin(items) {
  return saveOrgScoped(RECYCLE_BIN_KEY, items);
}

function readCleanBin() {
  const raw = readBinRaw();
  const clean = cleanupEntries(raw);
  if (JSON.stringify(raw) !== JSON.stringify(clean)) {
    writeBin(clean);
  }
  return clean;
}

export function listRecycleBinEntries() {
  return readCleanBin();
}

export function pushRecycleBinItem({
  moduleId,
  moduleLabel,
  itemType,
  itemLabel,
  sourceKey,
  payload,
}) {
  if (!sourceKey || !payload || typeof payload !== "object") return null;
  const now = Date.now();
  const deletedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + RETENTION_MS).toISOString();
  const entry = {
    id: genRecycleId(),
    moduleId: String(moduleId || "unknown"),
    moduleLabel: String(moduleLabel || moduleId || "Unknown module"),
    itemType: String(itemType || "item"),
    itemLabel: String(itemLabel || payload.title || payload.name || payload.id || "Deleted item"),
    sourceKey: String(sourceKey),
    payload,
    originalId: payload.id || null,
    deletedAt,
    expiresAt,
  };
  const current = readCleanBin();
  if (writeBin([entry, ...current].slice(0, MAX_BIN_ITEMS)) !== true) return null;
  return entry;
}

const DEFAULT_SOFT_DELETE_MSG = "Delete this record? It moves to Recycle Bin for 7 days.";

/**
 * Confirm, archive and persist the deletion before returning true. Callers then
 * mirror the tombstone in React state. Failed writes leave the live record intact.
 */
export function softDeleteToRecycleBin({
  confirmMessage = DEFAULT_SOFT_DELETE_MSG,
  moduleId,
  moduleLabel,
  itemType = "item",
  itemLabel,
  sourceKey,
  payload,
}) {
  if (!sourceKey || !payload?.id || payload.deletedAt) return false;
  if (!window.confirm(confirmMessage)) return false;
  const current = loadOrgScoped(sourceKey, []);
  const live = current.find(row => row?.id === payload.id && !row.deletedAt);
  if (!live) return false;
  const notify = (key, type, vars = {}) => window.dispatchEvent(new CustomEvent(OPS_TOAST_EVENT_NAME, {
    detail: { type, message: tf(key, getOrgMarketId(), vars) },
  }));
  const archived = pushRecycleBinItem({ moduleId, moduleLabel, itemType, itemLabel, sourceKey, payload: live });
  if (!archived) { notify("recordCouldNotRemove", "warn"); return false; }
  if (!saveOrgScoped(sourceKey, replaceWithTombstone(current, live.id))) {
    deleteRecycleBinEntry(archived.id);
    notify("recordCouldNotRemove", "warn");
    return false;
  }
  notify("recordRemoved", "success", { name: itemLabel || live.name || live.title || live.id, days: RECYCLE_RETENTION_DAYS });
  return true;
}

export function deleteRecycleBinEntry(entryId) {
  const current = readCleanBin();
  const next = current.filter((x) => x.id !== entryId);
  return writeBin(next) === true;
}

export function purgeExpiredRecycleBinEntries() {
  const raw = readBinRaw();
  const clean = cleanupEntries(raw);
  if (writeBin(clean) !== true) return 0;
  return Math.max(0, (Array.isArray(raw) ? raw.length : 0) - clean.length);
}

export function restoreRecycleBinEntry(entryId) {
  const current = readCleanBin();
  const entry = current.find((x) => x.id === entryId);
  if (!entry) return { ok: false, reason: "Entry not found or already expired." };
  const list = loadOrgScoped(entry.sourceKey, []);
  if (!Array.isArray(list)) return { ok: false, reason: "Restore target is not a list." };
  const payload = entry.payload;
  const payloadId = payload?.id;
  if (payloadId && list.some((row) => row?.id === payloadId && !row.deletedAt)) {
    return { ok: false, reason: "A live record with this ID already exists. Remove or review it before restoring the older copy." };
  }
  const restoredAt = new Date().toISOString();
  const livePayload =
    payload && typeof payload === "object"
      ? (() => {
          const { deletedAt: _deletedAt, ...rest } = payload;
          return { ...rest, updatedAt: restoredAt };
        })()
      : payload;
  let next;
  if (payloadId) {
    // Drop any tombstone / prior row with the same id, then re-insert the live payload.
    next = [livePayload, ...list.filter((x) => x?.id !== payloadId)];
  } else {
    next = [livePayload, ...list];
  }
  if (saveOrgScoped(entry.sourceKey, next) !== true) {
    return { ok: false, reason: "The restored record could not be saved on this device." };
  }
  if (writeBin(current.filter((x) => x.id !== entryId)) !== true) {
    return { ok: true, warning: "The record was restored, but its Recycle Bin entry could not be removed." };
  }
  return { ok: true };
}
