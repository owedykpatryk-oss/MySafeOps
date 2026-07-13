/** List filtering and grouping for GPR reports. */
import { gprReportQuality, normalizeGprReport } from "./gprReportHelpers";

export function filterGprReports(reports, { search = "", status = "all", projectId = "" } = {}) {
  let rows = reports.map(normalizeGprReport);
  const q = search.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.ref || "").toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.siteAddress || "").toLowerCase().includes(q) ||
        (r.projectName || "").toLowerCase().includes(q)
    );
  }
  if (projectId) rows = rows.filter((r) => r.projectId === projectId);
  if (status === "draft") rows = rows.filter((r) => r.status !== "final");
  if (status === "final") rows = rows.filter((r) => r.status === "final");
  if (status === "ready") {
    rows = rows.filter((r) => r.status !== "final" && gprReportQuality(r).score >= 80);
  }
  return rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function groupGprReportsByProject(reports, projects = []) {
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const groups = new Map();
  for (const r of reports) {
    const pid = r.projectId || "";
    const key = pid || "__none__";
    if (!groups.has(key)) {
      groups.set(key, {
        projectId: pid,
        projectName: byId[pid]?.name || r.projectName || (pid ? "Project" : "No project linked"),
        reports: [],
      });
    }
    groups.get(key).reports.push(r);
  }
  return [...groups.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
}

/** Turn on deliverable flags when evidence exists (never turns off user choices). */
export function suggestDeliverableFlags(report) {
  const d = { ...(report.deliverables || {}) };
  if (report.radargrams?.length) d.radargram_figures = true;
  if (report.scanPanels?.length) d.scan_panel_summary = true;
  if (report.planFigures?.length) d.plan_layout_cad = true;
  if (report.chainageSegments?.length) d.chainage_profiles = true;
  if ((report.processing?.filters || []).some((f) => f.applied)) d.depth_slices = d.depth_slices || false;
  return d;
}

export const GPR_LIST_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "ready", label: "Ready ≥80%" },
  { key: "final", label: "Final" },
];
