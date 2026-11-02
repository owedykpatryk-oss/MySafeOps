/** Capacitor injects this bridge before the bundled app starts. */
export function isNativeApp() {
  return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true;
}
