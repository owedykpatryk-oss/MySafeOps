import { useEffect } from "react";

/** Prevent workspace body scroll while a full-screen module overlay is open. */
export default function useOverlayScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    document.body.classList.add("mysafeops-overlay-open");
    return () => document.body.classList.remove("mysafeops-overlay-open");
  }, [active]);
}
