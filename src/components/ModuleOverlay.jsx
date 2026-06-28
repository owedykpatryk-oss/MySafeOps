import useOverlayScrollLock from "../hooks/useOverlayScrollLock";

/** Full-screen scrollable overlay for module editors (RAMS, permits, survey reports, …). */
export default function ModuleOverlay({ children, className = "" }) {
  useOverlayScrollLock(true);
  const classes = ["app-module-overlay", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}
