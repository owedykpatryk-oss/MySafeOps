/**
 * Prebuilt smart suggestions for register modules (shown in module UI & More tiles).
 */

import { todayIsoDate } from "./projectDashboard";

/**
 * @param {string} moduleId
 * @param {object} ctx
 * @returns {Array<{ id: string, tone: 'warn'|'info'|'good', text: string, actionLabel?: string, viewId?: string, action?: string }>}
 */
export function getRegisterSmartTips(moduleId, ctx = {}) {
  const items =
    ctx.items ??
    ctx.list ??
    ctx.docs ??
    ctx.reports ??
    ctx.briefings ??
    ctx.packs ??
    ctx.snags ??
    ctx.entries ??
    [];
  const enriched = {
    ...ctx,
    items,
    briefings: ctx.briefings ?? items,
    entries: ctx.entries ?? items,
    count: ctx.count ?? (Array.isArray(items) ? items.length : 0),
  };

  switch (moduleId) {
    case "daily-briefing":
      return dailyBriefingTips(enriched);
    case "timesheets":
      return timesheetTips(enriched);
    case "cdm":
      return cdmTips(enriched);
    case "inspections":
      return inspectionTips(enriched);
    case "toolbox-reg":
      return toolboxTips(enriched);
    case "snags":
      return snagTips(enriched);
    case "coshh":
      return coshhTips(enriched);
    case "fire":
      return fireTips(enriched);
    case "visitors":
      return visitorTips(enriched);
    case "ppe":
      return ppeTips(enriched);
    case "plant":
      return plantTips(enriched);
    case "training":
      return trainingTips(enriched);
    case "first-aid":
      return firstAidTips(enriched);
    case "incidents":
      return incidentTips(enriched);
    case "incident-actions":
      return incidentActionTips(enriched);
    case "hot-work":
      return hotWorkTips(enriched);
    case "observations":
      return observationTips(enriched);
    case "lone-working":
      return loneWorkingTips(enriched);
    case "asbestos":
      return asbestosTips(enriched);
    case "loto":
      return lotoTips(enriched);
    case "environmental":
      return environmentalTips(enriched);
    case "method-statement":
      return methodStatementTips(enriched);
    case "emergency":
      return emergencyTips(enriched);
    case "riddor":
      return riddorTips(enriched);
    case "legislation":
      return legislationTips(enriched);
    case "ghp-register":
      return ghpTips(enriched);
    case "dynamic-ra":
      return dynamicRaTips(enriched);
    case "hygiene-setup":
    case "fess-setup":
      return foodPharmaSetupTips(enriched);
    case "construction-setup":
      return constructionSetupTips(enriched);
    default:
      return genericRegisterTips(moduleId, enriched);
  }
}

function dailyBriefingTips({ briefings = [], workers = [], projects = [] }) {
  const tips = [];
  const today = todayIsoDate();
  const todayRows = briefings.filter((b) => String(b.date || "").slice(0, 10) === today);

  if (!briefings.length) {
    tips.push({
      id: "first",
      tone: "info",
      text: "Record your first daily briefing — include weather, scope, topics and signed attendance for audit evidence.",
      actionLabel: "New briefing",
      viewId: "daily-briefing",
      action: "create",
    });
    return tips;
  }

  if (!todayRows.length) {
    tips.push({
      id: "today",
      tone: "warn",
      text: "No briefing recorded for today yet — capture hazards and attendance before work starts.",
      actionLabel: "Record today",
      viewId: "daily-briefing",
      action: "create",
    });
  }

  const latestToday = todayRows[0];
  if (latestToday) {
    const present = (latestToday.attendees || []).filter((a) => a.present);
    const unsigned = present.filter((a) => !a.sig).length;
    if (unsigned > 0) {
      tips.push({
        id: "unsigned",
        tone: "warn",
        text: `${unsigned} attendee(s) marked present but not signed on today's briefing — collect signatures on site.`,
      });
    }
  }

  if (workers.length > 0 && briefings.some((b) => !(b.attendees || []).length)) {
    tips.push({
      id: "attendees",
      tone: "info",
      text: "Link workers from People when creating briefings — signatures and roles pre-fill automatically.",
      viewId: "people",
    });
  }

  if (projects.length > 0 && briefings.some((b) => !b.projectId)) {
    tips.push({
      id: "project",
      tone: "info",
      text: "Link briefings to a project so they appear in the project hub and site pack export.",
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: "ok",
      tone: "good",
      text: "Today's briefing trail looks good — use Export PDF for a signed A4 snapshot or print individual records.",
    });
  }

  return tips.slice(0, 3);
}

