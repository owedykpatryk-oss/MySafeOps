/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { preferCollapsedEditorChrome } from "./narrowUi.js";

describe("preferCollapsedEditorChrome", () => {
  it("reads matchMedia for phone chrome", () => {
    const orig = window.matchMedia;
    window.matchMedia = () => ({ matches: true, media: "", addListener() {}, removeListener() {} });
    expect(preferCollapsedEditorChrome()).toBe(true);
    window.matchMedia = orig;
  });
});
