import { describe, expect, it } from "vitest";
import { renderOfflineWorker } from "../../scripts/offlinePrecache.mjs";

describe("offline precache build", () => {
  const source = 'const SW_VERSION = "old";\nconst BUILD_ASSETS = /* BUILD_ASSETS */ [];';

  it("includes unopened chunks once and stamps the build version", () => {
    expect(renderOfflineWorker(source, ["/assets/rams-123.js", "/assets/main-456.css", "/assets/rams-123.js"], "abc123"))
      .toBe('const SW_VERSION = "mysafeops-abc123";\nconst BUILD_ASSETS = /* BUILD_ASSETS */ ["/assets/main-456.css","/assets/rams-123.js"];');
  });

  it("rejects unexpected paths and missing markers", () => {
    expect(() => renderOfflineWorker(source, ["https://other.example/app.js"], "abc123")).toThrow("Invalid offline precache asset path");
    expect(() => renderOfflineWorker("no markers", [], "abc123")).toThrow("Offline worker build markers are missing");
  });
});
