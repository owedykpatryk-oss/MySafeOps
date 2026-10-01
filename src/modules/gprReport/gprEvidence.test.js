import { describe, expect, it } from "vitest";
import {
  buildBgsEvidence,
  buildGprEvidenceReviewPayload,
  historicalResearchLinks,
  mergeGprEvidenceReview,
  safeEvidenceImageSrc,
  sanitizeEvidenceAssessments,
} from "./gprEvidence.js";

describe("GPR evidence register", () => {
  it("creates BGS evidence only for an accepted, coordinate-matched lookup", () => {
    expect(buildBgsEvidence({ groundConditions: { fetchedAt: "2026-09-25", queryLat: 55, queryLng: -4 } })).toBeNull();
    const evidence = buildBgsEvidence({ groundConditions: {
      fetchedAt: "2026-09-25T08:00:00Z",
      locationVerified: true,
      queryLat: 55.864,
      queryLng: -4.433,
      bedrock: { lexDescription: "Sedimentary bedrock" },
    } });
    expect(evidence.verified).toBe(true);
    expect(evidence.observedFact).toContain("Sedimentary bedrock");
  });

  it("excludes unverified and uncited historical claims from the AI payload", () => {
    const payload = buildGprEvidenceReviewPayload({
      historicalEvidence: [
        { id: "a", verified: true, sourceUrl: "https://archive.example/a", observedFact: "A building is depicted." },
        { id: "b", verified: false, sourceUrl: "https://archive.example/b", observedFact: "A cemetery is depicted." },
        { id: "c", verified: true, sourceUrl: "", observedFact: "Uncited claim." },
      ],
    });
    expect(payload.evidence.map((item) => item.id)).toEqual(["a"]);
  });

  it("deep-links NLS exploration to the verified report point", () => {
    const links = historicalResearchLinks({ groundConditions: { queryLat: 55.864, queryLng: -4.433 } }, null);
    expect(links.find((item) => item.key === "nls").url).toContain("lat=55.864000");
  });

  it("drops invented classifications and non-image payloads", () => {
    const kept = sanitizeEvidenceAssessments([
      {
        evidenceId: "a",
        relevance: "The site contains a cemetery",
        mechanisms: ["former_foundations"],
        recommendedActions: ["none"],
        caveat: "none",
      },
      {
        evidenceId: "a",
        relevance: "high",
        mechanisms: ["former_foundations"],
        recommendedActions: ["correlate_with_radargrams"],
        caveat: "correlation_not_causation",
      },
    ], ["a"]);
    expect(kept).toEqual([expect.objectContaining({ evidenceId: "a", relevance: "high" })]);
    expect(safeEvidenceImageSrc("javascript:alert(1)")).toBe("");
    expect(safeEvidenceImageSrc("data:image/png;base64,aaaa")).toBe("data:image/png;base64,aaaa");
  });

  it("refuses to merge an assessment for evidence that is not verified", () => {
    const merged = mergeGprEvidenceReview({
      historicalEvidence: [
        { id: "a", verified: true, sourceUrl: "https://archive.example/a", observedFact: "A building is depicted." },
      ],
    }, {
      assessments: [{
        evidenceId: "invented",
        relevance: "high",
        mechanisms: ["grave_or_burial_features"],
        recommendedActions: ["none"],
        caveat: "none",
      }],
      model: "gpt-6-luna",
    });
    expect(merged.evidenceReview.assessments).toEqual([]);
    expect(merged.evidenceReview.policy).toBe("verified-evidence-only");
  });
});
