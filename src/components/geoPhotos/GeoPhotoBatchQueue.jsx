import { useState, useCallback, useEffect } from "react";
import { X, Upload, Check, AlertCircle } from "lucide-react";

/**
 * Persistent queue for offline-captured photos awaiting batch upload.
 * Stores in localStorage with keys: mysafeops_batch_photos_queue, mysafeops_batch_photos_meta
 */

const QUEUE_STORAGE_KEY = "mysafeops_batch_photos_queue";
const META_STORAGE_KEY = "mysafeops_batch_photos_meta";

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

function readMeta() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* quota */
  }
}

/** @typedef {{
 *   id: string;
 *   dataUrl: string;
 *   filename: string;
 *   timestamp: number;
 *   size: number;
 *   lat?: number;
 *   lng?: number;
 *   bearing?: number;
 *   details?: Record<string, any>;
 * }} BatchPhotoItem */

export function useBatchPhotoQueue() {
  const [queue, setQueue] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQueue(readQueue());
    setMeta(readMeta());
    setLoading(false);
  }, []);

  const addPhoto = useCallback(
    (photoDataUrl, filename, details = {}) => {
      const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const blob = new Blob([photoDataUrl.split(",")[1]], { type: "image/jpeg" });
      const item = {
        id,
        dataUrl: photoDataUrl,
        filename: filename || `photo_${Date.now()}.jpg`,
        timestamp: Date.now(),
        size: blob.size,
        ...details,
      };
      const newQueue = [...queue, item];
      setQueue(newQueue);
      writeQueue(newQueue);
      return id;
    },
    [queue]
  );

  const removePhoto = useCallback(
    (id) => {
      const newQueue = queue.filter((p) => p.id !== id);
      setQueue(newQueue);
      writeQueue(newQueue);
      const newMeta = { ...meta };
      delete newMeta[id];
      setMeta(newMeta);
      writeMeta(newMeta);
    },
    [queue, meta]
  );

  const updatePhotoDetails = useCallback(
    (id, details) => {
      const newMeta = { ...meta, [id]: { ...meta[id], ...details } };
      setMeta(newMeta);
      writeMeta(newMeta);
    },
    [meta]
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
    setMeta({});
    writeQueue([]);
    writeMeta({});
  }, []);

  return {
    queue,
    meta,
    loading,
    addPhoto,
    removePhoto,
    updatePhotoDetails,
    clearQueue,
    queueSize: queue.reduce((sum, p) => sum + (p.size || 0), 0),
  };
}

/** Grid preview of queued photos with delete & detail editing. */
export default function GeoPhotoBatchQueue({
  queue = [],
  meta = {},
  onRemove,
  onUpdateDetails,
  onBatchUpload,
  uploading = false,
  uploadError = null,
}) {
  if (!queue.length) return null;

  const totalMB = (queue.reduce((sum, p) => sum + (p.size || 0), 0) / 1024 / 1024).toFixed(1);

  return (
    <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>
          Queue: {queue.length} photo{queue.length !== 1 ? "s" : ""} ({totalMB} MB)
        </h4>
        {uploadError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626", fontSize: 12 }}>
            <AlertCircle size={16} />
            {uploadError}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
        {queue.map((photo) => (
          <div
            key={photo.id}
            style={{
              position: "relative",
              paddingBottom: "100%",
              backgroundColor: "#f3f4f6",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <img
              src={photo.dataUrl}
              alt="queued"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <button
              type="button"
              onClick={() => onRemove?.(photo.id)}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "rgba(0,0,0,0.6)",
                border: "none",
                color: "#fff",
                borderRadius: "50%",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={uploading}
        onClick={onBatchUpload}
        style={{
          width: "100%",
          padding: "8px 12px",
          backgroundColor: uploading ? "#9ca3af" : "#0d9488",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          fontWeight: 500,
          cursor: uploading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {uploading ? (
          <>
            <div style={{ animation: "spin 1s linear infinite" }} />
            Uploading…
          </>
        ) : (
          <>
            <Upload size={16} />
            Upload All ({queue.length})
          </>
        )}
      </button>
    </div>
  );
}
