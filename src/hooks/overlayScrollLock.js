/**
 * iOS Safari ignores overflow:hidden on body while a sheet is open.
 * Freeze the document with position:fixed and restore scroll on release.
 * Nested overlays share one lock (count).
 */

let lockCount = 0;
let savedScrollY = 0;

function clearBodyLockStyles(body, html) {
  body.classList.remove("mysafeops-overlay-open");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  html.style.overflow = "";
}

export function lockOverlayScroll() {
  if (typeof document === "undefined") return () => {};
  const body = document.body;
  const html = document.documentElement;
  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    body.classList.add("mysafeops-overlay-open");
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    html.style.overflow = "hidden";
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;
    clearBodyLockStyles(body, html);
    window.scrollTo(0, savedScrollY);
  };
}

/** Test-only: drop leftover locks between cases. */
export function resetOverlayScrollLockForTests() {
  lockCount = 0;
  savedScrollY = 0;
  if (typeof document === "undefined") return;
  clearBodyLockStyles(document.body, document.documentElement);
}
