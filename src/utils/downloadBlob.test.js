/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadBlob } from "./downloadBlob";

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("appends a temporary anchor, clicks it, and revokes later", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation((el) => {
      el.click = click;
      el.remove = remove;
      return el;
    });

    const ok = downloadBlob(new Blob(["x"], { type: "application/pdf" }), "report.pdf");
    expect(ok).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("opens blob URLs in a new tab on iOS WebKit", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    const createObjectURL = vi.fn(() => "blob:ios");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    let captured;
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => {
      captured = el;
      el.click = vi.fn();
      el.remove = vi.fn();
      return el;
    });

    expect(downloadBlob(new Blob(["x"], { type: "application/pdf" }), "report.pdf")).toBe(true);
    expect(captured.download).toBe("");
    expect(captured.target).toBe("_blank");
  });
});
