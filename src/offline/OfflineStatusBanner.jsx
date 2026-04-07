// MySafeOps — Offline Status Banner + Update Notifier
// Drop <OfflineStatusBanner /> anywhere in your App layout (e.g. top of main content)

import { useState, useEffect } from "react";
import { activateNewServiceWorker, getOfflineQueueCount } from "./offlineManager";

export default function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSynced(false);
      getOfflineQueueCount().then(setQueueCount);
    };
    const handleOffline = () => {
      setIsOnline(false);
      getOfflineQueueCount().then(setQueueCount);
    };
    const handleUpdate = () => setUpdateAvailable(true);
    const handleSynced = () => {
      setSynced(true);
      setQueueCount(0);
      setTimeout(() => setSynced(false), 4000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sw-update-available", handleUpdate);
    window.addEventListener("mysafeops-synced", handleSynced);

    getOfflineQueueCount().then(setQueueCount);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sw-update-available", handleUpdate);
      window.removeEventListener("mysafeops-synced", handleSynced);
    };
  }, []);

  if (isOnline && !updateAvailable && !synced && queueCount === 0) return null;

  return (
    <div style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "#FAEEDA", borderBottom: "0.5px solid #FAC775",
          fontSize: 13, color: "#633806",
        }}>
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#854F0B" strokeWidth={1.5}>
            <path d="M8 3v5M8 11h.01" strokeLinecap="round"/>
            <path d="M2 14L8 2l6 12H2z"/>
          </svg>
          <span style={{ fontWeight: 500 }}>You are offline</span>
          <span>— MySafeOps is running in offline mode. Data is saved locally and will sync when you reconnect.</span>
          {queueCount > 0 && (
            <span style={{ marginLeft: "auto", padding: "1px 8px", borderRadius: 20, fontSize: 11,
              background: "#FCEBEB", color: "#791F1F", fontWeight: 500 }}>
              {queueCount} pending
            </span>
          )}
        </div>
      )}

      {/* Back online + sync */}
      {isOnline && synced && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "#EAF3DE", borderBottom: "0.5px solid #C0DD97",
          fontSize: 13, color: "#27500A",
        }}>
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#27500A" strokeWidth={1.5}>
            <circle cx={8} cy={8} r={6}/>
            <path d="M5 8l2 2 4-4" strokeLinecap="round"/>
          </svg>
          Back online — data synchronised successfully.
        </div>
      )}

      {/* Pending sync items */}
      {isOnline && queueCount > 0 && !synced && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "#E6F1FB", borderBottom: "0.5px solid #B5D4F4",
          fontSize: 13, color: "#0C447C",
        }}>
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth={1.5} strokeLinecap="round">
            <path d="M14 8A6 6 0 112 8"/><path d="M14 3v5h-5"/>
          </svg>
          Syncing {queueCount} offline action{queueCount > 1 ? "s" : ""}…
        </div>
      )}

      {/* Update available */}
      {updateAvailable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "#EEEDFE", borderBottom: "0.5px solid #AFA9EC",
          fontSize: 13, color: "#3C3489",
          flexWrap: "wrap",
        }}>
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#534AB7" strokeWidth={1.5}>
            <circle cx={8} cy={8} r={6}/><path d="M8 5v3M8 11h.01" strokeLinecap="round"/>
          </svg>
          <span style={{ flex: 1 }}>A new version of MySafeOps is available.</span>
          <button
            onClick={activateNewServiceWorker}
            style={{
              padding: "4px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
              background: "#534AB7", color: "#EEEDFE",
              border: "0.5px solid #3C3489", fontFamily: "DM Sans, sans-serif",
            }}
          >
            Update now
          </button>
          <button onClick={() => setUpdateAvailable(false)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#534AB7", fontSize: 14, lineHeight: 1,
          }}>×</button>
        </div>
      )}
    </div>
  );
}
