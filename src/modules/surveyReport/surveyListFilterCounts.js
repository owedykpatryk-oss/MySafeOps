import { surveyReportQuality } from "./surveyReportHelpers";

/** Counts for list filter pills. */
export function surveyListFilterCounts(reports = []) {
  const rows = reports || [];
  let draft = 0;
  let final = 0;
  let ready = 0;
  rows.forEach((r) => {
    if (r.status === "final") final += 1;
    else {
      draft += 1;
      if (surveyReportQuality(r).score >= 80) ready += 1;
    }
  });
  return { all: rows.length, draft, final, ready };
}
