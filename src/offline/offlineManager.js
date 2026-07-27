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

    const checkForUpdate = () => {
      reg.update().catch(() => {});
    };
    checkForUpdate();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });

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

    return reg;
  } catch (err) {
    console.warn("[MySafeOps SW] Registration failed:", err);
    return null;
  }
}

// ─── Offline detection ────────────────────────────────────────────────────────
export function initOnlineStatusWatcher(onOnline, onOffline) {
  const handleOnline = () => {
    if (import.meta.env.DEV) console.log("[MySafeOps] Back online");
    onOnline?.();
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

// ─── Skip waiting — activate waiting SW, then reload on controllerchange ──────
export async function activateNewServiceWorker() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const waiting = reg?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true }
  );
  waiting.postMessage({ type: "SKIP_WAITING" });
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
