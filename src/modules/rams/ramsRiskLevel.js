/** Risk matrix banding — shared by builder, print HTML, and share view (no hazard library). */
export function getRiskLevel({ RF }) {
  if (RF >= 24) return "high";
  if (RF >= 12) return "medium";
  return "low";
}

export const RISK_COLORS = {
  high: { bg: "#FCEBEB", color: "#791F1F", label: "High risk — eliminate, discuss with manager" },
  medium: { bg: "#FAEEDA", color: "#633806", label: "Medium risk — reduce/change work programme" },
  low: { bg: "#EAF3DE", color: "#27500A", label: "Low risk — reduce as far as reasonably practicable" },
};
