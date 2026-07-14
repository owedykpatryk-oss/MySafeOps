import { describe, expect, it } from "vitest";
import { formatRouteDuration } from "./hospitalRoute";

describe("formatRouteDuration", () => {
  it("formats minutes", () => {
    expect(formatRouteDuration(900)).toBe("~15 min drive");
  });

  it("formats hours", () => {
    expect(formatRouteDuration(5400)).toBe("~1h 30m drive");
  });

  it("returns empty for invalid", () => {
    expect(formatRouteDuration(null)).toBe("");
  });
});
