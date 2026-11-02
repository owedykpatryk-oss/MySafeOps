/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  overlayDraftKey,
  writeOverlayFormDraft,
  readOverlayFormDraft,
  clearOverlayFormDraft,
  mergeOverlayDraft,
  seedOverlayForm,
  submitOverlayForm,
} from "./useOverlayFormDraft.js";

describe("overlay form draft", () => {
  beforeEach(() => {
    localStorage.clear();
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

  it("isolates drafts between organisations and operational countries", () => {
    localStorage.setItem("mysafeops_orgId", "company-a");
    const a = overlayDraftKey("inspection", "new");
    writeOverlayFormDraft(a, { name: "Company A equipment" });
    localStorage.setItem("mysafeops_orgId", "company-b");
    const b = overlayDraftKey("inspection", "new");
    expect(readOverlayFormDraft(b)).toBeNull();
    writeOverlayFormDraft(b, { name: "Company B equipment" });
    localStorage.setItem("mysafeops_active_country_workspace_snapshot_company-b", JSON.stringify({ id: "au", is_primary: false }));
    const au = overlayDraftKey("inspection", "new");
    expect(readOverlayFormDraft(au)).toBeNull();
    expect(new Set([a, b, au]).size).toBe(3);
    expect(readOverlayFormDraft(a).name).toBe("Company A equipment");
    expect(readOverlayFormDraft(b).name).toBe("Company B equipment");
  });

  it("does not assign an unscoped legacy draft to the current company", () => {
    sessionStorage.setItem("mso_overlay_draft_inspection_new", JSON.stringify({ name: "Unknown company equipment" }));
    expect(seedOverlayForm({ name: "" }, overlayDraftKey("inspection", "new"))).toEqual({ name: "" });
    expect(sessionStorage.getItem("mso_overlay_draft_inspection_new")).not.toBeNull();
  });

  it("preserves the latest form before an unexpected save exception", () => {
    const key = overlayDraftKey("inspection", "new");
    expect(() => submitOverlayForm(key, { name: "Latest equipment" }, () => { throw new Error("Unexpected failure"); })).toThrow("Unexpected failure");
    expect(readOverlayFormDraft(key)).toEqual({ name: "Latest equipment" });
  });
});
