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
    saveOrgSettingsRaw({ hiddenModules: [], hiddenModulesBootstrapped: true });
  });

  it("validates known module ids", () => {
    expect(isValidBottomNavModuleId("snags")).toBe(true);
    expect(isValidBottomNavModuleId("dashboard")).toBe(false);
    expect(isValidBottomNavModuleId("not-a-module")).toBe(false);
  });

  it("persists and reads bottomNavModuleId for non-bar modules", () => {
    setBottomNavModuleId("snags");
    expect(loadOrgSettingsRaw().bottomNavModuleId).toBe("snags");
    expect(getBottomNavModuleId()).toBe("snags");
    expect(resolveBottomNavSlotId()).toBe("snags");
  });

  it("rejects modules already fixed on the bottom bar", () => {
    setBottomNavModuleId("projects");
    expect(loadOrgSettingsRaw().bottomNavModuleId).toBeNull();
    expect(getBottomNavModuleId()).toBeNull();
    expect(resolveBottomNavSlotId()).toBe(DEFAULT_BOTTOM_NAV_FALLBACK_ID);
    expect(getBottomNavShortcutOptions()).not.toContain("projects");
    expect(getBottomNavShortcutOptions()).not.toContain("people");
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
    setBottomNavModuleId("coshh");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(BOTTOM_NAV_SHORTCUT_UPDATED_EVENT, handler);
  });
});
