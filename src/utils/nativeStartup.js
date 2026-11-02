import { isNativeApp } from "./appRuntime";

/** Start installed apps at the workspace while preserving explicit/auth links. */
export function prepareNativeStartup() {
  if (!isNativeApp()) return;
  const { pathname, search, hash } = window.location;
  if ((pathname === "/" || pathname === "/index.html") && !search && !hash) {
    window.history.replaceState(window.history.state, "", "/app?view=field-home");
  }
}
