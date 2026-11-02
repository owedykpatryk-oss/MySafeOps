/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { buildRamsPreviewHtml } from "./ramsPrintHtml";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("prints a public RAMS share QR when running inside the native wrapper", () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://qa.example.com");
  const token = `r_${"a".repeat(32)}`;
  const html = buildRamsPreviewHtml({ title: "Native RAMS", shareToken: token, sharePublishedAt: "2026-01-01T00:00:00.000Z", shareExpiresAt: "2099-01-01T00:00:00.000Z", shareSourceUpdatedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", printSections: {} }, [], [], []);
  expect(html).toContain(encodeURIComponent(`https://qa.example.com/app?ramsShare=${token}`));
  expect(html).not.toContain(encodeURIComponent("http://localhost:3000"));
});
