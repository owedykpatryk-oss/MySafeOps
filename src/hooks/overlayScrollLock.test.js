/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { lockOverlayScroll, resetOverlayScrollLockForTests } from "./overlayScrollLock.js";

describe("overlayScrollLock", () => {
  beforeEach(() => {
    resetOverlayScrollLockForTests();
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 80 });
    Object.defineProperty(window, "pageYOffset", { configurable: true, writable: true, value: 80 });
    window.scrollTo = (x, y) => {
      const top = typeof x === "object" ? x.top : y;
      window.scrollY = top;
      window.pageYOffset = top;
    };
  });

  it("freezes body with position fixed and restores scroll", () => {
    const unlock = lockOverlayScroll();
    expect(document.body.classList.contains("mysafeops-overlay-open")).toBe(true);
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-80px");
    unlock();
    expect(document.body.classList.contains("mysafeops-overlay-open")).toBe(false);
    expect(document.body.style.position).toBe("");
    expect(window.scrollY).toBe(80);
  });

  it("keeps the lock until the last nested overlay releases", () => {
    const first = lockOverlayScroll();
    const second = lockOverlayScroll();
    first();
    expect(document.body.classList.contains("mysafeops-overlay-open")).toBe(true);
    second();
    expect(document.body.classList.contains("mysafeops-overlay-open")).toBe(false);
  });
});
