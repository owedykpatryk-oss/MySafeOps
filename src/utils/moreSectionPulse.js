/**
 * More modules section pulse — health ring, next action, attention strip.
 */

import { loadOrgScoped } from "./orgStorage";
import { todayIsoDate } from "./projectDashboard";
import { getModuleLabel, summarizeSectionStats } from "./moduleRegisterStats";
import { pickIndustryMoreNextAction, createIndustryRegisterSnapshot } from "./industryPackProfile";
import { getOrgIndustryPackId } from "./projectHubIndustry";

function scoreColor(score) {
  if (score >= 75) return "#0d9488";
  if (score >= 45) return "#d97706";
  return "#dc2626";
}

function mapAttentionModules(ids, statsMap) {
  return ids
    .filter((id) => statsMap[id]?.status === "attention")
    .map((id) => ({
      id,
      label: getModuleLabel(id),
      attentionCount: statsMap[id]?.attentionCount || 0,
      count: statsMap[id]?.count || 0,
    }))
    .sort((a, b) => b.attentionCount - a.attentionCount || a.label.localeCompare(b.label));
}

function mapEmptyModules(ids, statsMap) {
  return ids
    .filter((id) => statsMap[id]?.status === "empty")
    .map((id) => ({ id, label: getModuleLabel(id) }));
}

function pickSiteNextAction(attentionModules, emptyModules, industryCtx) {
  const industryAction = pickIndustryMoreNextAction(
    industryCtx?.packId,
    industryCtx?.registers
  );
  if (industryAction) return industryAction;

  const briefings = loadOrgScoped("daily_briefings", []);
  const today = todayIsoDate();
  if (briefings.length > 0 && !briefings.some((b) => String(b.date || "").slice(0, 10) === today)) {
    return {
      viewId: "daily-briefing",
      label: "Record today's briefing",
      reason: "No daily briefing logged yet today",
      tone: "warn",
    };
  }
  const unsigned = briefings.find((b) => String(b.date || "").slice(0, 10) === today);
  if (unsigned) {
    const present = (unsigned.attendees || []).filter((a) => a.present);
    const missing = present.filter((a) => !a.sig).length;
    if (missing > 0) {
      return {
        viewId: "daily-briefing",
        label: "Collect briefing signatures",
        reason: `${missing} attendee(s) not signed on today's briefing`,
        tone: "warn",
      };
    }
  }
  if (attentionModules.length) {
    const m = attentionModules[0];
    return {
      viewId: m.id,
      label: `Review ${m.label}`,
      reason: `${m.attentionCount || 1} item(s) need attention`,
      tone: "warn",
    };
  }
  if (emptyModules.some((m) => m.id === "daily-briefing")) {
    return {
      viewId: "daily-briefing",
      label: "Start daily briefings",
      reason: "Build your pre-work safety trail",
      tone: "info",
    };
  }
  return null;
}

function pickHseNextAction(attentionModules, emptyModules) {
  if (attentionModules.length) {
    const m = attentionModules[0];
    return {
      viewId: m.id,
      label: `Review ${m.label}`,
      reason: `${m.attentionCount || 1} item(s) need attention`,
      tone: "warn",
    };
  }
  const inspections = loadOrgScoped("inspection_records", []);
  const overdue = inspections.filter((item) => {
    const d = item?.nextInspectionDate;
    if (!d) return false;
    return new Date(d) < new Date();
  });
  if (overdue.length) {
    return {
      viewId: "inspections",
      label: "Clear overdue inspections",
      reason: `${overdue.length} inspection(s) past due date`,
      tone: "warn",
    };
  }
  if (emptyModules.length) {
    return {
      viewId: emptyModules[0].id,
      label: `Seed ${emptyModules[0].label}`,
      reason: "Empty register — add a record or use Seed empty",
      tone: "info",
    };
  }
  return null;
}

/**
 * @param {'hse'|'site'} tone
 * @param {{ id: string }[]} tabs
 * @param {Record<string, import('./moduleRegisterStats').getModuleRegisterStat extends (...args: any[]) => infer R ? R : never>} statsMap
 */
export function buildMoreSectionPulse(tone, tabs, statsMap, industryCtx) {
  const ids = (tabs || []).map((t) => t.id);
  const summary = summarizeSectionStats(statsMap, ids);
  const attentionModules = mapAttentionModules(ids, statsMap);
  const emptyModules = mapEmptyModules(ids, statsMap);
  const nextAction =
    tone === "site"
      ? pickSiteNextAction(attentionModules, emptyModules, industryCtx)
      : tone === "hse"
        ? pickHseNextAction(attentionModules, emptyModules)
        : null;

  return {
    summary,
    attentionModules: attentionModules.slice(0, 6),
    emptyModules,
    nextAction,
    scoreColor: scoreColor(summary.healthScore),
  };
}

/** Combined pulse for the More panel command centre (Site + HSE). */
export function buildMoreCommandCentrePulse(siteTabs, hseTabs, statsMap) {
  const industryCtx = {
    packId: getOrgIndustryPackId(),
    registers: createIndustryRegisterSnapshot(),
  };
  const site = buildMoreSectionPulse("site", siteTabs, statsMap, industryCtx);
  const hse = buildMoreSectionPulse("hse", hseTabs, statsMap);
  const tracked = site.summary.tracked + hse.summary.tracked;
  const combinedScore = tracked
    ? Math.round(
        (site.summary.healthScore * site.summary.tracked + hse.summary.healthScore * hse.summary.tracked) /
          tracked
      )
    : 0;

  const nextAction = site.nextAction || hse.nextAction;
  const attentionModules = [...site.attentionModules, ...hse.attentionModules]
    .sort((a, b) => b.attentionCount - a.attentionCount)
    .slice(0, 8);

  return {
    combinedScore,
    scoreColor: scoreColor(combinedScore),
    records: site.summary.records + hse.summary.records,
    attention: site.summary.attention + hse.summary.attention,
    empty: site.summary.empty + hse.summary.empty,
    nextAction,
    attentionModules,
    site,
    hse,
  };
}
