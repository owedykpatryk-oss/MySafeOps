// MySafeOps — Offline Manager
// Import and call initOfflineMode() once in your app's entry point (main.jsx / App.jsx)

// ─── Service Worker registration ─────────────────────────────────────────────
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers not supported in this browser.");
    return null;
  }
  // In dev, stale SW caches can mask fresh .env changes.
  // Keep dev always network-fresh and unregister existing SW registrations.
  if (import.meta.env.DEV) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      console.log("[MySafeOps SW] Dev mode: skipped registration and cleared existing registrations");
    } catch (err) {
      console.warn("[MySafeOps SW] Dev cleanup failed:", err);
    }
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
      updateViaCache: "none",
    });
    if (import.meta.env.DEV) console.log("[MySafeOps SW] Registered:", reg.scope);

    // Listen for updates
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // New version available — notify app
          window.dispatchEvent(new CustomEvent("sw-update-available"));
        }
      });
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { type } = event.data || {};
      if (type === "SYNC_COMPLETE") {
        window.dispatchEvent(new CustomEvent("mysafeops-synced"));
      }
    });

    return reg;
  } catch (err) {
    console.warn("[MySafeOps SW] Registration failed:", err);
    return null;
  }
}

// ─── Offline detection ────────────────────────────────────────────────────────
export function initOnlineStatusWatcher(onOnline, onOffline) {
  const handleOnline = () => {
    if (import.meta.env.DEV) console.log("[MySafeOps] Back online — triggering sync");
    onOnline?.();
    triggerBackgroundSync();
  };
  const handleOffline = () => {
    if (import.meta.env.DEV) console.log("[MySafeOps] Gone offline");
    onOffline?.();
  };
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// ─── Background sync trigger ──────────────────────────────────────────────────
export async function triggerBackgroundSync() {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return;
  try {
    await reg.sync?.register("mysafeops-sync");
    if (import.meta.env.DEV) console.log("[MySafeOps] Background sync registered");
  } catch {
    // Background Sync API not available (e.g. iOS Safari) — just proceed
    if (import.meta.env.DEV) console.warn("[MySafeOps] Background Sync not available, syncing inline");
  }
}

// ─── Skip waiting — activate new SW immediately ───────────────────────────────
export function activateNewServiceWorker() {
  navigator.serviceWorker?.controller?.postMessage({ type: "SKIP_WAITING" });
  window.location.reload();
}

// ─── IndexedDB helpers for offline queue ─────────────────────────────────────
const DB_NAME = "mysafeops_offline";
const DB_VERSION = 1;
const STORE_NAME = "sync_queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// Queue an action to sync when back online
export async function queueOfflineAction(action) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({
      ...action,
      queuedAt: new Date().toISOString(),
      orgId: localStorage.getItem("mysafeops_orgId") || "default",
    });
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (err) {
    console.warn("[MySafeOps] Could not queue offline action:", err);
  }
}

// Get pending queue count
export async function getOfflineQueueCount() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    return new Promise(res => { req.onsuccess = () => res(req.result); req.onerror = () => res(0); });
  } catch { return 0; }
}

// Clear queue after successful sync
export async function clearOfflineQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
  } catch (err) {
    console.warn("[MySafeOps] Could not clear offline queue:", err);
  }
}

// ─── Main init function — call this once in App.jsx ──────────────────────────
export async function initOfflineMode(options = {}) {
  const {
    onOnline = () => {},
    onOffline = () => {},
  } = options;

  await registerServiceWorker();
  const cleanup = initOnlineStatusWatcher(onOnline, onOffline);
  return cleanup;
}

export default initOfflineMode;
