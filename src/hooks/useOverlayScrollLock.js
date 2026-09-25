import { useEffect } from "react";
import { lockOverlayScroll } from "./overlayScrollLock";

/** Prevent workspace body scroll while a full-screen module overlay is open. */
export default function useOverlayScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    return lockOverlayScroll();
  }, [active]);
}
