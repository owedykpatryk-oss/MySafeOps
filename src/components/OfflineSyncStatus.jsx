import { useEffect, useState } from "react";
import { Wifi, WifiOff, Upload, AlertCircle } from "lucide-react";
import { readSyncQueue, readFailedSync, processSyncQueue } from "../utils/offlineSync";

/**
 * Displays offline status and sync queue in app header.
 * Shows: offline indicator, pending items count, failed items count, manual sync button.
 */
export default function OfflineSyncStatus({ onSync }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queueSize, setQueueSize] = useState(0);
  const [failedSize, setFailedSize] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const updateStatus = () => {
    setQueueSize(readSyncQueue().length);
    setFailedSize(readFailedSync().length);
  };

  useEffect(() => {
    updateStatus();
    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!onSync || syncing) return;
    setSyncing(true);
    try {
      await processSyncQueue(onSync, updateStatus);
      updateStatus();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Don't show anything if online and no pending items
  if (isOnline && !queueSize && !failedSize) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        backgroundColor: isOnline ? "transparent" : "rgba(239, 68, 68, 0.1)",
        borderRadius: 4,
        fontSize: 13,
      }}
    >
      {isOnline ? (
        <Wifi size={16} style={{ color: "var(--teal-l)" }} />
      ) : (
        <WifiOff size={16} style={{ color: "#dc2626" }} />
      )}

      <span style={{ fontWeight: 500 }}>
        {isOnline ? "Online" : "Offline"}
      </span>

      {queueSize > 0 && (
        <span style={{ color: "var(--color-text-secondary)" }}>
          · {queueSize} pending
        </span>
      )}

      {failedSize > 0 && (
        <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={14} />
          {failedSize} failed
        </span>
      )}

      {(queueSize > 0 || failedSize > 0) && isOnline && (
        <button
          type="button"
          disabled={syncing}
          onClick={handleManualSync}
          style={{
            marginLeft: "auto",
            padding: "4px 8px",
            backgroundColor: "var(--teal-l)",
            color: "#fff",
            border: "none",
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 500,
            cursor: syncing ? "not-allowed" : "pointer",
            opacity: syncing ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Upload size={12} />
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      )}
    </div>
  );
}
