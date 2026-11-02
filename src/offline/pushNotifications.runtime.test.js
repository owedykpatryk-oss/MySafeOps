/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { checkExpiryNotifications, getNotificationStatus, requestNotificationPermission, showLocalNotification, startNotificationScheduler, stopNotificationScheduler } from "./pushNotifications";

afterEach(() => { stopNotificationScheduler(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("does not crash reminder actions when notifications are unavailable", async () => {
  vi.stubGlobal("Notification", undefined);
  expect(() => showLocalNotification("Test")).not.toThrow();
  expect(() => checkExpiryNotifications()).not.toThrow();
  expect(await requestNotificationPermission()).toBe("unsupported");
});

it("does not advertise web push or wait for a service worker in a native shell", async () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  vi.stubGlobal("Notification", { permission: "granted" });
  const getRegistrations = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { ready: new Promise(() => {}), getRegistrations } });
  const status = await getNotificationStatus();
  expect(status).toMatchObject({ supported: false, permission: "unsupported", subscribed: false, swReady: false });
  expect(getRegistrations).not.toHaveBeenCalled();
}, 1000);

it("an old scheduler cleanup cannot stop the replacement scheduler", () => {
  vi.useFakeTimers();
  vi.stubGlobal("Notification", { permission: "denied" });
  const stopFirst = startNotificationScheduler(1000);
  startNotificationScheduler(1000);
  stopFirst();
  expect(vi.getTimerCount()).toBe(1);
  stopNotificationScheduler();
  expect(vi.getTimerCount()).toBe(0);
});