function timesheetTips({ entries = [], weekKey = "" }) {
  const tips = [];
  const pending = entries.filter((e) => e.weekKey === weekKey && e.status === "pending");
  if (pending.length) {
    tips.push({
      id: "approve",
      tone: "warn",
      text: `${pending.length} timesheet line(s) awaiting approval this week.`,
    });
  }
  if (!entries.length) {
    tips.push({
      id: "start",
      tone: "info",
      text: "Log hours against a project each week — links to project hub totals.",
      actionLabel: "Add entry",
      viewId: "timesheets",
      action: "create",
    });
  }
  return tips;
}

function cdmTips({ packs = [] }) {
  if (!packs.length) {
    return [
      {
        id: "cpp",
        tone: "info",
        text: "Create a CDM pack before work starts — Construction Phase Plan and dutyholder checklist for UK sites.",
        actionLabel: "New CDM pack",
        viewId: "cdm",
        action: "create",
      },
    ];
  }
  const incomplete = packs.filter((p) => {
    const n = Object.values(p.dutyholderChecks || {}).filter(Boolean).length;
    return n < 10;
  });
  if (incomplete.length) {
    return [
      {
        id: "checks",
        tone: "warn",
        text: `${incomplete.length} CDM pack(s) have an incomplete dutyholder checklist — review before site start.`,
        viewId: "cdm",
      },
    ];
  }
  return [{ id: "ok", tone: "good", text: "CDM checklist complete on file." }];
}

function inspectionTips({ items = [] }) {
  if (!items.length) {
    return [
      {
        id: "schedule",
        tone: "info",
        text: "Schedule LOLER, PUWER or weekly site inspections — overdue items show under Needs attention in More.",
        viewId: "inspections",
      },
    ];
  }
  const overdue = items.filter((item) => item?.nextInspectionDate && new Date(item.nextInspectionDate) < new Date());
  if (overdue.length) {
    return [
      {
        id: "overdue",
        tone: "warn",
        text: `${overdue.length} inspection(s) past due — book thorough examination before equipment goes back on site.`,
        viewId: "inspections",
      },
    ];
  }
  const due30 = items.filter((item) => {
    if (!item?.nextInspectionDate) return false;
    const days = Math.ceil((new Date(item.nextInspectionDate) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  });
  if (due30.length) {
    return [
      {
        id: "due30",
        tone: "info",
        text: `${due30.length} inspection(s) due within 30 days — schedule engineer visits early.`,
      },
    ];
  }
  return [{ id: "ok", tone: "good", text: "Inspection register up to date — export PDF for audit packs." }];
}

function toolboxTips({ items = [] }) {
  if (!items.length) {
    return [
      {
        id: "first",
        tone: "info",
        text: "Log toolbox talks here — topic, date, lead and attendees for HSE evidence.",
        viewId: "toolbox-reg",
      },
    ];
  }
  return [];
}

function snagTips({ items = [] }) {
  const open = items.filter((s) => s.status !== "closed" && s.status !== "resolved");
  if (open.length) {
    return [
      {
        id: "open",
        tone: "warn",
        text: `${open.length} open snag(s) — assign priority and close-out dates before handover.`,
        viewId: "snags",
      },
    ];
  }
  return [{ id: "ok", tone: "good", text: "Snag list clear — export CSV or PDF for client handover packs." }];
}

function coshhTips({ items = [] }) {
  if (!items.length) {
    return [{ id: "start", tone: "info", text: "Add substances used on site — include SDS link, PPE and spill procedure for COSHH 2002 compliance.", actionLabel: "Add substance", viewId: "coshh" }];
  }
  const high = items.filter((i) => i.riskLevel === "high").length;
  const noSds = items.filter((i) => !i.sdsUrl?.trim()).length;
  const tips = [];
  if (high) tips.push({ id: "high", tone: "warn", text: `${high} high-risk substance(s) — verify COSHH assessment and storage segregation on site.` });
  if (noSds) tips.push({ id: "sds", tone: "warn", text: `${noSds} substance(s) missing SDS URL — upload or link safety data sheets.` });
  if (!tips.length) tips.push({ id: "ok", tone: "good", text: "COSHH register complete — export PDF from header for site audits." });
  return tips.slice(0, 3);
}

function fireTips({ items = [] }) {
  if (!items.length) {
    return [{ id: "start", tone: "info", text: "Log weekly fire extinguisher checks, alarm tests and emergency lighting — HSE expects a written record.", viewId: "fire" }];
  }
  const bad = items.filter((i) => i.satisfactory === false).length;
  if (bad) return [{ id: "bad", tone: "warn", text: `${bad} check(s) flagged unsatisfactory — raise actions and re-check before next shift.` }];
  return [{ id: "ok", tone: "good", text: "Fire checks on file — keep weekly rhythm and export section PDF from More." }];
}

function visitorTips({ items = [] }) {
  if (!items.length) {
    return [{ id: "start", tone: "info", text: "Sign visitors in and out — induction briefed flag supports CDM contractor coordination.", viewId: "visitors" }];
  }
  const onSite = items.filter((i) => !i.timeOut && !i.signedOutAt).length;
  if (onSite) return [{ id: "onsite", tone: "info", text: `${onSite} visitor(s) may still be on site — confirm sign-out at end of day.` }];
  return [{ id: "ok", tone: "good", text: "Visitor log active — pair with QR induction for faster sign-in." }];
}

function ppeTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Issue PPE to workers and log here — links to People module for names.", viewId: "ppe" }];
  return [{ id: "ok", tone: "good", text: "PPE issue trail on file — re-issue when items are lost or damaged." }];
}

function plantTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Register plant and equipment with next inspection dates — ties to Inspections module for LOLER/PSSR.", viewId: "plant" }];
  return [{ id: "ok", tone: "good", text: "Plant register active — keep asset tags aligned with inspection records." }];
}

function trainingTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Track CSCS, IPAF, asbestos awareness and expiry dates — expired certs show under Needs attention.", viewId: "training" }];
  const expiring = items.filter((i) => {
    const d = i.certExpiry || i.expiryDate;
    if (!d) return false;
    const days = Math.ceil((new Date(d) - new Date()) / 86400000);
    return days >= 0 && days <= 60;
  }).length;
  if (expiring) return [{ id: "exp", tone: "warn", text: `${expiring} certificate(s) expiring within 60 days — book refresher training.` }];
  return [{ id: "ok", tone: "good", text: "Training matrix up to date." }];
}

function firstAidTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "List qualified first aiders and cert expiry — site CPP should name who is on duty.", viewId: "first-aid" }];
  return [{ id: "ok", tone: "good", text: "First aider register on file." }];
}

function incidentTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Report near misses and incidents early — link actions in Incident actions module.", viewId: "incidents" }];
  const open = items.filter((i) => !/closed|resolved/i.test(String(i.status || ""))).length;
  if (open) return [{ id: "open", tone: "warn", text: `${open} open incident(s) — complete investigation and close-out notes.` }];
  return [{ id: "ok", tone: "good", text: "Incident log reviewed — use RIDDOR wizard if reportable criteria met." }];
}

function incidentActionTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Assign corrective actions from incidents, inspections or audits with owners and due dates.", viewId: "incident-actions" }];
  const open = items.filter((i) => !/closed|done|complete/i.test(String(i.status || ""))).length;
  if (open) return [{ id: "open", tone: "warn", text: `${open} action(s) still open — chase owners before client or HSE review.` }];
  return [{ id: "ok", tone: "good", text: "All actions closed." }];
}

function hotWorkTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Log hot work permits alongside PTW — fire watch and extinguishers ready before spark.", viewId: "hot-work" }];
  return [{ id: "ok", tone: "good", text: "Hot work register on file — cross-check active permits in Permits module." }];
}

function observationTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Capture good catches and unsafe acts — positive observations improve culture.", viewId: "observations" }];
  return [{ id: "ok", tone: "good", text: "Safety observations logged." }];
}

function loneWorkingTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Record lone worker check-ins — agree escalation if check-in missed.", viewId: "lone-working" }];
  return [{ id: "ok", tone: "good", text: "Lone working log active." }];
}

function asbestosTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Register known ACM locations before disturbance works — survey ref in CPP.", viewId: "asbestos" }];
  return [{ id: "ok", tone: "good", text: "Asbestos register on file." }];
}

function lotoTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Track isolation locks — one person, one lock, one key for live electrical/mechanical work.", viewId: "loto" }];
  return [{ id: "ok", tone: "good", text: "LOTO register active." }];
}

function environmentalTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Log noise, dust and spill observations — supports environmental permit compliance.", viewId: "environmental" }];
  return [{ id: "ok", tone: "good", text: "Environmental log on file." }];
}

function methodStatementTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Create method statements before high-risk tasks — link to RAMS and project hub.", viewId: "method-statement" }];
  const draft = items.filter((i) => /draft/i.test(String(i.status || ""))).length;
  if (draft) return [{ id: "draft", tone: "warn", text: `${draft} method statement(s) still in draft — issue to site team before work starts.` }];
  return [{ id: "ok", tone: "good", text: "Method statements on file." }];
}

function emergencyTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Add emergency contacts — site manager, first aider, client, out-of-hours.", viewId: "emergency" }];
  return [{ id: "ok", tone: "good", text: "Emergency contacts published — display on site boards and CPP." }];
}

function riddorTips({ items = [] }) {
  if (!items.length) return [{ id: "start", tone: "info", text: "Use RIDDOR wizard when reportable injury, disease or dangerous occurrence criteria met.", viewId: "riddor" }];
  return [{ id: "ok", tone: "good", text: "RIDDOR assessments on file — keep F2508 deadline tracking current." }];
}

function legislationTips({ count = 0 }) {
  if (count === 0) return [{ id: "seed", tone: "info", text: "Load UK HSE + food safety legislation library — one click in the module.", viewId: "legislation", actionLabel: "Open register" }];
  return [{ id: "review", tone: "info", text: "Review applicability and next review dates before client or BRC audit." }];
}

function ghpTips({ count = 0 }) {
  if (count === 0) return [{ id: "start", tone: "warn", text: "Food sites need G&HP register before tools enter production — use Quick start on the tile.", viewId: "ghp-register", actionLabel: "Add entry" }];
  return [{ id: "ok", tone: "good", text: "G&HP register active — log every brittle item brought into high-care." }];
}

function dynamicRaTips({ count = 0 }) {
  if (count === 0) return [{ id: "start", tone: "info", text: "Use Dynamic RA when site conditions change beyond the written RAMS.", viewId: "dynamic-ra", actionLabel: "New DRA" }];
  return [{ id: "ok", tone: "good", text: "Field DRAs on file — link to RAMS for audit traceability." }];
}

function foodPharmaSetupTips() {
  return [{ id: "wizard", tone: "info", text: "Complete food & pharma setup — hazard packs, COSHH, G&HP and client portal in one afternoon.", viewId: "hygiene-setup", actionLabel: "Open wizard" }];
}

function constructionSetupTips() {
  return [{ id: "wizard", tone: "info", text: "Complete construction setup — CDM, RAMS, permits, briefing and client portal in one afternoon.", viewId: "construction-setup", actionLabel: "Open wizard" }];
}

function genericRegisterTips(moduleId, { count = 0, attentionCount = 0 }) {
  if (count === 0) {
    return [
      {
        id: "empty",
        tone: "info",
        text: "No records yet — tap Quick start on this tile for a pre-built template, or seed empty registers in the HSE spotlight.",
      },
    ];
  }
  if (attentionCount > 0) {
    return [
      {
        id: "attention",
        tone: "warn",
        text: `${attentionCount} record(s) need attention — filter Needs attention in More modules to find them quickly.`,
      },
    ];
  }
  return [
    {
      id: "export",
      tone: "good",
      text: "Register active — use Export PDF in the header or download icon on the More tile for an A4 snapshot.",
    },
  ];
}
