/** Existing six-point scale; keep historical assessments editable without rescaling them. */
export const RISK_AXIS = [1, 2, 3, 4, 5, 6];

export function getRiskScore(risk) {
  if (!risk || typeof risk !== "object") return null;
  // When axes are supplied, they are authoritative. RF is a derived value.
  if ("L" in risk || "S" in risk) {
    if (typeof risk.L === "boolean" || typeof risk.S === "boolean") return null;
    const l = Number(risk.L);
    const s = Number(risk.S);
    return RISK_AXIS.includes(l) && RISK_AXIS.includes(s) ? l * s : null;
  }
  if (risk.RF == null || risk.RF === "" || typeof risk.RF === "boolean") return null;
  const rf = Number(risk.RF);
  return Number.isInteger(rf) && rf >= 1 && rf <= 36 ? rf : null;
}

export function isValidRiskAssessment(risk) {
  const score = getRiskScore(risk);
  return score !== null && RISK_AXIS.includes(Number(risk?.L)) &&
    RISK_AXIS.includes(Number(risk?.S)) && risk.RF != null &&
    risk.RF !== "" && Number(risk.RF) === score;
}

/** Risk matrix banding — shared by builder, print HTML, and share view (no hazard library). */
export function getRiskLevel(risk) {
  const RF = getRiskScore(risk);
  if (RF === null) return "unknown";
  if (RF >= 24) return "high";
  if (RF >= 12) return "medium";
  return "low";
}

export const RISK_COLORS = {
  unknown: { bg: "#F1F5F9", color: "#475569", label: "Not assessed — check likelihood and severity" },
  high: { bg: "#FCEBEB", color: "#791F1F", label: "High risk — eliminate, discuss with manager" },
  medium: { bg: "#FAEEDA", color: "#633806", label: "Medium risk — reduce/change work programme" },
  low: { bg: "#EAF3DE", color: "#27500A", label: "Low risk — reduce as far as reasonably practicable" },
};
