import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

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
  saveOrgScoped(RECYCLE_BIN_KEY, items);
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
  writeBin([entry, ...current].slice(0, MAX_BIN_ITEMS));
  return entry;
}

export function deleteRecycleBinEntry(entryId) {
  const current = readCleanBin();
  const next = current.filter((x) => x.id !== entryId);
  writeBin(next);
}

export function purgeExpiredRecycleBinEntries() {
  const raw = readBinRaw();
  const clean = cleanupEntries(raw);
  writeBin(clean);
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
  let next = list;
  if (payloadId) {
    const idx = list.findIndex((x) => x?.id === payloadId);
    if (idx >= 0) {
      next = [...list];
      next[idx] = payload;
    } else {
      next = [payload, ...list];
    }
  } else {
    next = [payload, ...list];
  }
  saveOrgScoped(entry.sourceKey, next);
  writeBin(current.filter((x) => x.id !== entryId));
  return { ok: true };
}
