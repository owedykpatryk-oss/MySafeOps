import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeInternalPath } from "./safeUrl.js";

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

describe("safeHttpUrl", () => {
  it("blocks javascript: URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });
});
