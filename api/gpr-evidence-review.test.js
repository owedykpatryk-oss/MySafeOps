import { describe, expect, it } from "vitest";
import { sanitizeEvidenceRequest, validateAssessmentOutput } from "./gpr-evidence-review.js";

describe("GPR evidence AI boundary", () => {
  it("accepts only verified evidence with an HTTPS citation", () => {
    const result = sanitizeEvidenceRequest({
      reportRef: "GPR-1",
      evidence: [
        { id: "ok", verified: true, sourceUrl: "https://maps.example/1", observedFact: "A footprint is depicted." },
        { id: "unverified", verified: false, sourceUrl: "https://maps.example/2", observedFact: "Ignore me." },
        { id: "bad_url", verified: true, sourceUrl: "javascript:alert(1)", observedFact: "Ignore me." },
      ],
    });
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].id).toBe("ok");
  });

  it("rejects an AI response that invents or omits an evidence id", () => {
    const base = {
      relevance: "moderate",
      mechanisms: ["former_foundations"],
      recommendedActions: ["correlate_with_radargrams"],
      caveat: "correlation_not_causation",
    };
    expect(validateAssessmentOutput({ assessments: [{ evidenceId: "ev1", ...base }] }, ["ev1", "ev2"])).toBeNull();
    expect(validateAssessmentOutput({ assessments: [{ evidenceId: "invented", ...base }] }, ["ev1"])).toBeNull();
  });

  it("rejects plain HTTP citations and a mechanism outside the allowlist", () => {
    expect(sanitizeEvidenceRequest({
      evidence: [{ id: "http", verified: true, sourceUrl: "http://maps.example/1", observedFact: "A road is shown." }],
    })).toBeNull();
    const bad = validateAssessmentOutput({
      assessments: [{
        evidenceId: "ev1",
        relevance: "high",
        mechanisms: ["definitely_a_castle"],
        recommendedActions: ["none"],
        caveat: "none",
      }],
    }, ["ev1"]);
    expect(bad).toBeNull();
  });

  it("returns only controlled enums for the exact supplied evidence ids", () => {
    const assessments = validateAssessmentOutput({ assessments: [{
      evidenceId: "ev1",
      relevance: "high",
      mechanisms: ["former_foundations"],
      recommendedActions: ["target_orthogonal_lines"],
      caveat: "map_registration_may_be_approximate",
    }] }, ["ev1"]);
    expect(assessments).toEqual([expect.objectContaining({ evidenceId: "ev1", relevance: "high" })]);
  });
});
