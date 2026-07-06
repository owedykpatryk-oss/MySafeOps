/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  D1_WRITE_FORBIDDEN_EVENT,
  isForbiddenD1Write,
  notifyD1WriteForbidden,
} from "./d1WriteForbidden.js";

describe("d1WriteForbidden", () => {
  beforeEach(() => {
    vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects forbidden D1 errors", () => {
    expect(isForbiddenD1Write("Forbidden: cannot write")).toBe(true);
    expect(isForbiddenD1Write("http_403")).toBe(true);
    expect(isForbiddenD1Write("version_conflict")).toBe(false);
  });

  it("dispatches event with namespace-specific copy", () => {
    notifyD1WriteForbidden("mysafeops_workers");
    expect(window.dispatchEvent).toHaveBeenCalled();
    const ev = window.dispatchEvent.mock.calls[0][0];
    expect(ev.type).toBe(D1_WRITE_FORBIDDEN_EVENT);
    expect(ev.detail.message).toMatch(/workers/i);
  });
});
