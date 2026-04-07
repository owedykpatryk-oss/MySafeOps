// MySafeOps — Service Worker registration hook
// Drop into your app root: useServiceWorker() in App.jsx

import { useEffect, useState } from "react";

export function useServiceWorker() {
  const [status, setStatus] = useState("idle"); // idle | registering | ready | updating | offline | error
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Online/offline detection
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Register service worker
    if ("serviceWorker" in navigator) {
      setStatus("registering");
      navigator.serviceWorker
        .register("/service-worker.js", { scope: "/" })
        .then((reg) => {
          setStatus("ready");

          // Detect update waiting
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setStatus("updating");
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setStatus("updating");
              }
            });
          });
        })
        .catch((err) => {
          console.error("[MySafeOps SW] Registration failed:", err);
          setStatus("error");
        });

      // When new SW takes control, reload
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  };

  return { status, isOnline, waitingWorker, applyUpdate };
}

// Offline banner component — paste into App.jsx layout
export function OfflineBanner({ isOnline, status, applyUpdate }) {
  if (isOnline && status !== "updating") return null;

  if (status === "updating") {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        background: "#185FA5", color: "#fff",
        padding: "8px 16px", fontSize: 13,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "DM Sans, sans-serif",
      }}>
        <span>A new version of MySafeOps is available.</span>
        <button
          onClick={applyUpdate}
          style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fff", color: "#185FA5", fontSize: 12, cursor: "pointer" }}
        >
          Update now
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#854F0B", color: "#fff",
      padding: "8px 16px", fontSize: 13,
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: "DM Sans, sans-serif",
    }}>
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx={8} cy={8} r={6}/>
        <path d="M8 5v3M8 11h.01" strokeLinecap="round"/>
      </svg>
      <span>You are offline — data is saved locally and will sync when reconnected.</span>
    </div>
  );
}
