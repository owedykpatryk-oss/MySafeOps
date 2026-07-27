/**
 * Project hub pulse — computed readiness, pipeline gates, compliance strip, A4 site pack.
 */

import { openPrintWindowOrWarn, escapeHtml, writePrintWindowDocument } from "./htmlEscape.js";
import { healthTone, todayIsoDate, fmtProjectDay } from "./projectDashboard";
import { missingRequiredPermits } from "../modules/permits/permitProjectDefaults";
import { isSurveyWorkflowEnabled, getProjectHubTailStep } from "./projectHubIndustry";
import {
  applyIndustryReadinessGates,
  buildIndustryCompliancePulse,
  buildIndustrySitePackFocusHtml,
  createIndustryRegisterSnapshot,
  getIndustryPackLabel,
  getIndustrySitePackRows,
  getIndustrySitePackTitle,
} from "./industryPackProfile";
import { getOrgIndustryPackId } from "./projectHubIndustry";
import { getOrgMarketId } from "./orgMarket";
import { getCompliancePackContent } from "../config/compliancePackContent";
import { getRamsShortLabel } from "./marketLabels";

const he = escapeHtml;

/** @typedef {'done'|'warn'|'todo'} GateStatus */

/**
 * Weighted readiness from live linked documents (not stored healthScore alone).
 * @returns {{ score: number, tone: string, gates: Array<{ key: string, label: string, points: number, max: number, ok: boolean }> }}
 */
export function computeProjectReadiness(project, dash, industryCtx, marketId = getOrgMarketId()) {
  const pack = getCompliancePackContent(marketId);
  const ramsLabel = getRamsShortLabel(marketId);
  const gates = [];
  const add = (key, label, max, ok) => {
    gates.push({ key, label, points: ok ? max : 0, max, ok });
  };

  const hasIntel = Boolean(
    project?.weatherSnapshot || project?.weatherAtStartSnapshot || project?.nearestHospital
  );
  add("intel", "Site intel", 10, hasIntel);

  const hasLocation = Boolean(
    project?.lat != null && String(project.lat).trim() !== ""
  ) || Boolean(project?.boundaryPoints?.length || project?.boundaryGeoJson);
  add("location", "Map / boundary", 5, hasLocation);

  add("cdm", pack.planShort, 10, (dash?.cdmPacks?.length || 0) > 0);
  add("rams", ramsLabel, 20, (dash?.rams?.length || 0) > 0);

  const permitReady = dash?.permitReady || { required: 0, issued: 0, complete: true };
  const permitsOk =
    permitReady.required === 0
      ? (dash?.permits?.length || 0) > 0 || (dash?.rams?.length || 0) > 0
      : permitReady.complete;
  add("ptw", "Permits", 15, permitsOk);

  add("briefing", "Today's briefing", 15, Boolean(dash?.totals?.briefingToday));
  add("ms", "Method statement", 10, (dash?.methodStatements?.length || 0) > 0);
  if (isSurveyWorkflowEnabled()) {
    add("survey", "Survey report", 10, (dash?.surveys?.length || 0) > 0);
  } else {
    add("inspections", "Inspections", 10, (dash?.inspections?.length || 0) > 0);
  }
  add("plans", "Drawings", 5, (dash?.plans?.length || 0) > 0);

  applyIndustryReadinessGates(
    gates,
    project,
    dash,
    industryCtx?.packId,
    industryCtx?.registers
  );

  const score = Math.max(0, Math.min(100, gates.reduce((s, g) => s + g.points, 0)));
  return { score, tone: healthTone(score), gates };
}

export function todayBriefingStats(dailyBriefings = [], projectId, dateIso = todayIsoDate()) {
  const brief = (dailyBriefings || []).find(
    (b) => b?.projectId === projectId && String(b.date || "").slice(0, 10) === dateIso
  );
  if (!brief) return null;
  const attendees = brief.attendees || [];
  return {
    present: attendees.filter((a) => a.present).length,
    signed: attendees.filter((a) => a.sig).length,
    conductedBy: brief.conductedBy || "",
    location: brief.location || "",
  };
}

/**
 * Visual workflow pipeline for the hub hero.
 */
