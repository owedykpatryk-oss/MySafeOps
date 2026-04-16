import { describe, it, expect } from "vitest";
import { getSoroEmbedSrc, DEFAULT_SORO_EMBED_SRC } from "./soroBlogConfig.js";

describe("getSoroEmbedSrc", () => {
  it("returns default when unset or blank", () => {
    expect(getSoroEmbedSrc({})).toBe(DEFAULT_SORO_EMBED_SRC);
    expect(getSoroEmbedSrc({ VITE_SORO_EMBED_URL: "" })).toBe(DEFAULT_SORO_EMBED_SRC);
    expect(getSoroEmbedSrc({ VITE_SORO_EMBED_URL: "   " })).toBe(DEFAULT_SORO_EMBED_SRC);
  });

  it("trims custom URL from env", () => {
    expect(getSoroEmbedSrc({ VITE_SORO_EMBED_URL: " https://app.trysoro.com/api/embed/other " })).toBe(
      "https://app.trysoro.com/api/embed/other"
    );
  });
});
