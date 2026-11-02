/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { activateNewServiceWorker, registerServiceWorker } from "./offlineManager";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("does not register or activate a PWA worker in a native app", async () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  const register = vi.fn();
  const getRegistration = vi.fn();
  const getRegistrations = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { register, getRegistration, getRegistrations } });
  vi.stubEnv("DEV", false);
  expect(await registerServiceWorker()).toBeNull();
  await activateNewServiceWorker();
  expect(register).not.toHaveBeenCalled();
  expect(getRegistration).not.toHaveBeenCalled();
  vi.stubEnv("DEV", true);
  await registerServiceWorker();
  expect(getRegistrations).not.toHaveBeenCalled();
});

it("still registers the production web worker and notifies about updates", async () => {
  vi.stubGlobal("Capacitor", undefined);
  vi.stubEnv("DEV", false);
  const worker = new EventTarget();
  const registration = Object.assign(new EventTarget(), { installing: worker, update: vi.fn().mockResolvedValue() });
  const register = vi.fn().mockResolvedValue(registration);
  vi.stubGlobal("navigator", { serviceWorker: { register, controller: {} } });
  // Capture the visibility callback without leaving a document listener across tests.
  const addListener = vi.spyOn(document, "addEventListener").mockImplementation(() => {});
  const dispatch = vi.spyOn(window, "dispatchEvent");
  expect(await registerServiceWorker()).toBe(registration);
  expect(register).toHaveBeenCalledWith("/service-worker.js", { scope: "/", updateViaCache: "none" });
  expect(registration.update).toHaveBeenCalledOnce();
  expect(addListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  registration.dispatchEvent(new Event("updatefound"));
  worker.state = "installed";
  worker.dispatchEvent(new Event("statechange"));
  expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "sw-update-available" }));
});

it("keeps development web caches disabled", async () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => false });
  vi.stubEnv("DEV", true);
  const unregister = vi.fn().mockResolvedValue(true);
  const register = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { register, getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) } });
  expect(await registerServiceWorker()).toBeNull();
  expect(unregister).toHaveBeenCalledOnce();
  expect(register).not.toHaveBeenCalled();
});