export function buildProjectPipeline(project, dash, marketId = getOrgMarketId()) {
  const pack = getCompliancePackContent(marketId);
  const ramsLabel = getRamsShortLabel(marketId);
  const permitReady = dash?.permitReady || { required: 0, issued: 0, complete: true };
  const missingPt = missingRequiredPermits(project, dash?.permits || []);

  /** @type {Array<{ key: string, icon: string, label: string, hint: string, status: GateStatus, viewId: string, action?: string }>} */
  const steps = [
    {
      key: "intel",
      icon: "🌦️",
      label: "Intel",
      hint: project?.weatherSnapshot
        ? "Weather on file"
        : marketId === "pl"
          ? "Dodaj pogodę i SOR"
          : marketId === "au"
            ? "Add weather & ED"
            : "Add weather & A&E",
      status: project?.weatherSnapshot || project?.nearestHospital ? "done" : "todo",
      viewId: "projects",
      action: "editProject",
    },
    {
      key: "cdm",
      icon: "🏗️",
      label: pack.badgeText,
      hint: dash?.cdmPacks?.length
        ? `${dash.cdmPacks.length} pack(s)`
        : marketId === "pl"
          ? "Utwórz plan BHP"
          : marketId === "au"
            ? "Create WHS plan"
            : "Create CPP",
      status: dash?.cdmPacks?.length ? "done" : "todo",
      viewId: pack.moduleId,
      action: dash?.cdmPacks?.length ? undefined : "create",
    },
    {
      key: "rams",
      icon: "⚠️",
      label: ramsLabel,
      hint: dash?.rams?.length ? `${dash.rams.length} doc(s)` : `Draft ${ramsLabel}`,
      status: dash?.rams?.length ? "done" : "todo",
      viewId: "rams",
      action: dash?.rams?.length ? undefined : "create",
    },
    {
      key: "ptw",
      icon: "📋",
      label: "PTW",
      hint:
        permitReady.required > 0
          ? `${permitReady.issued}/${permitReady.required} issued`
          : dash?.permits?.length
            ? `${dash.totals?.activePermits || 0} active`
            : "Issue permit",
      status: permitReady.required > 0
        ? permitReady.complete
          ? "done"
          : missingPt.length
            ? "warn"
            : "todo"
        : dash?.permits?.length
          ? "done"
          : "todo",
      viewId: "permits",
      action: "issueFromDefaults",
    },
    {
      key: "briefing",
      icon: "📣",
      label: "Briefing",
      hint: dash?.totals?.briefingToday ? "Done today" : "Record before start",
      status: dash?.totals?.briefingToday ? "done" : "warn",
      viewId: "daily-briefing",
      action: "create",
    },
    getProjectHubTailStep(dash),
  ];

  return steps;
}

/**
 * Compact compliance pulse chips for at-a-glance status.
 */
