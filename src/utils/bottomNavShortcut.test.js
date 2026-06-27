/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  BOTTOM_NAV_SHORTCUT_UPDATED_EVENT,
  DEFAULT_BOTTOM_NAV_FALLBACK_ID,
  getBottomNavModuleId,
  getBottomNavShortcutOptions,
  isValidBottomNavModuleId,
  resolveBottomNavSlotId,
  setBottomNavModuleId,
} from "./bottomNavShortcut";
import { hideModule } from "./hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("bottomNavShortcut", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("validates known module ids", () => {
    expect(isValidBottomNavModuleId("snags")).toBe(true);
    expect(isValidBottomNavModuleId("dashboard")).toBe(false);
    expect(isValidBottomNavModuleId("not-a-module")).toBe(false);
  });

  it("persists and reads bottomNavModuleId", () => {
    setBottomNavModuleId("permits");
    expect(loadOrgSettingsRaw().bottomNavModuleId).toBe("permits");
    expect(getBottomNavModuleId()).toBe("permits");
    expect(resolveBottomNavSlotId()).toBe("permits");
  });

  it("falls back to bin when unset or invalid", () => {
    expect(resolveBottomNavSlotId()).toBe(DEFAULT_BOTTOM_NAV_FALLBACK_ID);
    saveOrgSettingsRaw({ bottomNavModuleId: "dashboard" });
    expect(getBottomNavModuleId()).toBeNull();
    expect(resolveBottomNavSlotId()).toBe(DEFAULT_BOTTOM_NAV_FALLBACK_ID);
  });

  it("ignores hidden modules", () => {
    setBottomNavModuleId("coshh");
    hideModule("coshh");
    expect(getBottomNavModuleId()).toBeNull();
    expect(getBottomNavShortcutOptions()).not.toContain("coshh");
  });

  it("dispatches update event on change", () => {
    const handler = vi.fn();
    window.addEventListener(BOTTOM_NAV_SHORTCUT_UPDATED_EVENT, handler);
    setBottomNavModuleId("rams");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(BOTTOM_NAV_SHORTCUT_UPDATED_EVENT, handler);
  });
});
