/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { appApiUrl } from "./appApiUrl";
import { reverseUkPostcode } from "./postcodeLookup";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("preserves same-origin API paths in web and PWA", () => {
  expect(appApiUrl("/api/postcode?code=KT227SH")).toBe("/api/postcode?code=KT227SH");
});

it("uses the configured HTTPS host in a native WebView", () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  vi.stubEnv("VITE_API_BASE_URL", "https://qa.example.com");
  expect(appApiUrl("/api/postcode?code=KT227SH")).toBe("https://qa.example.com/api/postcode?code=KT227SH");
});

it("routes a real postcode request to the configured native API host", async () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  vi.stubEnv("VITE_API_BASE_URL", "https://qa.example.com");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: {
    postcode: "KT22 7SH", latitude: 51.3, longitude: -0.3,
  } }), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  expect((await reverseUkPostcode(51.3, -0.3))?.postcode).toBe("KT22 7SH");
  expect(fetchMock).toHaveBeenCalledWith("https://qa.example.com/api/postcode?lat=51.3&lng=-0.3", expect.any(Object));
});

it("does not silently send native requests to production or another host", () => {
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  vi.stubEnv("VITE_API_BASE_URL", "");
  expect(() => appApiUrl("/api/health")).toThrow("Native API origin is missing");
  vi.stubEnv("VITE_API_BASE_URL", "http://qa.example.com");
  expect(() => appApiUrl("/api/health")).toThrow("HTTPS origin");
  expect(() => appApiUrl("//other.example/api/health")).toThrow("internal /api/ path");
  expect(() => appApiUrl("/api/../private")).toThrow("internal /api/ path");
  expect(() => appApiUrl("/api/%2e%2e/private")).toThrow("internal /api/ path");
});
