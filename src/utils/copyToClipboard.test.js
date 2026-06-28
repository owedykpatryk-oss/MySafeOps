/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { copyTextToClipboard } from "./copyToClipboard.js";

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const ok = await copyTextToClipboard("hello");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false for empty text", async () => {
    expect(await copyTextToClipboard("")).toBe(false);
  });
});
