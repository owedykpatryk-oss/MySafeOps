import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { buildWorkspaceSearchHits } from "../utils/workspaceSearch";
import { getPinnedModuleIds } from "../utils/pinnedModules";
import { getRecentModuleIds } from "../utils/recentModules";
import { getModuleIcon, preloadModuleIcons } from "../navigation/moduleCatalogMeta";

const MODULE_HIT_KINDS = new Set(["Open", "Module", "Pinned", "Recent"]);

/**
 * Modal command palette: jump to screens and surface matching records (local data).
 */
export default function WorkspaceSearchPalette({ open, onClose, onNavigate, allowSuperadmin = false }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const resultRefs = useRef([]);
  const [active, setActive] = useState(0);
  const [iconGen, setIconGen] = useState(0);
  const [visibleViewport, setVisibleViewport] = useState(null);

  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => setVisibleViewport({ height: viewport.height, top: viewport.offsetTop });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open]);

  const hits = useMemo(() => {
    if (!open) return [];
    const rows = buildWorkspaceSearchHits(query, {
      pinnedModuleIds: getPinnedModuleIds(),
      recentModuleIds: getRecentModuleIds(),
    });
    if (allowSuperadmin) return rows;
    return rows.filter((h) => h.viewId !== "superadmin");
  }, [query, allowSuperadmin, open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const previousFocus = document.activeElement;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    preloadModuleIcons().then(() => setIconGen((g) => g + 1));
    return () => {
      cancelAnimationFrame(t);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (open) resultRefs.current[active]?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const elements = Array.from(dialogRef.current?.querySelectorAll("input, button") || []).filter((el) => !el.disabled);
        const first = elements[0];
        const last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onDoc);
    return () => document.removeEventListener("keydown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  const go = (h) => {
    onNavigate(h);
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
        inset: visibleViewport ? undefined : 0,
        top: visibleViewport ? visibleViewport.top : undefined,
        left: visibleViewport ? 0 : undefined,
        right: visibleViewport ? 0 : undefined,
        height: visibleViewport ? visibleViewport.height : undefined,
        zIndex: "var(--z-palette, 70)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: visibleViewport?.height < 500 ? "8px 1rem" : "min(12vh, 72px) 1rem 1rem",
        boxSizing: "border-box",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="app-panel-surface app-search-dialog"
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: "var(--radius-md, 14px)",
          overflow: "hidden",
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "14px 16px", flexShrink: 0, borderBottom: "1px solid var(--color-border-tertiary,#e2e8f0)", background: "var(--color-background-secondary,#f8fafc)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Find a project, document or module…"
            aria-label="Search workspace"
            autoComplete="off"
            style={{
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              padding: "12px 16px",
              fontSize: 16,
              borderRadius: "var(--radius-sm, 10px)",
              border: "1px solid var(--color-border-secondary,#cbd5e1)",
              fontFamily: "DM Sans, system-ui, sans-serif",
              background: "var(--color-background-primary)",
            }}
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="app-search-close">
            <X size={20} aria-hidden="true" />
          </button>
          </div>
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
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
          {hits.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center", fontSize: 13, color: "var(--color-text-secondary)" }}>
              {query.trim().length === 0
                ? "Type to search. With two or more characters you can match workers, projects, RAMS, permits, and snags. Pin modules from More (pin icon) to list them here when search is empty."
                : "No matches. Try another word or use the bottom navigation."}
            </div>
          ) : (
            hits.map((h, i) => {
              const sel = i === active;
              const showIcon = MODULE_HIT_KINDS.has(h.kind);
              const Icon = showIcon ? getModuleIcon(h.viewId) : null;
              return (
                <button
                  key={`${h.key}-${iconGen}`}
                  ref={(node) => { resultRefs.current[i] = node; }}
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
                    {showIcon ? (
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--color-background-secondary,#f1f5f9)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "#0d9488",
                        }}
                      >
                        {Icon ? <Icon size={15} strokeWidth={2} /> : <FileText size={15} strokeWidth={2} />}
                      </span>
                    ) : null}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--color-text-secondary)",
                        minWidth: showIcon ? 50 : 58,
                      }}
                    >
                      {h.kind}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{h.label}</span>
                  </div>
                  {h.subtitle ? (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: showIcon ? 36 : 60 }}>
                      {h.subtitle}
                    </div>
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
