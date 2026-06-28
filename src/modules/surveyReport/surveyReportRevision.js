import { normalizeSurveyReport } from "./surveyReportHelpers";

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Build a visual revision timeline from history, parent chain, and diff. */
export function buildRevisionTimeline(report, allReports = []) {
  const r = normalizeSurveyReport(report);
  const timeline = [];
  const seen = new Set();

  let parentId = r.parentReportId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = allReports.find((x) => x.id === parentId);
    if (!parent) break;
    timeline.unshift({
      id: parent.id,
      revision: parent.documentControl?.revision || "—",
      date: parent.documentControl?.issueDate || parent.updatedAt,
      author: parent.documentControl?.preparedBy || parent.surveyor || "",
      description: parent.title || parent.ref || "Previous issue",
      status: parent.status,
      kind: "report",
    });
    parentId = parent.parentReportId;
  }

  (r.revisionHistory || []).forEach((h, idx) => {
    timeline.push({
      id: `hist_${idx}`,
      revision: h.revision || "—",
      date: h.date,
      author: h.author || "",
      description: h.description || "Revision entry",
      status: "",
      kind: "history",
    });
  });

  const curRev = r.documentControl?.revision || "A";
  if (!timeline.some((t) => t.revision === curRev && t.kind !== "report")) {
    timeline.push({
      id: r.id,
      revision: curRev,
      date: r.documentControl?.issueDate || r.updatedAt,
      author: r.documentControl?.preparedBy || r.surveyor || "",
      description: r.status === "final" ? "Current final issue" : "Working draft",
      status: r.status,
      kind: "current",
      current: true,
    });
  } else {
    timeline.forEach((t) => {
      if (t.revision === curRev && !t.current) {
        t.current = true;
        t.kind = "current";
        t.status = r.status;
      }
    });
  }

  return {
    timeline,
    changes: r.changesSincePrevious || [],
    parentRevision: r.parentRevision || "",
    parentReportId: r.parentReportId || "",
  };
}

export { fmtWhen as formatRevisionDate };