export function buildCompliancePulse(project, dash, industryCtx) {
  const briefing = todayBriefingStats(dash?.dailyBriefings, project?.id);
  const openSnags = dash?.totals?.openSnags || 0;
  const missingRams = dash?.totals?.permitsMissingRams || 0;

  /** @type {Array<{ id: string, label: string, value: string, status: GateStatus, viewId?: string, action?: string }>} */
  const items = [
    {
      id: "briefing",
      label: "Daily briefing",
      value: briefing ? `${briefing.signed}/${briefing.present} signed` : "Not recorded today",
      status: dash?.totals?.briefingToday ? "done" : "warn",
      viewId: "daily-briefing",
      action: "create",
    },
    {
      id: "ptw",
      label: "Active PTW",
      value: String(dash?.totals?.activePermits || 0),
      status: missingRams > 0 ? "warn" : (dash?.totals?.activePermits || 0) > 0 ? "done" : "todo",
      viewId: "permits",
    },
    {
      id: "snags",
      label: "Open snags",
      value: openSnags ? String(openSnags) : "None",
      status: openSnags > 0 ? "warn" : "done",
      viewId: "snags",
    },
    {
      id: "hours",
      label: "Hours this week",
      value: dash?.timesheetSummary?.hoursThisWeek
        ? `${dash.timesheetSummary.hoursThisWeek}h · ${dash.timesheetSummary.workersThisWeek} people`
        : "0h logged",
      status: (dash?.timesheetSummary?.hoursThisWeek || 0) > 0 ? "done" : "todo",
      viewId: "timesheets",
    },
    {
      id: "team",
      label: "Team on site",
      value: dash?.team?.length ? `${dash.team.length} assigned` : "Assign people",
      status: (dash?.team?.length || 0) > 0 ? "done" : "todo",
      viewId: "people",
    },
    {
      id: "docs",
      label: "Linked documents",
      value: String(dash?.totals?.documents || 0),
      status: (dash?.totals?.documents || 0) >= 5 ? "done" : (dash?.totals?.documents || 0) > 0 ? "warn" : "todo",
    },
  ];

  const industryItems = buildIndustryCompliancePulse(
    dash,
    industryCtx?.packId,
    industryCtx?.registers
  );
  const merged = [...industryItems, ...items];
  const seen = new Set();
  return merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function buildProjectHubPulse(project, dash, industryCtx) {
  const ctx = industryCtx || {
    packId: getOrgIndustryPackId(),
    registers: createIndustryRegisterSnapshot(),
  };
  const readiness = computeProjectReadiness(project, dash, ctx);
  const pipeline = buildProjectPipeline(project, dash);
  const pulse = buildCompliancePulse(project, dash, ctx);
  const briefing = todayBriefingStats(dash?.dailyBriefings, project?.id);
  const pipelineDone = pipeline.filter((s) => s.status === "done").length;
  return {
    readiness: readiness.score,
    tone: readiness.tone,
    gates: readiness.gates,
    pipeline,
    pipelineDone,
    pipelineTotal: pipeline.length,
    pulse,
    briefing,
  };
}

function gateRowsHtml(gates) {
  return gates
    .map(
      (g) =>
        `<tr><td>${he(g.label)}</td><td style="text-align:right;font-weight:600;color:${g.ok ? "#27500A" : "#633806"}">${g.ok ? "✓" : "—"}</td><td style="text-align:right">${g.points}/${g.max}</td></tr>`
    )
    .join("");
}

/**
 * A4 print summary for one project — client / handover snapshot.
 */
export function printProjectSitePack(project, dash, _workers = []) {
  void (async () => {
  if (!project) return;
  const industryCtx = {
    packId: getOrgIndustryPackId(),
    registers: createIndustryRegisterSnapshot(),
  };
  const pulse = buildProjectHubPulse(project, dash, industryCtx);
  const addr = [project.site, project.address, project.postcode].filter(Boolean).join(" · ");
  const win = openPrintWindowOrWarn({ message: "Allow pop-ups to print the site pack." });
  if (!win) return;

  await writePrintWindowDocument(win, `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${he(getIndustrySitePackTitle(industryCtx.packId))} — ${he(project.name || "Project")}</title>
  <style>
    body{font-family:system-ui,sans-serif;font-size:11px;color:#0f172a;margin:24px;line-height:1.45}
    h1{font-size:18px;margin:0 0 4px}
    .meta{color:#64748b;margin-bottom:16px}
    .score{font-size:28px;font-weight:700;color:#0d9488}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:0.5px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:10px}
    th{background:#f8fafc}
    .section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin:18px 0 6px}
    ul{margin:0;padding-left:16px}
    .foot{font-size:9px;color:#94a3b8;margin-top:24px}
  </style></head><body>
  <h1>${he(project.name || "Untitled project")}</h1>
  <div class="meta">${he(addr || "Site address not set")} · ${he(getIndustryPackLabel())} · Generated ${he(fmtProjectDay(new Date().toISOString()))}</div>
  <div class="score">${pulse.readiness}% site readiness</div>
  <p>Pipeline ${pulse.pipelineDone}/${pulse.pipelineTotal} complete · ${dash?.totals?.documents || 0} linked documents · ${dash?.team?.length || 0} team</p>

  ${buildIndustrySitePackFocusHtml(industryCtx.packId, dash, industryCtx.registers, he)}

  <div class="section">Readiness gates</div>
  <table><thead><tr><th>Gate</th><th>Status</th><th>Points</th></tr></thead><tbody>${gateRowsHtml(pulse.gates)}</tbody></table>

  <div class="section">Today's briefing</div>
  <p>${
    pulse.briefing
      ? `${he(pulse.briefing.location || "Site")} — ${pulse.briefing.signed} signed of ${pulse.briefing.present} present${pulse.briefing.conductedBy ? ` · ${he(pulse.briefing.conductedBy)}` : ""}`
      : "No briefing recorded for today."
  }</p>

  <div class="section">Document counts</div>
  <table><tbody>
    <tr><td>RAMS</td><td>${dash?.rams?.length || 0}</td></tr>
    <tr><td>Permits (PTW)</td><td>${dash?.permits?.length || 0} (${dash?.totals?.activePermits || 0} active)</td></tr>
    <tr><td>Method statements</td><td>${dash?.methodStatements?.length || 0}</td></tr>
    ${isSurveyWorkflowEnabled() ? `<tr><td>Survey reports</td><td>${dash?.surveys?.length || 0}</td></tr>` : `<tr><td>Inspections</td><td>${dash?.inspections?.length || 0}</td></tr>`}
    <tr><td>Daily briefings</td><td>${dash?.dailyBriefings?.length || 0}</td></tr>
    <tr><td>CDM packs</td><td>${dash?.cdmPacks?.length || 0}</td></tr>
    <tr><td>Snags (open)</td><td>${dash?.totals?.openSnags || 0}</td></tr>
    <tr><td>Hours this week</td><td>${dash?.timesheetSummary?.hoursThisWeek || 0}h</td></tr>
    ${getIndustrySitePackRows(industryCtx.packId, industryCtx.registers, dash)
      .map((row) => `<tr><td>${he(row.label)}</td><td>${he(row.value)}</td></tr>`)
      .join("")}
  </tbody></table>

  ${project.weatherSnapshot ? `<div class="section">Weather</div><p>${he(String(project.weatherSnapshot).slice(0, 240))}</p>` : ""}
  ${project.nearestHospital ? `<div class="section">Nearest A&amp;E</div><p>${he(project.nearestHospital)}</p>` : ""}

  ${(dash?.team?.length || 0) > 0 ? `<div class="section">Team</div><ul>${dash.team.map((w) => `<li>${he(w.name || "Worker")}${w.role ? ` — ${he(w.role)}` : ""}</li>`).join("")}</ul>` : ""}

  <p class="foot">MySafeOps project site pack · CDM / RAMS / PTW / briefing evidence should be maintained on the live system.</p>
  </body></html>`);
  win.print();
  })();
}
