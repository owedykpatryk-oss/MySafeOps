import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pickR2ViewUrl, isUsableR2PublicUrl } from "./r2Storage.js";

describe("pickR2ViewUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    vi.stubEnv("VITE_STORAGE_API_URL", "https://mysafeops-r2-upload.owedykpatryk.workers.dev");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
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

  it("ignores Worker /{key} fake public URLs", () => {
    expect(
      isUsableR2PublicUrl("https://mysafeops-r2-upload.owedykpatryk.workers.dev/geo-photos/org_x/a.jpg")
    ).toBe(false);
    expect(
      pickR2ViewUrl({
        publicUrl: "https://mysafeops-r2-upload.owedykpatryk.workers.dev/geo-photos/org_x/a.jpg",
      })
    ).toBeNull();
  });

  it("returns null when nothing available", () => {
    expect(pickR2ViewUrl({})).toBeNull();
  });
});
