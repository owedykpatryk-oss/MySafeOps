import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismissToast = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ type = "info", title = "", message = "", durationMs = 3500 }) => {
      const id = ++seq;
      setItems((prev) => [...prev, { id, type, title, message }]);
      if (durationMs > 0) {
        window.setTimeout(() => dismissToast(id), durationMs);
      }
      return id;
    },
    [dismissToast]
  );

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
