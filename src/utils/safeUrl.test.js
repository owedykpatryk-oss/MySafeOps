import { describe, expect, it } from "vitest";
import { safeBrandAssetUrl, safeHttpUrl, safeInternalPath } from "./safeUrl.js";

describe("safeInternalPath", () => {
  it("allows normal app paths", () => {
    expect(safeInternalPath("/app", "/x")).toBe("/app");
    expect(safeInternalPath("/app?tab=1", "/x")).toBe("/app?tab=1");
    expect(safeInternalPath("/settings#m", "/x")).toBe("/settings#m");
  });

  it("blocks open redirects and protocol trickery", () => {
    expect(safeInternalPath("//evil.com/phish", "/app")).toBe("/app");
    expect(safeInternalPath("https://evil.com", "/app")).toBe("/app");
    expect(safeInternalPath("javascript:alert(1)", "/app")).toBe("/app");
    expect(safeInternalPath("/\\evil", "/app")).toBe("/app");
    expect(safeInternalPath("///triple", "/app")).toBe("/app");
  });

  it("decodes once and still rejects", () => {
    expect(safeInternalPath(encodeURIComponent("//x.test"), "/app")).toBe("/app");
  });
});

describe("safeBrandAssetUrl", () => {
  it("allows first-party branding paths and https assets", () => {
    expect(safeBrandAssetUrl("/branding/barnes-fernandez-logo.png")).toBe(
      "/branding/barnes-fernandez-logo.png",
    );
    expect(safeBrandAssetUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
  });

  it("rejects protocol-relative, http, and non-http schemes", () => {
    expect(safeBrandAssetUrl("//evil.test/logo.png")).toBe("");
    expect(safeBrandAssetUrl("http://cdn.example.com/logo.png")).toBe("");
    expect(safeBrandAssetUrl("javascript:alert(1)")).toBe("");
    expect(safeBrandAssetUrl("data:image/png;base64,aaa")).toBe("");
    expect(safeBrandAssetUrl("")).toBe("");
  });
});

describe("safeHttpUrl", () => {
  it("blocks javascript: URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks data: and empty values", () => {
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("allows http(s) URLs", () => {
    expect(safeHttpUrl("https://maps.google.com/?q=1")).toContain("https://");
    expect(safeHttpUrl("http://example.com/a")).toContain("http://");
  });
});
