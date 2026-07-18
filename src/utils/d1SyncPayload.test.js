import { describe, expect, it } from "vitest";
import {
  stripBriefingsForD1,
  stripGeoPhotosForD1,
  stripGprReportsForD1,
  stripSurveyReportsForD1,
} from "./d1SyncPayload";

describe("d1SyncPayload", () => {
  it("strips survey base64 photos but keeps https urls", () => {
    const out = stripSurveyReportsForD1([
      {
        id: "r1",
        photos: [
          { id: "a", dataUrl: "data:image/png;base64,AAAA" },
          { id: "b", dataUrl: "https://cdn.example/x.jpg" },
        ],
      },
    ]);
    expect(out[0].photos[0].dataUrl).toBe("");
    expect(out[0].photos[0].hasLocalMedia).toBe(true);
    expect(out[0].photos[1].dataUrl).toBe("https://cdn.example/x.jpg");
  });

  it("strips geo photo data urls", () => {
    const out = stripGeoPhotosForD1([{ id: "g1", dataUrl: "data:image/jpeg;base64,xx" }]);
    expect(out[0].dataUrl).toBe("");
  });

  it("strips briefing signature data urls", () => {
    const out = stripBriefingsForD1([{ id: "b1", attendees: [{ name: "A", sig: "data:image/png;base64,yy" }] }]);
    expect(out[0].attendees[0].sig).toBe("");
    expect(out[0].attendees[0].hasLocalSig).toBe(true);
  });

  it("strips GPR radargram and plan figure data urls", () => {
    const out = stripGprReportsForD1([
      {
        id: "g1",
        radargrams: [{ id: "r1", dataUrl: "data:image/png;base64,rg" }],
        planFigures: [{ id: "p1", dataUrl: "https://cdn.example/plan.png" }],
      },
    ]);
    expect(out[0].radargrams[0].dataUrl).toBe("");
    expect(out[0].radargrams[0].hasLocalMedia).toBe(true);
    expect(out[0].planFigures[0].dataUrl).toBe("https://cdn.example/plan.png");
  });
});