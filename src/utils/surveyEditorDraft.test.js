/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { stripSurveyFormForSessionDraft, mergeSurveyDraftPhotos } from "./surveyEditorDraft";

describe("surveyEditorDraft", () => {
  it("strips dataUrl photos but keeps http thumbnails", () => {
    const out = stripSurveyFormForSessionDraft({
      id: "sr1",
      photos: [
        { id: "a", dataUrl: "data:image/png;base64,AAAA", caption: "pit" },
        { id: "b", dataUrl: "https://cdn.example/p.jpg", caption: "cover" },
      ],
    });
    expect(out.photos[0].dataUrl).toBe("");
    expect(out.photos[0].caption).toBe("pit");
    expect(out.photos[1].dataUrl).toBe("https://cdn.example/p.jpg");
  });

  it("merges live dataUrls back onto stripped draft photos", () => {
    const merged = mergeSurveyDraftPhotos(
      { id: "sr1", photos: [{ id: "a", dataUrl: "", caption: "pit" }] },
      { id: "sr1", photos: [{ id: "a", dataUrl: "data:image/png;base64,AAAA", caption: "old" }] }
    );
    expect(merged.photos[0].dataUrl).toMatch(/^data:/);
    expect(merged.photos[0].caption).toBe("pit");
  });
});
