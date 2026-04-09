import { useEffect, useMemo, useRef, useState } from "react";
import { buildWorkspaceSearchHits } from "../utils/workspaceSearch";

/**
 * Modal command palette: jump to screens and surface matching records (local data).
 */
export default function WorkspaceSearchPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const [active, setActive] = useState(0);

  const hits = useMemo(() => buildWorkspaceSearchHits(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onDoc);
    return () => document.removeEventListener("keydown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  const go = (h) => {
    onNavigate({ viewId: h.viewId, permitId: h.permitId });
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search workspace"
      className="app-search-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "12vh 1rem 2rem",
        boxSizing: "border-box",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="app-panel-surface app-search-dialog"
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: "var(--radius-md, 14px)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-border-tertiary,#e2e8f0)", background: "var(--color-background-secondary,#f8fafc)" }}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search screens, workers, projects, RAMS…"
            aria-label="Search workspace"
            autoComplete="off"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 16px",
              fontSize: 15,
              borderRadius: "var(--radius-sm, 10px)",
              border: "1px solid var(--color-border-secondary,#cbd5e1)",
              fontFamily: "DM Sans, system-ui, sans-serif",
              outline: "none",
              background: "var(--color-background-primary)",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8, lineHeight: 1.4 }}>
            <kbd
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid var(--color-border-tertiary)",
                fontSize: 10,
                background: "var(--color-background-secondary,#f7f7f5)",
              }}
            >
              ↑↓
            </kbd>{" "}
            move ·{" "}
            <kbd
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid var(--color-border-tertiary)",
                fontSize: 10,
                background: "var(--color-background-secondary,#f7f7f5)",
              }}
            >
              Enter
            </kbd>{" "}
            open · Esc close
          </div>
        </div>
        <div style={{ maxHeight: "min(50vh, 360px)", overflowY: "auto" }}>
          {hits.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", fontSize: 13, color: "var(--color-text-secondary)" }}>
              {query.trim().length === 0
                ? "Type to search. Two or more characters match workers, projects, RAMS, permits, snags."
                : "No matches. Try another word or open a screen from the bar below."}
            </div>
          ) : (
            hits.map((h, i) => {
              const sel = i === active;
              return (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => go(h)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: "0.5px solid var(--color-border-tertiary,#f1f5f9)",
                    background: sel ? "rgba(13,148,136,0.1)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "DM Sans, system-ui, sans-serif",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--color-text-secondary)",
                        minWidth: 52,
                      }}
                    >
                      {h.kind}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{h.label}</span>
                  </div>
                  {h.subtitle ? (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 60 }}>{h.subtitle}</div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
