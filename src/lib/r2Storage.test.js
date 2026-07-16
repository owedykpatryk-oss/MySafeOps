import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pickR2ViewUrl } from "./r2Storage.js";

describe("pickR2ViewUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers unexpired signed URL", () => {
    const url = pickR2ViewUrl({
      signedUrl: "https://worker.example/signed?k=1",
      signedExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      publicUrl: "https://cdn.example/a.pdf",
    });
    expect(url).toContain("/signed");
  });

  it("falls back to public URL when signed expired", () => {
    const url = pickR2ViewUrl({
      signedUrl: "https://worker.example/signed?k=1",
      signedExpiresAt: Math.floor(Date.now() / 1000) - 10,
      publicUrl: "https://cdn.example/a.pdf",
    });
    expect(url).toBe("https://cdn.example/a.pdf");
  });

  it("returns null when nothing available", () => {
    expect(pickR2ViewUrl({})).toBeNull();
  });
});
