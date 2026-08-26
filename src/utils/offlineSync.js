/**
 * Offline-first sync engine for construction site operations.
 * Queues edits/uploads while offline, syncs batch when connectivity returns.
 *
 * Storage keys:
 * - mysafeops_sync_queue: items awaiting upload
 * - mysafeops_sync_failed: items that failed (with error + retry count)
 */

import { useEffect, useRef, useState } from "react";

const SYNC_QUEUE_KEY = "mysafeops_sync_queue";
const SYNC_FAILED_KEY = "mysafeops_sync_failed";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/** @typedef {{
 *   id: string;
 *   type: 'photo' | 'record' | 'signature';
 *   timestamp: number;
 *   payload: any;
 *   retries: number;
 *   lastError?: string;
 * }} SyncItem */

export function readSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSyncQueue(items) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export function readFailedSync() {
  try {
    const raw = localStorage.getItem(SYNC_FAILED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeFailedSync(items) {
  try {
    localStorage.setItem(SYNC_FAILED_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

/**
 * Add item to sync queue. If online, attempts immediate sync.
 * @param {SyncItem} item
 * @param {Function} [onSync] - async handler(item) => result
 */
export async function queueForSync(item, onSync) {
  const id = item.id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const queueItem = {
    ...item,
    id,
    timestamp: item.timestamp || Date.now(),
    retries: 0,
  };

  if (typeof navigator !== "undefined" && navigator.onLine && onSync) {
    try {
      await onSync(queueItem);
      return { success: true, id };
    } catch (err) {
      queueItem.lastError = err?.message || "Unknown error";
    }
  }

  const queue = readSyncQueue();
  queue.push(queueItem);
  writeSyncQueue(queue);
  return { success: false, id, queued: true };
}

/**
 * Process entire sync queue. Called when online or on user trigger.
 * @param {Function} onSync - async handler(item) => result
 * @param {(progress) => void} [onProgress] - callback with {processed, failed, total}
 */
export async function processSyncQueue(onSync, onProgress) {
  const queue = readSyncQueue();
  if (!queue.length) return { processed: 0, failed: 0 };

  const failed = [];
  let processed = 0;

  for (const item of queue) {
    try {
      onProgress?.({ processed, failed: failed.length, total: queue.length });
      await onSync(item);
      processed++;
    } catch (err) {
      item.lastError = err?.message || "Sync failed";
      item.retries = (item.retries || 0) + 1;
      if (item.retries >= MAX_RETRIES) {
        failed.push(item);
      } else {
        // Put back in queue for retry
        queue.push(item);
      }
    }
  }

  writeSyncQueue(queue.filter((i) => !failed.includes(i)));
  if (failed.length) {
    writeFailedSync(failed);
  }

  return { processed, failed: failed.length };
}

/**
 * Hook for offline/online state + auto-sync.
 */
export function useOfflineSync(onSync) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);
  const syncTimeoutRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (onSync && readSyncQueue().length) {
        // Debounce sync in case multiple online events fire
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          setSyncing(true);
          processSyncQueue(onSync).finally(() => setSyncing(false));
        }, 500);
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(syncTimeoutRef.current);
    };
  }, [onSync]);

  return {
    isOnline,
    syncing,
    queueSize: readSyncQueue().length,
    failedSize: readFailedSync().length,
  };
}
