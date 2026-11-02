import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OPS_TOAST_EVENT_NAME } from "../utils/clientOpsMonitor.js";

const ToastCtx = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismissToast = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (notification, legacyType = "info") => {
      const { type = "info", title = "", message = "", durationMs = 4500 } =
        typeof notification === "string" ? { message: notification, type: legacyType } : notification ?? {};
      if (!title && !message) return null;
      const key = `${type}|${title}|${message}`;
      const now = Date.now();
      const id = ++seq;
      setItems((prev) => {
        const duplicate = prev.find((item) => item.key === key && now - item.shownAt < 8000);
        if (duplicate) return prev;
        const next = [...prev, { id, type, title, message, key, shownAt: now }];
        return next.slice(-3);
      });
      if (durationMs > 0 && id) {
        window.setTimeout(() => dismissToast(id), durationMs);
      }
      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const onOpsToast = (event) => {
      const d = event?.detail;
      if (!d?.message && !d?.title) return;
      pushToast({
        type: d.type || "error",
        title: d.title || "",
        message: d.message || "",
        durationMs: d.durationMs ?? 6000,
      });
    };
    window.addEventListener(OPS_TOAST_EVENT_NAME, onOpsToast);
    return () => window.removeEventListener(OPS_TOAST_EVENT_NAME, onOpsToast);
  }, [pushToast]);

  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
        {items.map((t) => (
          <div key={t.id} className={`app-toast app-toast--${t.type}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                {t.title ? <div className="app-toast-title">{t.title}</div> : null}
                {t.message ? <div className="app-toast-message">{t.message}</div> : null}
              </div>
              <button type="button" className="app-toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToast outside ToastProvider");
  return v;
}
