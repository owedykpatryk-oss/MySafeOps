import { useEffect, useState } from "react";
import {
  D1_WRITE_FORBIDDEN_CLEAR_EVENT,
  D1_WRITE_FORBIDDEN_EVENT,
} from "../lib/d1WriteForbidden.js";
import { ORG_CHANGED_EVENT } from "../utils/orgStorage";

const DEFAULT_MSG =
  "Cloud sync is read-only for your role on this data. Changes are saved on this device only.";

/**
 * Workspace-wide notice when D1 rejects a PUT (403). Shown once until org change or successful cloud write.
 */
export default function D1WriteForbiddenBanner() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onForbidden = (e) => {
      setMessage(String(e?.detail?.message || DEFAULT_MSG));
    };
    const onClear = () => setMessage("");
    window.addEventListener(D1_WRITE_FORBIDDEN_EVENT, onForbidden);
    window.addEventListener(D1_WRITE_FORBIDDEN_CLEAR_EVENT, onClear);
    window.addEventListener(ORG_CHANGED_EVENT, onClear);
    return () => {
      window.removeEventListener(D1_WRITE_FORBIDDEN_EVENT, onForbidden);
      window.removeEventListener(D1_WRITE_FORBIDDEN_CLEAR_EVENT, onClear);
      window.removeEventListener(ORG_CHANGED_EVENT, onClear);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="app-panel-surface"
      style={{
        margin: "0 0 10px",
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.5,
        color: "var(--color-text-primary, #1e293b)",
        background: "var(--color-warning-bg, #fffbeb)",
        border: "1px solid var(--color-warning-border, #fcd34d)",
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>Cloud sync restricted</strong>
      {message}
    </div>
  );
}
