import { useEffect } from "react";
import useOverlayScrollLock from "../hooks/useOverlayScrollLock";

/** Full-screen scrollable overlay for module editors (RAMS, permits, survey reports, …). */
export default function ModuleOverlay({ children, className = "", onClose, "aria-label": ariaLabel }) {
  useOverlayScrollLock(true);
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const classes = ["app-module-overlay", className].filter(Boolean).join(" ");
  return (
    <div
      className={classes}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
