/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { loadNotificationPrefs, saveNotificationPrefs } from "./pushNotifications";

describe("pushNotifications prefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores prefs per org slug", () => {
    localStorage.setItem("mysafeops_orgId", "acme");
    saveNotificationPrefs({ master: true, quiet_hours_enabled: true });

    localStorage.setItem("mysafeops_orgId", "beta");
    expect(loadNotificationPrefs()).toEqual({});

    localStorage.setItem("mysafeops_orgId", "acme");
    expect(loadNotificationPrefs()).toEqual({ master: true, quiet_hours_enabled: true });
  });

  it("migrates legacy global prefs into current org once", () => {
    localStorage.setItem("mysafeops_orgId", "acme");
    localStorage.setItem(
      "mysafeops_notif_prefs",
      JSON.stringify({ master: false, permit_expiry: true })
    );

    expect(loadNotificationPrefs()).toEqual({ master: false, permit_expiry: true });
    expect(localStorage.getItem("mysafeops_notif_prefs_acme")).toBeTruthy();
  });
});
