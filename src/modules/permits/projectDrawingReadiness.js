/** Weighted checks for UK site drawing / RAMS readiness. */
export const PROJECT_DRAWING_READINESS_CHECKS = [
  { id: "site", label: "Site centred", weight: 15 },
  { id: "boundary", label: "Site boundary", weight: 15 },
  { id: "muster", label: "Muster point", weight: 15 },
  { id: "firstAid", label: "First aid / AED", weight: 10 },
  { id: "escapeRoute", label: "Escape route", weight: 15 },
  { id: "hospital", label: "Nearest A&E route", weight: 20 },
  { id: "screenshot", label: "Map attachment saved", weight: 10 },
];

/**
 * @param {object} input
 * @param {boolean} input.siteOk
 * @param {boolean} input.hasBoundary
 * @param {Array} input.objects
 * @param {number} input.escapeRouteCount
 * @param {boolean} input.hospitalReady
 * @param {boolean} input.screenshotSaved
 */
export function computeProjectDrawingReadiness(input = {}) {
  const objects = Array.isArray(input.objects) ? input.objects : [];
  const checks = {
    site: Boolean(input.siteOk),
    boundary: Boolean(input.hasBoundary),
    muster: objects.some((o) => o?.type === "master_point"),
    firstAid: objects.some((o) => o?.type === "first_aid" || o?.type === "aed"),
    escapeRoute: Number(input.escapeRouteCount) > 0,
    hospital: Boolean(input.hospitalReady),
    screenshot: Boolean(input.screenshotSaved),
  };

  const items = PROJECT_DRAWING_READINESS_CHECKS.map((c) => ({
    ...c,
    done: Boolean(checks[c.id]),
    earned: checks[c.id] ? c.weight : 0,
  }));

  const score = items.reduce((sum, item) => sum + item.earned, 0);
  const max = PROJECT_DRAWING_READINESS_CHECKS.reduce((sum, item) => sum + item.weight, 0);
  const missing = items.filter((item) => !item.done).map((item) => item.label);

  let tone = "low";
  if (score >= 85) tone = "ready";
  else if (score >= 50) tone = "mid";

  let label = "Needs setup";
  if (score >= 85) label = "RAMS ready";
  else if (score >= 50) label = "In progress";

  return { score, max, items, missing, tone, label };
}
