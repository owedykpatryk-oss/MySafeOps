export function actionSection(key) {
  if (key === "template") return "overview";
  if (key.startsWith("document-") || key.startsWith("checklist-context-")) return "documents";
  if (key === "operator-release" || key === "register-change" || key === "approved-content-changed") return "review";
  if (key.startsWith("checklist-") || ["rams-link", "manual-link", "manual-scope", "qa", "emergency"].includes(key))
    return "checklist";
  if (
    [
      "title",
      "time",
      "project",
      "boundary",
      "flightArea",
      "takeoff",
      "landing",
      "alternateLanding",
      "corridor",
      "region-geometry",
      "operation-kind",
    ].includes(key)
  )
    return "overview";
  if (
    [
      "pilot",
      "asset",
      "observer",
      "payload-asset",
      "defect",
      "inspection",
      "compatibility",
      "capability",
      "pathway-fields",
      "category",
      "height",
      "height-reference",
      "operator",
      "survey-lead",
      "aircraft-record",
    ].includes(key)
  )
    return "setup";
  return "checks";
}
export function missionReminders(missions, now = Date.now()) {
  return missions
    .filter((m) => !m.cancelled && !m.deletedAt)
    .flatMap((m) =>
      [
        ...(Array.isArray(m.sourceFacts) ? m.sourceFacts : [])
          .filter((f) => f?.expiresOn)
          .map((f) => ({
            id: `${m.id}:source:${f.field}`,
            kind: "source-document",
            until: `${f.expiresOn}T23:59:59Z`,
            section: "documents",
          })),
        ...(m.evidence || []).map((e) => ({
          id: `${m.id}:e:${e.id}`,
          kind: e.kind,
          until: e.validUntil,
          section: "checks",
        })),
        ...(m.operatorRelease
          ? [
              {
                id: `${m.id}:operator-release`,
                kind: "operator-release",
                until: m.operatorRelease.validUntil,
                section: "review",
              },
            ]
          : []),
        ...(m.weather
          ? [{ id: `${m.id}:forecast`, kind: "forecast", until: m.weather.validUntil, section: "checks" }]
          : []),
      ].map((r) => ({ ...r, missionId: m.id, title: m.title, expired: Date.parse(r.until) <= now }))
    )
    .filter((r) => Number.isFinite(Date.parse(r.until)) && Date.parse(r.until) <= now + 7 * 86400000)
    .sort((a, b) => Date.parse(a.until) - Date.parse(b.until));
}
