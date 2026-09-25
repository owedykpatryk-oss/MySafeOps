/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  overlayDraftKey,
  writeOverlayFormDraft,
  readOverlayFormDraft,
  clearOverlayFormDraft,
  mergeOverlayDraft,
  seedOverlayForm,
} from "./useOverlayFormDraft.js";

describe("overlay form draft", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips JSON and merges without dropping live photos", () => {
    const key = overlayDraftKey("inspection", "new");
    expect(writeOverlayFormDraft(key, { name: "Chain block", notes: "ok" })).toBe(true);
    expect(readOverlayFormDraft(key).name).toBe("Chain block");

    const merged = mergeOverlayDraft(
      { name: "", photo: "data:image/png;base64,xx" },
      { name: "Chain block" }
    );
    expect(merged.name).toBe("Chain block");
    expect(merged.photo).toBe("data:image/png;base64,xx");

    clearOverlayFormDraft(key);
    expect(readOverlayFormDraft(key)).toBeNull();
  });

  it("seeds initial form from a stored draft", () => {
    const key = overlayDraftKey("snag", "new");
    writeOverlayFormDraft(key, { title: "Missing cover" });
    const seeded = seedOverlayForm({ title: "", location: "Yard" }, key);
    expect(seeded.title).toBe("Missing cover");
    expect(seeded.location).toBe("Yard");
  });
});
