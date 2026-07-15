import { describe, expect, it } from "vitest";
import { genOpaqueToken } from "./opaqueToken.js";

describe("genOpaqueToken", () => {
  it("prefixes tokens and returns unique values", () => {
    const a = genOpaqueToken("ack");
    const b = genOpaqueToken("ack");
    expect(a.startsWith("ack_")).toBe(true);
    expect(b.startsWith("ack_")).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("sanitizes odd prefixes", () => {
    expect(genOpaqueToken("r@ms!").startsWith("rms_")).toBe(true);
  });
});
