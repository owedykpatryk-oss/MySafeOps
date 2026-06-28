import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunkLoadError.js";

describe("isChunkLoadError", () => {
  it("detects dynamic import failures", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://x/assets/Foo.js"))).toBe(
      true
    );
    expect(isChunkLoadError(new Error("Loading chunk 12 failed."))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
  });
});
