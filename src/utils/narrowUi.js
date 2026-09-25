/** Phone / tablet chrome: collapse tall editor panels and skip decorative motion. */
export function preferCollapsedEditorChrome() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
}
