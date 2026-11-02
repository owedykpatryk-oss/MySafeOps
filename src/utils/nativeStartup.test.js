/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { prepareNativeStartup } from "./nativeStartup";

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

it.each(["/", "/index.html"])("starts a native cold launch at the field workspace: %s", (path) => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  window.history.replaceState(null, "", path);
  prepareNativeStartup();
  expect(window.location.pathname + window.location.search).toBe("/app?view=field-home");
});

it.each(["/?code=auth-code", "/#access_token=token", "/accept-invite?token=invite", "/app?view=rams"])("preserves explicit navigation and auth data: %s", (path) => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  window.history.replaceState(null, "", path);
  prepareNativeStartup();
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(path);
});

it("leaves the public website landing page unchanged", () => {
  prepareNativeStartup();
  expect(window.location.pathname + window.location.search).toBe("/");
});
