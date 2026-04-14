import { useState, useEffect, useMemo, useRef } from "react";
import HAZARD_LIBRARY, { TRADE_CATEGORIES, getByCategory, searchHazards, getRiskLevel } from "./ramsAllHazards";
import {
  RAMS_PRINT_SECTIONS,
  RAMS_SECTION_IDS,
  normalizePrintSections,
  previewAnchorId,
  isSectionIncluded,
} from "./ramsSectionConfig";
import {
  generatePrintHTML,
  computeRamsFingerprint,
  openRamsDocumentWindow,
  openRamsPrintWindow,
  formatOperativeCertsLine,
} from "./ramsPrintHtml";
import { loadEmergencySiteExtras, googleMapsSearchUrl } from "../../utils/emergencySiteExtras";
import { ms } from "../../utils/moduleStyles";
import { safeHttpUrl } from "../../utils/safeUrl";
import PageHero from "../../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";
import { trackEvent } from "../../utils/telemetry";
import { isFeatureEnabled } from "../../utils/featureFlags";
import { pushRecycleBinItem } from "../../utils/recycleBin";

// ─── storage ─────────────────────────────────────────────────────────────────
const RAMS_DRAFT_KEY = "mysafeops_rams_builder_draft";
const RAMS_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RAMS_ORG_ACTIVITIES_KEY = "rams_org_activity_templates";
const RAMS_HAZARD_PREFS_KEY = "rams_hazard_picker_prefs";
const RAMS_HAZARD_PACKS_KEY = "rams_hazard_quick_packs";
const ORG_ACTIVITY_CATEGORY = "Organisation RAMS";
const HAZARD_PACK_STATUS = {
  CURRENT: "current",
  SUPERSEDED: "superseded",
};

const genId = () => `rams_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const riskScore = (risk) => Number(risk?.L || 0) * Number(risk?.S || 0);
const RISK_AXIS = [2, 4, 6];
const RAMS_STATUS_OPTIONS = ["draft", "internal_review", "approved", "issued"];

function currentYearToken() {
  return new Date().getFullYear();
}

function generateRamsDocNo() {
  const yr = currentYearToken();
  const tail = Date.now().toString().slice(-5);
  return `RAMS-${yr}-${tail}`;
}

function buildRiskMatrixCounts(rows, key = "revisedRisk") {
  const map = {};
  RISK_AXIS.forEach((l) => {
    RISK_AXIS.forEach((s) => {
      map[`${l}x${s}`] = 0;
    });
  });
  (rows || []).forEach((r) => {
    const rk = r?.[key];
    const l = Number(rk?.L);
    const s = Number(rk?.S);
    const k = `${l}x${s}`;
    if (Object.prototype.hasOwnProperty.call(map, k)) map[k] += 1;
  });
  return map;
}

function computeRamsReadiness(rows, operativesCount) {
  const total = (rows || []).length;
  if (total === 0) return { score: 0, grade: "N/A", summary: "No risk rows selected yet." };
  const highResidual = rows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
  const controlsCoverage =
    rows.filter((r) => Array.isArray(r.controlMeasures) && r.controlMeasures.filter(Boolean).length > 0).length / total;
  const reductionAvg =
    rows.reduce((acc, r) => {
      const before = Math.max(1, riskScore(r.initialRisk));
      const after = Math.max(0, riskScore(r.revisedRisk));
      return acc + Math.max(0, ((before - after) / before) * 100);
    }, 0) / total;
  let score = 52;
  score += Math.round(controlsCoverage * 26);
  score += Math.round(Math.min(22, reductionAvg * 0.32));
  score -= highResidual * 7;
  if (operativesCount > 0) score += 4;
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 86 ? "A" : score >= 72 ? "B" : score >= 58 ? "C" : score >= 42 ? "D" : "E";
  const summary =
    highResidual > 0
      ? `Residual HIGH rows: ${highResidual}. Add/strengthen controls before issue.`
      : `Residual high risk cleared. Keep controls and signatures aligned to task steps.`;
  return { score, grade, summary };
}

function buildQaChecklist(form, rows, operativesCount) {
  const hasRows = (rows || []).length > 0;
  const controlsCoverage = hasRows
    ? rows.every((r) => Array.isArray(r.controlMeasures) && r.controlMeasures.filter(Boolean).length > 0)
    : false;
  const noHighResidual = hasRows ? rows.every((r) => getRiskLevel(r.revisedRisk) !== "high") : false;
  const needsApproval = ["approved", "issued"].includes(String(form.documentStatus || ""));
  return [
    { label: "Header complete (title, location, document no.)", ok: !!(form.title?.trim() && form.location?.trim() && form.documentNo?.trim()) },
    { label: "At least one risk row selected", ok: hasRows },
    { label: "Every risk row has control measures", ok: controlsCoverage },
    { label: "No residual HIGH risks", ok: noHighResidual },
    { label: "Operatives assigned for briefing/sign-off", ok: operativesCount > 0 },
    {
      label: "Approval fields complete for approved/issued status",
      ok: !needsApproval || (!!form.approvedBy?.trim() && !!String(form.approvalDate || "").trim()),
    },
    ...buildStrictQaChecks(form, rows),
  ];
}

function buildStrictQaChecks(form, rows) {
  if (!form?.strictMode) return [];
  const list = rows || [];
  const minControls = Math.max(1, Number(form.strictMinControls) || 3);
  const detailed = buildDetailedControlMethodPack(list);
  const rowsWithMinControls = list.every(
    (r) => ((r.controlMeasures || []).map((x) => String(x || "").trim()).filter(Boolean).length >= minControls)
  );
  const roleCoverage = detailed.every(
    (d) => (d.roleAssignments?.supervisor || []).length > 0 && (d.roleAssignments?.operative || []).length > 0
  );
  const phaseCoverage = detailed.every(
    (d) =>
      (d.phaseControls?.preStart || []).length > 0 &&
      (d.phaseControls?.during || []).length > 0 &&
      (d.phaseControls?.closeOut || []).length > 0
  );
  const holdPointsCoverage = detailed.every((d) => (d.holdPoints || []).length >= 3);
  const contextAligned = list.every((r) => {
    const text = `${r?.activity || ""} ${r?.hazard || ""}`.toLowerCase();
    const controls = (r?.controlMeasures || []).join(" ").toLowerCase();
    const rules = [
      { need: ["electrical", "live cable", "switchgear"], expect: ["isolation", "loto", "insulated", "test-before-touch"] },
      { need: ["utility", "excav", "dig", "buried"], expect: ["permit-to-dig", "scan", "mark", "utility"] },
      { need: ["height", "ladder", "roof", "mewp"], expect: ["harness", "guardrail", "anchor", "rescue"] },
      { need: ["traffic", "vehicle", "plant"], expect: ["banksman", "segregated", "traffic", "exclusion"] },
      { need: ["confined", "gas", "fume"], expect: ["atmosphere", "monitor", "rescue", "confined"] },
    ];
    for (const rule of rules) {
      if (textHasAny(text, rule.need)) return textHasAny(controls, rule.expect);
    }
    return true;
  });
  return [
    { label: `Strict mode: each row has at least ${minControls} control measures`, ok: rowsWithMinControls },
    { label: "Strict mode: controls include role ownership (supervisor + operative)", ok: roleCoverage },
    { label: "Strict mode: phase checkpoints are defined (pre-start / during / close-out)", ok: phaseCoverage },
    { label: "Strict mode: context-aligned controls are present for specialist hazards", ok: contextAligned },
    {
      label: "Strict mode: hold points defined for each row",
      ok: !form?.strictRequireHoldPoints || holdPointsCoverage,
    },
  ];
}

function getCertificationExpiryState(expiryDateIso) {
  if (!expiryDateIso) return { state: "unknown", days: null };
  const now = new Date();
  const exp = new Date(expiryDateIso);
  if (Number.isNaN(exp.getTime())) return { state: "unknown", days: null };
  const days = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { state: "expired", days };
  if (days <= 30) return { state: "due", days };
  return { state: "ok", days };
}

function buildCategoryRiskTrend(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    const key = String(r.category || "Uncategorised");
    if (!map.has(key)) {
      map.set(key, { category: key, count: 0, initialAvg: 0, residualAvg: 0, reductionAvg: 0 });
    }
    const rec = map.get(key);
    rec.count += 1;
    rec.initialAvg += riskScore(r.initialRisk);
    rec.residualAvg += riskScore(r.revisedRisk);
  });
  return Array.from(map.values())
    .map((x) => {
      const initialAvg = x.count ? x.initialAvg / x.count : 0;
      const residualAvg = x.count ? x.residualAvg / x.count : 0;
      const reductionAvg = initialAvg > 0 ? Math.max(0, ((initialAvg - residualAvg) / initialAvg) * 100) : 0;
      return {
        category: x.category,
        count: x.count,
        initialAvg: Number(initialAvg.toFixed(1)),
        residualAvg: Number(residualAvg.toFixed(1)),
        reductionAvg: Math.round(reductionAvg),
      };
    })
    .sort((a, b) => b.initialAvg - a.initialAvg)
    .slice(0, 8);
}

function textHasAny(text, needles) {
  const t = String(text || "").toLowerCase();
  return (needles || []).some((n) => t.includes(String(n).toLowerCase()));
}

function normalizeLooseTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function workerCompetencyLines(worker) {
  if (!worker) return [];
  const lines = [];
  if (String(worker.certs || "").trim()) lines.push(...String(worker.certs).split(/\n|,|;/).map((x) => x.trim()).filter(Boolean));
  (worker.certifications || []).forEach((c) => {
    const label = String(c?.certType || "").trim();
    if (label) lines.push(label);
  });
  return Array.from(new Set(lines));
}

function competencyMatch(requiredCert, workerLine) {
  const required = normalizeLooseTokens(requiredCert);
  const candidate = normalizeLooseTokens(workerLine);
  if (!required || !candidate) return false;
  return required.includes(candidate) || candidate.includes(required);
}

function buildCompetencyRequirementCheck(requiredCerts, selectedWorkers) {
  const reqs = Array.from(
    new Set((requiredCerts || []).map((x) => String(x || "").trim()).filter(Boolean))
  );
  if (reqs.length === 0) {
    return {
      required: [],
      missing: [],
      matched: [],
      blocked: false,
    };
  }
  const workers = Array.isArray(selectedWorkers) ? selectedWorkers : [];
  const byRequirement = reqs.map((req) => {
    const matchedWorkers = [];
    const expiredWorkers = [];
    workers.forEach((w) => {
      const lines = workerCompetencyLines(w);
      const matchedFromLines = lines.some((ln) => competencyMatch(req, ln));
      const matchedCert = (w.certifications || []).find((c) => competencyMatch(req, c?.certType || ""));
      if (matchedFromLines || matchedCert) {
        const expiry = getCertificationExpiryState(matchedCert?.expiryDate);
        if (matchedCert && expiry.state === "expired") {
          expiredWorkers.push(w.name || w.id || "Operative");
          return;
        }
        matchedWorkers.push(w.name || w.id || "Operative");
      }
    });
    return {
      requirement: req,
      matchedWorkers: Array.from(new Set(matchedWorkers)),
      expiredWorkers: Array.from(new Set(expiredWorkers)),
    };
  });
  const missing = byRequirement.filter((x) => x.matchedWorkers.length === 0);
  return {
    required: reqs,
    matched: byRequirement.filter((x) => x.matchedWorkers.length > 0),
    missing,
    blocked: missing.length > 0,
  };
}

function buildToolboxBriefV2(rows, form) {
  const list = Array.isArray(rows) ? rows : [];
  const highRows = list.filter((r) => getRiskLevel(r.revisedRisk) === "high");
  const sorted = [...list].sort((a, b) => riskScore(b.revisedRisk) - riskScore(a.revisedRisk));
  const topRisks = sorted.slice(0, 6).map((r, idx) => ({
    id: r.id || `tb_${idx}`,
    activity: r.activity || "Activity",
    hazard: r.hazard || "Hazard",
    rf: riskScore(r.revisedRisk),
    controls: (r.controlMeasures || []).filter(Boolean).slice(0, 2),
  }));
  const hazardText = sorted.map((r) => `${r.activity || ""} ${r.hazard || ""}`).join(" ").toLowerCase();
  const mustBriefPoints = [
    `Stop-work authority: ${form?.leadEngineer || "Set lead engineer in Document info"}.`,
    "Confirm permits and interface controls before first task starts.",
    "Confirm emergency route, muster arrangement, and escalation path.",
  ];
  if (textHasAny(hazardText, ["electrical", "live cable", "switchgear"])) {
    mustBriefPoints.push("Electrical isolation and test-before-touch confirmation is mandatory.");
  }
  if (textHasAny(hazardText, ["excav", "buried", "utility", "dig"])) {
    mustBriefPoints.push("Utility strike controls and permit-to-dig boundaries must be briefed.");
  }
  if (textHasAny(hazardText, ["height", "ladder", "roof", "mewp"])) {
    mustBriefPoints.push("Work-at-height rescue readiness and anchor checks must be confirmed.");
  }
  if (textHasAny(hazardText, ["confined", "gas", "fume"])) {
    mustBriefPoints.push("Atmosphere monitoring and rescue standby controls must be active.");
  }
  if (highRows.length > 0) {
    mustBriefPoints.push(`Residual HIGH risk remains on ${highRows.length} row(s): escalate before start.`);
  }
  return {
    topRisks,
    mustBriefPoints: mustBriefPoints.slice(0, 8),
    headline: `${list.length} risk row(s) · ${highRows.length} high residual · brief top ${Math.min(6, topRisks.length)} priority task(s).`,
  };
}

function buildPackVersionDiff(previousTemplates, nextTemplates) {
  const prev = Array.isArray(previousTemplates) ? previousTemplates : [];
  const next = Array.isArray(nextTemplates) ? nextTemplates : [];
  const keyFor = (tpl, idx) => String(tpl?.templateId || `idx_${idx}`);
  const prevMap = new Map(prev.map((tpl, idx) => [keyFor(tpl, idx), tpl]));
  const nextMap = new Map(next.map((tpl, idx) => [keyFor(tpl, idx), tpl]));
  const added = [];
  const removed = [];
  const changed = [];
  nextMap.forEach((tpl, key) => {
    if (!prevMap.has(key)) {
      added.push(tpl);
      return;
    }
    const prevTpl = prevMap.get(key);
    const beforeControls = (prevTpl?.controlMeasures || []).map((x) => String(x || "").trim()).filter(Boolean);
    const afterControls = (tpl?.controlMeasures || []).map((x) => String(x || "").trim()).filter(Boolean);
    const controlsAdded = afterControls.filter((x) => !beforeControls.includes(x));
    const controlsRemoved = beforeControls.filter((x) => !afterControls.includes(x));
    const risksChanged =
      Number(prevTpl?.initialRisk?.RF || 0) !== Number(tpl?.initialRisk?.RF || 0) ||
      Number(prevTpl?.revisedRisk?.RF || 0) !== Number(tpl?.revisedRisk?.RF || 0);
    const textChanged =
      String(prevTpl?.activity || "") !== String(tpl?.activity || "") ||
      String(prevTpl?.hazard || "") !== String(tpl?.hazard || "");
    if (controlsAdded.length || controlsRemoved.length || risksChanged || textChanged) {
      changed.push({
        key,
        activity: tpl?.activity || prevTpl?.activity || "Activity",
        controlsAdded,
        controlsRemoved,
        risksChanged,
        textChanged,
      });
    }
  });
  prevMap.forEach((tpl, key) => {
    if (!nextMap.has(key)) removed.push(tpl);
  });
  return {
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    changedRows: changed.slice(0, 8),
  };
}

function buildDetailedControlMethodPack(rows) {
  const classifyControls = (controls) => {
    const byType = { eliminate: [], substitute: [], engineering: [], admin: [], ppe: [] };
    (controls || []).forEach((cm) => {
      const line = String(cm || "").trim();
      if (!line) return;
      const lc = line.toLowerCase();
      if (textHasAny(lc, ["remove", "eliminate", "avoid", "do not enter", "relocate"])) byType.eliminate.push(line);
      else if (textHasAny(lc, ["substitute", "alternative", "lower voltage", "non-conductive"])) byType.substitute.push(line);
      else if (textHasAny(lc, ["barrier", "guard", "edge protection", "isolate", "interlock", "physical"])) byType.engineering.push(line);
      else if (textHasAny(lc, ["permit", "brief", "briefing", "training", "supervision", "method", "signage", "exclusion"])) byType.admin.push(line);
      else if (textHasAny(lc, ["ppe", "helmet", "gloves", "respirator", "eye protection", "hi-vis", "harness"])) byType.ppe.push(line);
      else byType.admin.push(line);
    });
    return byType;
  };

  const permitDependenciesFor = (text) => {
    const list = [];
    if (textHasAny(text, ["hot work", "welding", "cutting", "grinding"])) list.push("Hot works permit");
    if (textHasAny(text, ["excav", "dig", "trench", "buried utility"])) list.push("Excavation / permit-to-dig");
    if (textHasAny(text, ["confined space", "tank", "chamber", "manhole"])) list.push("Confined space permit");
    if (textHasAny(text, ["height", "ladder", "roof", "scaffold", "mewp"])) list.push("Work at height permit");
    if (textHasAny(text, ["electrical", "live cable", "switchgear"])) list.push("Electrical isolation / LOTO permit");
    if (textHasAny(text, ["lifting", "crane", "hoist"])) list.push("Lifting plan / lifting permit");
    if (textHasAny(text, ["road", "traffic", "carriageway"])) list.push("Traffic management approval");
    return list.length ? list : ["Check project permit interface before task start"];
  };

  const stopWorkFor = (text, residualRisk) => {
    const list = [
      "Stop immediately if controls cannot be implemented as written.",
      "Stop if weather/visibility conditions make the task unsafe.",
      "Stop if unauthorized persons enter the exclusion zone.",
    ];
    if (textHasAny(text, ["electrical", "live cable", "utility"])) list.push("Stop on any sign of uncharted/live service exposure.");
    if (textHasAny(text, ["height", "ladder", "roof", "mewp"])) list.push("Stop if fall prevention systems are missing or damaged.");
    if (textHasAny(text, ["confined", "gas", "fume"])) list.push("Stop if atmospheric test fails or monitor alarms.");
    if (getRiskLevel(residualRisk) === "high") list.push("Escalate to RAMS approver before work resumes (residual HIGH).");
    return list.slice(0, 5);
  };

  const emergencyFor = (text) => {
    const list = ["Raise alarm, make area safe, and contact site emergency coordinator."];
    if (textHasAny(text, ["electrical"])) list.push("Isolate supply only if trained and safe; do not touch casualty on live contact.");
    if (textHasAny(text, ["chemical", "fume", "spill"])) list.push("Use spill kit/containment and follow SDS first-aid route.");
    if (textHasAny(text, ["traffic", "vehicle"])) list.push("Secure route and apply traffic incident protocol before recovery.");
    if (textHasAny(text, ["height", "fall"])) list.push("Implement rescue plan immediately; do not delay suspended person recovery.");
    return list.slice(0, 4);
  };

  const envControlsFor = (text) => {
    const list = ["Prevent debris/waste escape; keep housekeeping standard throughout task."];
    if (textHasAny(text, ["spill", "fuel", "oil", "chemical"])) list.push("Use drip trays and spill response kit at point of work.");
    if (textHasAny(text, ["dust", "cutting", "grinding"])) list.push("Apply dust suppression and local extraction where possible.");
    if (textHasAny(text, ["noise", "breaker", "hammer"])) list.push("Set noise controls and local time-window restrictions.");
    return list.slice(0, 3);
  };

  const roleAssignmentsFor = (text, controlTree) => {
    const supervisor = [
      "Confirm permit dependencies and toolbox talk before start.",
      "Verify controls are active at each phase gate.",
    ];
    const operative = [
      "Follow step sequence and control measures exactly as briefed.",
      "Use required PPE and report deviations immediately.",
    ];
    const banksman = [];
    if (textHasAny(text, ["traffic", "vehicle", "plant", "lifting", "crane"])) {
      banksman.push("Manage exclusion zone and movement signals for plant/vehicles.");
    }
    if (textHasAny(text, ["utility", "excav", "dig", "buried"])) {
      supervisor.push("Re-confirm utility location and permit-to-dig boundaries before intrusive works.");
    }
    if ((controlTree.engineering || []).length > 0) {
      operative.push("Do not bypass barriers/guards/isolation controls.");
    }
    return { supervisor, operative, banksman };
  };

  const phaseControlsFor = (text) => {
    const preStart = [
      "RAMS briefing complete, permits valid, and emergency arrangements confirmed.",
      "Task area inspected and exclusion/barricade layout set.",
    ];
    const during = [
      "Maintain supervision and dynamic risk checks during task changes.",
      "Re-check controls after any interruption, weather shift, or interface conflict.",
    ];
    const closeOut = [
      "Confirm task complete, area left safe, and residual hazards communicated.",
      "Capture lessons learned / changes for next revision.",
    ];
    if (textHasAny(text, ["electrical"])) preStart.push("Verify isolation state and test-before-touch protocol.");
    if (textHasAny(text, ["confined", "gas", "fume"])) during.push("Maintain atmosphere monitoring and rescue readiness.");
    return { preStart: preStart.slice(0, 3), during: during.slice(0, 3), closeOut: closeOut.slice(0, 3) };
  };

  const holdPointsFor = (text) => {
    const list = [
      "HP1: Pre-start authorization complete (briefing + permit + controls).",
      "HP2: First-task verification completed by supervisor.",
    ];
    if (textHasAny(text, ["excav", "utility", "buried"])) list.push("HP3: Utility strike avoidance checks complete before breaking ground.");
    if (textHasAny(text, ["height", "mewp", "scaffold", "ladder"])) list.push("HP3: Work-at-height rescue and anchor checks complete before access.");
    if (textHasAny(text, ["lifting", "crane"])) list.push("HP3: Lift plan and communication test completed before first lift.");
    list.push("HP4: Close-out handover complete and remaining risk briefed.");
    return list.slice(0, 5);
  };

  return (rows || []).map((r, idx) => {
    const controls = (r.controlMeasures || []).filter(Boolean);
    const controlTree = classifyControls(controls);
    const text = `${r.activity || ""} ${r.hazard || ""}`;
    const residual = riskScore(r.revisedRisk);
    return {
      id: r.id || `row_${idx}`,
      stepNo: idx + 1,
      title: r.activity || "Activity",
      hazard: r.hazard || "Hazard not specified",
      initial: riskScore(r.initialRisk),
      residual,
      reductionPct: Math.max(0, Math.round(((Math.max(1, riskScore(r.initialRisk)) - residual) / Math.max(1, riskScore(r.initialRisk))) * 100)),
      controlTree,
      permitDeps: permitDependenciesFor(text),
      verifyChecks: [
        "Pre-start briefing delivered and understood.",
        "Controls physically in place before work starts.",
        "Supervisor check completed at start and after any change.",
      ],
      stopWork: stopWorkFor(text, r.revisedRisk),
      emergency: emergencyFor(text),
      environmental: envControlsFor(text),
      roleAssignments: roleAssignmentsFor(text, controlTree),
      phaseControls: phaseControlsFor(text),
      holdPoints: holdPointsFor(text),
      ppe: (r.ppeRequired || []).filter(Boolean),
    };
  });
}

function buildControlAssuranceSummary(detailedPack) {
  const list = detailedPack || [];
  const uniquePermits = new Set(list.flatMap((x) => x.permitDeps || []));
  const totalHoldPoints = list.reduce((a, x) => a + (x.holdPoints || []).length, 0);
  const totalStopWork = list.reduce((a, x) => a + (x.stopWork || []).length, 0);
  const highResidualSteps = list.filter((x) => Number(x.residual || 0) >= 12).length;
  const avgReduction = list.length
    ? Math.round(list.reduce((a, x) => a + Number(x.reductionPct || 0), 0) / list.length)
    : 0;
  const criticalSteps = [...list]
    .filter((x) => Number(x.residual || 0) >= 12 || Number(x.reductionPct || 0) < 35)
    .sort((a, b) => Number(b.residual || 0) - Number(a.residual || 0))
    .slice(0, 5);
  const timeline = {
    preStart: Array.from(new Set(list.flatMap((x) => x.phaseControls?.preStart || []))).slice(0, 6),
    during: Array.from(new Set(list.flatMap((x) => x.phaseControls?.during || []))).slice(0, 6),
    closeOut: Array.from(new Set(list.flatMap((x) => x.phaseControls?.closeOut || []))).slice(0, 6),
  };
  return {
    steps: list.length,
    uniquePermits: uniquePermits.size,
    totalHoldPoints,
    totalStopWork,
    highResidualSteps,
    avgReduction,
    criticalSteps,
    timeline,
  };
}

function buildTailoredControlsForRow(row) {
  const text = `${row?.category || ""} ${row?.activity || ""} ${row?.hazard || ""}`.toLowerCase();
  const rf = riskScore(row?.revisedRisk);
  const out = [];
  const add = (line) => {
    const v = String(line || "").trim();
    if (!v) return;
    if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  };

  add("Deliver pre-start briefing covering task sequence, hazards, and stop-work authority.");
  add("Set and maintain exclusion zone with clear signage and controlled access.");
  add("Supervisor verifies controls before start and after any change in task conditions.");

  if (textHasAny(text, ["utility", "buried", "excav", "dig", "trench"])) {
    add("Confirm latest utility records and scan/mark services before any intrusive activity.");
    add("Use permit-to-dig controls and insulated tools near identified service corridors.");
  }
  if (textHasAny(text, ["electrical", "live cable", "switchgear", "distribution"])) {
    add("Apply isolation/LOTO procedure and test-before-touch prior to work.");
    add("Maintain non-conductive access equipment and insulated hand tools.");
  }
  if (textHasAny(text, ["height", "ladder", "roof", "scaffold", "mewp"])) {
    add("Use inspected access system and fall prevention (guardrail/harness) before exposure.");
    add("Confirm rescue arrangements and anchor points before work at height begins.");
  }
  if (textHasAny(text, ["traffic", "vehicle", "plant", "road", "carriageway"])) {
    add("Implement traffic management plan with trained banksman and segregated pedestrian routes.");
    add("Use agreed communication signals and hold points for plant/vehicle movements.");
  }
  if (textHasAny(text, ["confined", "tank", "manhole", "chamber", "gas", "fume"])) {
    add("Operate confined-space permit controls with atmosphere testing and continuous monitoring.");
    add("Maintain emergency retrieval and standby rescue cover during entry operations.");
  }
  if (textHasAny(text, ["lifting", "crane", "hoist", "sling"])) {
    add("Execute lifting plan with competent lifting team, inspected accessories, and exclusion zone.");
    add("Conduct pre-lift briefing and trial communication check before first lift.");
  }
  if (textHasAny(text, ["hot work", "welding", "grinding", "cutting"])) {
    add("Issue hot-work permit and remove/cover combustibles within the spark zone.");
    add("Provide fire watch and suitable extinguishers throughout and after hot works.");
  }
  if (textHasAny(text, ["chemical", "spill", "fuel", "oil", "coshh"])) {
    add("Follow COSHH/SDS controls, including handling limits, ventilation, and exposure protection.");
    add("Stage spill kit and containment materials at point of work before task start.");
  }

  if (rf >= 12) {
    add("Introduce additional hold-point: supervisor approval required before continuing high residual activity.");
    add("Repeat dynamic risk assessment at each phase transition and document control confirmation.");
  } else if (rf >= 6) {
    add("Perform midpoint supervision check and confirm controls remain effective.");
  }

  const ppe = (row?.ppeRequired || []).filter(Boolean);
  if (ppe.length > 0) {
    add(`Mandatory PPE: ${ppe.join(", ")}.`);
  } else {
    add("Mandatory PPE as per RAMS and site rules; verify suitability before task start.");
  }
  return out.slice(0, 12);
}

function mergeTailoredControls(existingControls, tailoredControls) {
  const merged = (existingControls || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const seen = new Set(merged.map((x) => x.toLowerCase()));
  (tailoredControls || []).forEach((line) => {
    const v = String(line || "").trim();
    if (!v) return;
    const k = v.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(v);
    }
  });
  return merged;
}

function appendSignatureEvent(existing, event, dedupeMatch) {
  const list = Array.isArray(existing) ? existing : [];
  if (typeof dedupeMatch === "function" && list.some(dedupeMatch)) return list;
  return [
    ...list,
    {
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...event,
    },
  ].slice(-40);
}

function bumpRevisionCode(currentRevision = "1A") {
  const raw = String(currentRevision || "").trim().toUpperCase();
  const m = /^(\d+)([A-Z])$/.exec(raw);
  if (!m) return "1A";
  const num = Number(m[1]);
  const ch = m[2].charCodeAt(0);
  if (ch < 90) return `${num}${String.fromCharCode(ch + 1)}`;
  return `${num + 1}A`;
}

function buildChangeSummary(previousDoc, form, rows) {
  if (!previousDoc) return "";
  const prevRows = Array.isArray(previousDoc.rows) ? previousDoc.rows : [];
  const changes = [];

  if ((form.title || "").trim() !== (previousDoc.title || "").trim()) changes.push("title updated");
  if ((form.location || "").trim() !== (previousDoc.location || "").trim()) changes.push("location updated");
  if (String(form.documentStatus || form.status || "") !== String(previousDoc.documentStatus || previousDoc.status || "")) {
    changes.push(`status ${String(previousDoc.documentStatus || previousDoc.status || "draft").replace(/_/g, " ")} -> ${String(form.documentStatus || form.status || "draft").replace(/_/g, " ")}`);
  }
  if ((rows || []).length !== prevRows.length) {
    changes.push(`risk rows ${prevRows.length} -> ${(rows || []).length}`);
  }
  const prevHigh = prevRows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
  const nextHigh = (rows || []).filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
  if (prevHigh !== nextHigh) changes.push(`residual high ${prevHigh} -> ${nextHigh}`);
  if ((form.scope || "").trim() !== (previousDoc.scope || "").trim()) changes.push("scope revised");
  if ((form.surveyWorkType || "").trim() !== (previousDoc.surveyWorkType || "").trim()) changes.push("survey work type updated");
  if ((form.communicationPlan || "").trim() !== (previousDoc.communicationPlan || "").trim()) changes.push("communication controls revised");

  return changes.length ? changes.join(" | ") : "editorial updates";
}

function normalisePersonKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** All tokens (length ≥2) must appear in worker name — avoids matching on a single common word. */
function looseNameMatch(tokens, workerName) {
  const wn = normalisePersonKey(workerName);
  return tokens.every((t) => wn.includes(t));
}

/** On JSON import: keep operative id if local; else match by email, exact name, or multi-token name (export metadata or id string). */
function remapOperativeIds(oldIds, operativeNames, workersList) {
  if (!Array.isArray(oldIds) || oldIds.length === 0) return [];
  const wl = workersList || [];
  return oldIds.map((id, i) => {
    if (wl.some((w) => w.id === id)) return id;
    const idStr = String(id ?? "").trim();
    if (idStr.includes("@")) {
      const em = idStr.toLowerCase();
      const byEmail = wl.find((w) => normalisePersonKey(w.email) === em);
      if (byEmail) return byEmail.id;
    }
    const nm = Array.isArray(operativeNames) ? operativeNames[i] : undefined;
    if (nm && typeof nm === "string" && nm.trim()) {
      const t = nm.trim();
      const tl = t.toLowerCase();
      if (t.includes("@")) {
        const byEmail = wl.find((w) => normalisePersonKey(w.email) === tl);
        if (byEmail) return byEmail.id;
      }
      const exact = wl.find((w) => normalisePersonKey(w.name) === normalisePersonKey(t));
      if (exact) return exact.id;
      const parts = tl.split(/\s+/).filter((x) => x.length >= 2);
      if (parts.length >= 2) {
        const loose = wl.find((w) => looseNameMatch(parts, w.name));
        if (loose) return loose.id;
      }
    }
    return id;
  });
}

const ss = {
  ...ms,
  btnO: {
    ...ms.btn,
    padding: "10px 16px",
    borderRadius: "var(--radius-sm, 8px)",
    border: "1px solid #c2410c",
    background: "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "DM Sans,sans-serif",
    minHeight: 44,
    lineHeight: 1.3,
    boxShadow: "0 2px 8px rgba(234, 88, 12, 0.35)",
  },
  ta: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--color-border-secondary,#cbd5e1)",
    borderRadius: "var(--radius-sm, 8px)",
    fontSize: 13,
    background: "var(--color-background-primary,#fff)",
    color: "var(--color-text-primary)",
    fontFamily: "DM Sans,sans-serif",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 60,
    lineHeight: 1.5,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
};

const RAMS_FORM_DEFAULTS = {
  siteWeatherNote: "",
  siteMapUrl: "",
  siteLat: "",
  siteLng: "",
  nearestHospital: "",
  hospitalDirectionsUrl: "",
  approvedBy: "",
  approvalDate: "",
  revisionSummary: "",
  surveyWorkType: "",
  surveyWorkTypeLabel: "",
  surveyMethodStatement: "",
  surveyDeliverables: "",
  surveyAssumptions: "",
  surveyRequiredPermits: [],
  surveyRequiredCerts: [],
  surveyEvidenceSet: [],
  surveyHoldPoints: [],
  communicationPlan: "",
  handoverClientName: "",
  handoverReceiver: "",
  handoverDate: "",
  handoverNotes: "",
  documentNo: "",
  documentStatus: "draft",
  issueDate: "",
  strictMode: false,
  strictMinControls: 3,
  strictRequireHoldPoints: true,
  signatureEvents: [],
  printSections: {},
};

const RL = {
  high:   { bg:"#FCEBEB", color:"#791F1F" },
  medium: { bg:"#FAEEDA", color:"#633806" },
  low:    { bg:"#EAF3DE", color:"#27500A" },
};

const SURVEYING_PACKS = [
  {
    key: "utility_mapping_survey",
    label: "PAS128 utility mapping survey",
    scope:
      "PAS128 QLB utility mapping survey to locate and record underground utility apparatus, reduce strike risk, and issue marked outputs for safe delivery.",
    method:
      "1. Pre-start briefing and permit checks before entering survey area.\n\n2. Confirm utility records, walkover hazards, and exclusion zones.\n\n3. Detect utilities using EML and GPR methods with competent operators.\n\n4. Mark detected services and maintain safe dig rules near marked lines.\n\n5. Record survey control and quality checks before issue.\n\n6. Communicate residual risk and handover notes to site management.",
    hazardTokens: ["utility", "buried", "open chamber", "manhole", "pedestrian", "traffic", "electrical", "slips", "trip", "manual"],
  },
  {
    key: "topographical_survey",
    label: "Topographical land survey",
    scope: "Topographical survey to capture levels, boundaries, structures and site features with agreed survey control and QA checks.",
    method:
      "1. Set control points and verify datum/benchmark before data capture.\n\n2. Establish safe working routes around plant movement and public interfaces.\n\n3. Capture topo features with calibrated survey equipment.\n\n4. Perform repeat checks and closure checks to validate accuracy.\n\n5. Securely store field data and produce checked outputs for issue.",
    hazardTokens: ["uneven ground", "slips", "trip", "adverse weather", "moving plant", "lone working", "work at height", "manual handling"],
  },
  {
    key: "gpr_survey",
    label: "GPR / multi-array survey",
    scope:
      "GPR survey for utility and subsurface detection, with controlled site setup, verified calibration and clear communication of confidence/residual uncertainty.",
    method:
      "1. Complete pre-start checks, environmental checks and calibration of GPR equipment.\n\n2. Define scan grid and segregate work area from traffic/pedestrian routes.\n\n3. Conduct scan passes at agreed spacing and speed.\n\n4. Validate anomalies with additional passes and cross-check with records.\n\n5. Mark findings and issue interpretation notes including confidence limits.",
    hazardTokens: ["traffic", "pedestrian", "moving plant", "electrical", "buried services", "slips", "trip", "adverse weather"],
  },
  {
    key: "cctv_drainage_survey",
    label: "CCTV drainage survey",
    scope: "Drainage CCTV survey with controlled access at chambers, traffic interface controls, and contamination prevention.",
    method:
      "1. Confirm permit interfaces and confined-space boundary before chamber opening.\n\n2. Inspect chamber condition and barriers before camera insertion.\n\n3. Run CCTV capture with tether and communication controls.\n\n4. Log defects, obstructions, and chainage in survey output.\n\n5. Reinstate chamber and complete close-out checks.",
    hazardTokens: ["cctv", "manhole", "chamber", "confined", "traffic", "slips", "contamination"],
  },
  {
    key: "jetting_hpwj",
    label: "Jetting / HPWJ cleansing",
    scope: "High-pressure water jetting with pressure controls, hose management, exclusion zones, and contamination controls.",
    method:
      "1. Verify competency, equipment checks, and pressure settings.\n\n2. Set exclusion and splash-control zone.\n\n3. Confirm chamber stability and safe nozzle insertion.\n\n4. Perform jetting in controlled passes with comms between operators.\n\n5. Complete pressure release, clean-up, and evidence notes.",
    hazardTokens: ["jetting", "hpwj", "hose", "pressure", "chamber", "traffic", "contamination", "manhole"],
  },
  {
    key: "manhole_entry_inspection",
    label: "Manhole entry & inspection",
    scope: "Confined-space manhole inspection with gas testing, rescue readiness, standby role, and entry controls.",
    method:
      "1. Confirm confined-space permit and rescue plan.\n\n2. Conduct atmospheric pre-test and setup continuous monitor.\n\n3. Brief entrant and standby with emergency comms.\n\n4. Execute controlled entry and inspection tasks.\n\n5. Close permit and capture findings + atmosphere logs.",
    hazardTokens: ["manhole", "chamber", "confined", "gas", "rescue", "atmosphere", "entry"],
  },
  {
    key: "trial_holes_slit_trenches",
    label: "Trial holes / slit trenches",
    scope: "Intrusive verification by trial holes and slit trenches with permit-to-dig and buried-service controls.",
    method:
      "1. Verify records, scan proof, and permit-to-dig authorization.\n\n2. Mark out tolerance zones and no-go lines.\n\n3. Hand-dig or vacuum-expose inside tolerance zones.\n\n4. Record exposed assets with photo evidence.\n\n5. Reinstate and close out with handover notes.",
    hazardTokens: ["trial hole", "slit trench", "excavation", "dig", "utility", "buried", "permit-to-dig", "hand dig"],
  },
  {
    key: "window_sampling_trial_pit",
    label: "Window sampling / trial pit",
    scope: "Ground investigation by window sampling/trial pits with stability, service avoidance, and sample integrity controls.",
    method:
      "1. Set sample locations and verify utility constraints.\n\n2. Establish exclusion/banksman controls for plant movement.\n\n3. Execute trial pit/window sample under supervised method.\n\n4. Label and log samples with timestamps.\n\n5. Backfill, reinstate, and issue sample chain notes.",
    hazardTokens: ["window sampling", "trial pit", "ground", "excavation", "plant", "buried", "sample"],
  },
  {
    key: "borehole_gi_drilling",
    label: "Borehole logging / GI drilling",
    scope: "Ground investigation drilling with plant controls, contamination pathways management, and borehole integrity checks.",
    method:
      "1. Verify drilling location, utility constraints, and permit interfaces.\n\n2. Set exclusion area and pre-use checks for rig.\n\n3. Conduct drilling with supervised spoil handling.\n\n4. Record strata/log data and sample references.\n\n5. Secure or backfill borehole and complete QA records.",
    hazardTokens: ["borehole", "drilling", "ground investigation", "spoil", "plant", "contamination", "utility"],
  },
  {
    key: "foundation_exposure_verification",
    label: "Foundation exposure / footing verification",
    scope: "Controlled excavation to expose foundations/footings and verify dimensions/condition against design assumptions.",
    method:
      "1. Confirm permit-to-dig and structural constraints.\n\n2. Establish excavation controls and support method.\n\n3. Expose footing/foundation in stages.\n\n4. Capture dimensions, photos, and verification notes.\n\n5. Protect/reinstate exposed area and close out.",
    hazardTokens: ["foundation", "footing", "excavation", "dig", "structure", "buried", "support"],
  },
  {
    key: "soakaway_infiltration_testing",
    label: "Soakaway / infiltration testing",
    scope: "Infiltration/percolation testing workflow with environmental controls, repeatability checks, and result traceability.",
    method:
      "1. Verify location and utility/service constraints.\n\n2. Prepare test pit and instrumentation.\n\n3. Execute soakaway cycle(s) and capture readings.\n\n4. Validate repeatability and note weather/ground caveats.\n\n5. Issue testing summary and close-out notes.",
    hazardTokens: ["soakaway", "infiltration", "percolation", "test pit", "ground", "environmental", "utility"],
  },
  {
    key: "vacuum_excavation_services",
    label: "Vacuum excavation near live services",
    scope: "Non-destructive vacuum excavation to expose services in uncertainty zones with strict permit and utility controls.",
    method:
      "1. Confirm permit-to-dig and uncertainty corridor boundaries.\n\n2. Brief team on suction/nozzle controls and exclusion zone.\n\n3. Expose services progressively with constant supervision.\n\n4. Verify and record asset identity with photos.\n\n5. Backfill/protect services and complete handover.",
    hazardTokens: ["vacuum excavation", "utility", "live services", "dig", "buried", "permit-to-dig", "expose"],
  },
  {
    key: "highway_live_corridor_survey",
    label: "Live highway corridor survey",
    scope: "Survey and set-out works in live carriageway/public realm with Chapter 8 controls, pedestrian segregation, and supervised interfaces.",
    method:
      "1. Review TM plan and lane/footway controls before mobilisation.\n\n2. Establish exclusion and pedestrian segregation zones.\n\n3. Execute survey runs with spotter/banksman support.\n\n4. Perform accuracy checks and live-interface close calls capture.\n\n5. Demobilise controls and handover residual risk notes.",
    hazardTokens: ["traffic", "carriageway", "pedestrian", "banksman", "highway", "moving plant", "public"],
  },
  {
    key: "utility_revalidation_pre_dig",
    label: "Pre-dig utility revalidation",
    scope: "Revalidation pack prior to intrusive works: records refresh, scan proof, tolerance zones, and dig permit interface checks.",
    method:
      "1. Recheck latest records and utility owner updates.\n\n2. Conduct EML/GPR re-scan and compare with prior outputs.\n\n3. Re-mark no-go and hand-dig tolerance zones.\n\n4. Verify permit-to-dig controls and supervision arrangements.\n\n5. Capture sign-off evidence and issue revalidation note.",
    hazardTokens: ["utility", "permit-to-dig", "scan", "buried", "dig", "expose", "records"],
  },
  {
    key: "drainage_repair_reinstatement_survey",
    label: "Drainage repair & reinstatement survey",
    scope: "Survey plus verification workflow for drainage repair/reinstatement including defect capture, reinstatement checks, and handover evidence.",
    method:
      "1. Confirm work extents and chamber access controls.\n\n2. Capture pre-repair condition evidence.\n\n3. Verify repair geometry and reinstatement quality.\n\n4. Perform post-repair CCTV/visual verification.\n\n5. Issue client handover pack with before/after references.",
    hazardTokens: ["drainage", "cctv", "chamber", "manhole", "contamination", "slips", "public"],
  },
  {
    key: "rail_public_infrastructure_survey",
    label: "Rail / public infrastructure survey",
    scope: "Survey works in rail/public infrastructure environments with strict access windows, competency controls, and interface management.",
    method:
      "1. Confirm access window/possession controls and authorisations.\n\n2. Verify team competencies and briefing requirements.\n\n3. Execute survey tasks within controlled safe zones.\n\n4. Capture hold-point verification at each stage gate.\n\n5. Close-out with interface notes and formal handback.",
    hazardTokens: ["rail", "public infrastructure", "permit", "access window", "traffic", "interface", "lone working"],
  },
];

const SURVEY_PACK_METADATA = {
  utility_mapping_survey: {
    permitDependencies: ["Excavation / permit-to-dig", "Temporary traffic management approval"],
    requiredCerts: ["PAS128 operator competence", "CAT/Genny competence"],
    mandatoryEvidence: ["Scan proof screenshot/photo", "Marked-up utility plan", "Permit interface sign-off"],
    holdPoints: ["HP1 records review complete", "HP2 scan validation complete", "HP3 marked no-go zones approved"],
  },
  cctv_drainage_survey: {
    permitDependencies: ["Confined space permit (if entry)", "Traffic management approval"],
    requiredCerts: ["Confined space awareness", "Drainage CCTV operator competence"],
    mandatoryEvidence: ["Chamber barrier photo", "CCTV run reference", "Defect log extract"],
    holdPoints: ["HP1 chamber safety check", "HP2 CCTV run quality check", "HP3 reinstatement/handover complete"],
  },
  jetting_hpwj: {
    permitDependencies: ["Confined space permit (as required)", "Task risk briefing record"],
    requiredCerts: ["HPWJ operator competence", "Rescue standby competence (when required)"],
    mandatoryEvidence: ["Pressure setting capture", "Exclusion zone photo", "Close-out contamination check"],
    holdPoints: ["HP1 pre-start pressure check", "HP2 first pass verification", "HP3 pressure release + close-out check"],
  },
  manhole_entry_inspection: {
    permitDependencies: ["Confined space permit", "Rescue plan confirmation"],
    requiredCerts: ["Confined space entry", "Gas monitor competence", "Rescue standby competence"],
    mandatoryEvidence: ["Gas test log", "Rescue setup photo", "Entry/exit record"],
    holdPoints: ["HP1 gas test pass", "HP2 rescue readiness", "HP3 close-out atmosphere record"],
  },
  trial_holes_slit_trenches: {
    permitDependencies: ["Excavation / permit-to-dig", "Service owner constraints check"],
    requiredCerts: ["Permit-to-dig briefing completion", "Banksman/plant marshal awareness"],
    mandatoryEvidence: ["Pre-start scan proof", "Exposed service photo", "Reinstatement note"],
    holdPoints: ["HP1 permit validation", "HP2 first exposure verification", "HP3 close-out sign-off"],
  },
  default: {
    permitDependencies: ["Check project permit interface before start"],
    requiredCerts: ["Supervisor briefing completion"],
    mandatoryEvidence: ["Task photos + notes", "Close-out handover note"],
    holdPoints: ["HP1 pre-start authorisation", "HP2 execution verification", "HP3 close-out confirmation"],
  },
};

function surveyPackMetaFor(packKey) {
  return SURVEY_PACK_METADATA[packKey] || SURVEY_PACK_METADATA.default;
}

function openWeatherDescription(code = "", fallback = "") {
  const c = String(code || "").slice(0, 2);
  const MAP = {
    "01": "Clear",
    "02": "Few clouds",
    "03": "Scattered clouds",
    "04": "Overcast",
    "09": "Shower rain",
    "10": "Rain",
    "11": "Thunderstorm",
    "13": "Snow",
    "50": "Mist",
  };
  return MAP[c] || fallback || "Weather";
}

async function fetchWeatherSummary(lat, lng) {
  const la = parseFloat(String(lat).trim(), 10);
  const lo = parseFloat(String(lng).trim(), 10);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) throw new Error("Invalid coordinates");
  const openWeatherKey = String(import.meta.env.VITE_OPENWEATHER_API_KEY || "").trim();
  const when = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  // Prefer OpenWeather when key is provided; fallback to Open-Meteo for keyless usage.
  if (openWeatherKey) {
    const u = new URL("https://api.openweathermap.org/data/2.5/weather");
    u.searchParams.set("lat", String(la));
    u.searchParams.set("lon", String(lo));
    u.searchParams.set("appid", openWeatherKey);
    u.searchParams.set("units", "metric");
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error("Weather request failed");
    const j = await r.json();
    const t = Number(j.main?.temp).toFixed(1);
    const w = Number(j.wind?.speed || 0) * 2.23694; // m/s -> mph
    const iconCode = j.weather?.[0]?.icon || "";
    const desc = openWeatherDescription(iconCode, j.weather?.[0]?.description || "");
    return `Site weather (${when}): ~${t}°C, ${desc}, wind ~${w.toFixed(1)} mph — OpenWeather snapshot for this location.`;
  }

  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(la));
  u.searchParams.set("longitude", String(lo));
  u.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  u.searchParams.set("wind_speed_unit", "mph");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  const t = j.current?.temperature_2m;
  const w = j.current?.wind_speed_10m;
  const code = j.current?.weather_code;
  const WMO = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 61: "Rain", 80: "Rain showers", 95: "Thunderstorm" };
  const desc = WMO[code] ?? `Weather code ${code}`;
  return `Site weather (${when}): ~${t}°C, ${desc}, wind ~${w} mph — Open-Meteo snapshot for this location.`;
}

function findSurveyPackByKey(packKey) {
  return SURVEYING_PACKS.find((p) => p.key === packKey) || null;
}

function findHazardsForSurveyPack(pack) {
  if (!pack) return [];
  const toks = (pack.hazardTokens || []).map((t) => String(t).toLowerCase());
  const matched = HAZARD_LIBRARY.filter((h) => {
    const hay = `${h.id} ${h.category} ${h.activity} ${h.hazard}`.toLowerCase();
    return toks.some((t) => hay.includes(t));
  });
  return matched.slice(0, 14);
}

function RiskBadge({ rf }) {
  const lvl = getRiskLevel({ RF: rf });
  const c = RL[lvl];
  return <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:c.bg, color:c.color }}>{rf} — {lvl}</span>;
}

// ─── Step 1 — Document info ──────────────────────────────────────────────────
function StepInfo({ form, setForm, projects, workers, onNext, onApplySurveyPack }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const smartFields = isFeatureEnabled("rams_header_smart_fields");
  const [draftSavedAtLabel, setDraftSavedAtLabel] = useState("");
  const [autofillUndo, setAutofillUndo] = useState(null);
  useEffect(() => {
    const tick = () => {
      try {
        const raw = sessionStorage.getItem(RAMS_DRAFT_KEY);
        if (!raw) {
          setDraftSavedAtLabel("");
          return;
        }
        const d = JSON.parse(raw);
        if (d.savedAt) setDraftSavedAtLabel(new Date(d.savedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        else setDraftSavedAtLabel("");
      } catch {
        setDraftSavedAtLabel("");
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, []);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [surveyPackKey, setSurveyPackKey] = useState(form.surveyWorkType || "");
  const selectedSurveyPack = useMemo(() => findSurveyPackByKey(surveyPackKey || form.surveyWorkType), [surveyPackKey, form.surveyWorkType]);
  const selectedSurveyMeta = useMemo(() => surveyPackMetaFor(selectedSurveyPack?.key || ""), [selectedSurveyPack]);
  const [showHeaderAdvanced, setShowHeaderAdvanced] = useState(false);
  const [showSurveyAdvanced, setShowSurveyAdvanced] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const moreDetailsFilledCount = useMemo(() => {
    const t = (v) => String(v ?? "").trim();
    let n = 0;
    if (t(form.revisionSummary)) n++;
    if (t(form.surveyDeliverables)) n++;
    if (t(form.surveyAssumptions)) n++;
    if (t(form.communicationPlan)) n++;
    if (t(form.handoverClientName)) n++;
    if (t(form.handoverReceiver)) n++;
    if (t(form.handoverDate)) n++;
    if (t(form.handoverNotes)) n++;
    if (t(form.siteLat) || t(form.siteLng)) n++;
    if (t(form.siteWeatherNote)) n++;
    if (t(form.siteMapUrl)) n++;
    if (t(form.nearestHospital)) n++;
    if (t(form.hospitalDirectionsUrl)) n++;
    return n;
  }, [
    form.revisionSummary,
    form.surveyDeliverables,
    form.surveyAssumptions,
    form.communicationPlan,
    form.handoverClientName,
    form.handoverReceiver,
    form.handoverDate,
    form.handoverNotes,
    form.siteLat,
    form.siteLng,
    form.siteWeatherNote,
    form.siteMapUrl,
    form.nearestHospital,
    form.hospitalDirectionsUrl,
  ]);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const allRamsDocs = load("rams_builder_docs", []);
  const [recentHeaderValues, setRecentHeaderValues] = useState(() => {
    const list = load("rams_header_recent_values", {
      locations: [],
      leads: [],
      refs: [],
    });
    return {
      locations: Array.isArray(list.locations) ? list.locations.slice(0, 3) : [],
      leads: Array.isArray(list.leads) ? list.leads.slice(0, 3) : [],
      refs: Array.isArray(list.refs) ? list.refs.slice(0, 3) : [],
    };
  });
  const valid = form.title?.trim() && form.location?.trim();
  const completenessChecks = [
    !!String(form.title || "").trim(),
    !!String(form.location || "").trim(),
    !!String(form.projectId || "").trim(),
    !!String(form.leadEngineer || "").trim(),
    !!String(form.jobRef || "").trim(),
    !!String(form.documentNo || "").trim(),
  ];
  const completenessScore = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);
  const headerMissing = [
    !String(form.title || "").trim() && "Job / document title",
    !String(form.location || "").trim() && "Location / site",
    !String(form.leadEngineer || "").trim() && "Lead engineer / supervisor",
    !String(form.jobRef || "").trim() && "Job reference",
    !String(form.documentNo || "").trim() && "Document number",
  ].filter(Boolean);
  const sameProjectRecent = allRamsDocs.filter((d) => d.projectId && d.projectId === form.projectId).slice(0, 5);
  const probableDuplicate = allRamsDocs.find((d) => String(d.title || "").trim().toLowerCase() === String(form.title || "").trim().toLowerCase() && d.id !== form.id);

  const presetTemplates = [
    { key: "surveying", label: "Surveying", title: "PAS128 utility mapping survey", scope: "Utility detection and mapping operations with control zones and QA checks." },
    { key: "hot_works", label: "Hot works", title: "Hot works maintenance operation", scope: "Controlled hot works with fire watch, permit interface and post-work checks." },
    { key: "electrical", label: "Electrical", title: "Electrical isolation and maintenance task", scope: "Safe isolation, verification and controlled electrical maintenance activities." },
  ];

  const applyPreset = (presetKey) => {
    const preset = presetTemplates.find((p) => p.key === presetKey);
    if (!preset) return;
    trackEvent("rams_header_preset_applied", { preset: presetKey });
    setForm((f) => ({
      ...f,
      title: f.title || preset.title,
      scope: f.scope || preset.scope,
      communicationPlan: f.communicationPlan || "Brief all operatives, confirm stop-work authority and permit interfaces before start.",
    }));
  };

  const suggestTitles = () => {
    if (!isFeatureEnabled("rams_header_ai_suggest")) return;
    const projectName = projects.find((p) => p.id === form.projectId)?.name || "Project";
    const base = String(form.surveyWorkTypeLabel || form.surveyWorkType || "works").replace(/_/g, " ");
    const suggestions = [
      `${projectName} - ${base} RAMS`,
      `${base} method statement (${projectName})`,
      `${projectName} safe system of work (${today()})`,
    ];
    setTitleSuggestions(suggestions);
    trackEvent("rams_header_ai_suggest_clicked", { projectId: form.projectId || "", workType: form.surveyWorkType || "" });
  };

  const saveRecentHeaderValue = (group, rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return;
    setRecentHeaderValues((prev) => {
      const nextList = [value, ...(prev[group] || []).filter((x) => x !== value)].slice(0, 3);
      const next = { ...prev, [group]: nextList };
      save("rams_header_recent_values", next);
      return next;
    });
  };
  const issueChecks = [
    { label: "Title and location", ok: !!(form.title?.trim() && form.location?.trim()) },
    { label: "Document number present", ok: !!String(form.documentNo || "").trim() },
    { label: "Document status selected", ok: !!String(form.documentStatus || "").trim() },
    {
      label: "Approval completed for approved/issued status",
      ok:
        !["approved", "issued"].includes(String(form.documentStatus || "")) ||
        (!!String(form.approvedBy || "").trim() && !!String(form.approvalDate || "").trim()),
    },
    {
      label: "Strict quality mode configured (recommended)",
      ok: !!form.strictMode ? Number(form.strictMinControls || 0) >= 2 : true,
    },
  ];

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not available in this browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          siteLat: String(Number(pos.coords.latitude.toFixed(5))),
          siteLng: String(Number(pos.coords.longitude.toFixed(5))),
        }));
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        alert(err?.message || "Could not read location. Allow location access or enter coordinates manually.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
    );
  };

  const importFromEmergency = () => {
    const ex = loadEmergencySiteExtras();
    setForm((f) => ({
      ...f,
      nearestHospital: ex.nearestHospital || f.nearestHospital,
      hospitalDirectionsUrl: ex.hospitalDirectionsUrl || f.hospitalDirectionsUrl,
      siteMapUrl: ex.siteMapUrl || f.siteMapUrl,
    }));
  };

  const runWeatherLookup = async () => {
    setWeatherLoading(true);
    try {
      const line = await fetchWeatherSummary(form.siteLat, form.siteLng);
      set("siteWeatherNote", [form.siteWeatherNote, line].filter(Boolean).join("\n\n"));
    } catch (e) {
      console.warn(e);
      alert("Could not load weather. Check latitude / longitude and try again.");
    } finally {
      setWeatherLoading(false);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"min(72vh, 640px)" }}>
      <div style={{ flex:1, minHeight:0 }}>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:20, lineHeight:1.5 }}>
        Work through site, document control, team, hazard pack, then operatives. Use <strong>Further details</strong> for revision notes, client handover, assumptions, and optional site weather / emergency links.
      </div>
      {!smartFields && (
        <div style={{ marginBottom:12, fontSize:12, color:"#633806", background:"#FAEEDA", border:"1px solid #f6d89f", borderRadius:8, padding:"8px 10px" }}>
          Smart header assists are off. Enable <strong>rams_header_smart_fields</strong> under Settings → Developer if you want presets, chips, and readiness scoring.
        </div>
      )}
      {smartFields && sameProjectRecent.length > 0 && (
        <div style={{ marginBottom:10, fontSize:12, color:"#0C447C", background:"#E6F1FB", border:"1px solid #cfe3f8", borderRadius:8, padding:"8px 10px" }}>
          Based on previous {sameProjectRecent.length} RAMS for this project.
        </div>
      )}
      {smartFields && probableDuplicate && (
        <div style={{ marginBottom:10, fontSize:12, color:"#791F1F", background:"#FCEBEB", border:"1px solid #f5c7c7", borderRadius:8, padding:"8px 10px" }}>
          Similar RAMS already exists: "{probableDuplicate.title || "Untitled"}". Review before issuing.
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {smartFields && (
            <>
              <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>
                Header completeness: {completenessScore}%
              </span>
              {headerMissing.length > 0 && (
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#FAEEDA", color:"#633806" }}>
                  Missing: {headerMissing.slice(0, 2).join(", ")}{headerMissing.length > 2 ? "..." : ""}
                </span>
              )}
            </>
          )}
          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"#EAF3DE", color:"#27500A" }} title="Session draft timestamp from this browser">
            {draftSavedAtLabel ? `Session draft: ${draftSavedAtLabel}` : "Session draft: not yet saved"}
          </span>
        </div>
        <button type="button" onClick={() => setShowHeaderAdvanced((v) => !v)} style={{ ...ss.btn, fontSize:12, minHeight:34 }}>
          {showHeaderAdvanced ? "Hide advanced" : "Show advanced"}
        </button>
      </div>

      {smartFields && (
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:10 }}>
        <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Quick presets:</span>
        {presetTemplates.map((preset) => (
          <button key={preset.key} type="button" onClick={() => applyPreset(preset.key)} style={{ ...ss.btn, fontSize:11, minHeight:30, padding:"4px 10px" }}>
            {preset.label}
          </button>
        ))}
      </div>
      )}

      <section className="app-rams-header-section" aria-labelledby="rams-h-site">
        <h3 id="rams-h-site" className="app-rams-header-section-title">Project &amp; site</h3>
        <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 10px", lineHeight:1.45 }}>
          Start with the project (optional autofill), then location and RAMS date. Title is the document name on the cover.
        </p>
        <div className="app-rams-header-section-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ss.lbl}>Project</label>
            <select value={form.projectId||""} onChange={e=>{
              const nextId = e.target.value;
              const project = projects.find((p) => p.id === nextId);
              trackEvent("rams_header_project_selected", { projectId: nextId || "" });
              if (smartFields) {
                setAutofillUndo({
                  title: form.title,
                  location: form.location,
                  leadEngineer: form.leadEngineer,
                  jobRef: form.jobRef,
                });
              }
              setForm((f) => ({
                ...f,
                projectId: nextId,
                location: f.location || project?.location || project?.site || f.location,
                leadEngineer: f.leadEngineer || project?.leadEngineer || project?.owner || f.leadEngineer,
                jobRef: f.jobRef || project?.code || project?.projectCode || f.jobRef,
                title: f.title || (project ? `${project.name} - RAMS` : f.title),
              }));
            }} style={ss.inp}>
              <option value="">— Select project —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {smartFields && autofillUndo && (
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    ...autofillUndo,
                  }));
                  setAutofillUndo(null);
                  trackEvent("rams_header_undo_autofill", {});
                }}
                style={{ ...ss.btn, fontSize:11, marginTop:6, minHeight:30 }}
              >
                Undo project autofill
              </button>
            )}
          </div>
          <div>
            <label style={ss.lbl}>Location / site *</label>
            <input value={form.location||""} onChange={e=>set("location",e.target.value)}
              onBlur={(e) => saveRecentHeaderValue("locations", e.target.value)}
              placeholder="e.g. Two Sisters Scunthorpe" style={ss.inp} />
            {smartFields && recentHeaderValues.locations.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                {recentHeaderValues.locations.map((v) => (
                  <button key={v} type="button" onClick={() => { set("location", v); trackEvent("rams_header_recent_chip_clicked", { field: "location" }); }} style={{ ...ss.btn, fontSize:11, minHeight:28, padding:"2px 8px" }}>{v}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={ss.lbl}>RAMS date</label>
            <input type="date" value={form.date||today()} onChange={e=>set("date",e.target.value)} style={ss.inp} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={ss.lbl}>Job / document title *</label>
            <div style={{ display:"flex", gap:6 }}>
              <input value={form.title||""} onChange={e=>set("title",e.target.value)}
                placeholder="e.g. Kettle removal and installation of new kettle" style={{ ...ss.inp, flex:1 }} />
              {smartFields && (
                <button type="button" onClick={suggestTitles} style={{ ...ss.btn, minHeight:40, fontSize:12 }}>Suggest</button>
              )}
            </div>
            {smartFields && titleSuggestions.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                {titleSuggestions.map((s) => (
                  <button key={s} type="button" onClick={() => set("title", s)} style={{ ...ss.btn, fontSize:11, minHeight:30, padding:"3px 10px" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="app-rams-header-section" aria-labelledby="rams-h-doc">
        <h3 id="rams-h-doc" className="app-rams-header-section-title">Document control</h3>
        <div className="app-rams-header-section-grid">
          <div>
            <label style={ss.lbl}>Document no.</label>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input
                value={form.documentNo||""}
                onChange={e=>set("documentNo",e.target.value)}
                placeholder={`e.g. ${generateRamsDocNo()}`}
                style={{ ...ss.inp, flex: 1 }}
              />
              <button type="button" onClick={() => set("documentNo", generateRamsDocNo())} style={{ ...ss.btn, minHeight: 40, fontSize: 12 }}>
                Auto
              </button>
            </div>
          </div>
          <div>
            <label style={ss.lbl}>Revision</label>
            <input value={form.revision||"1A"} onChange={e=>set("revision",e.target.value)} placeholder="1A" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Issue date</label>
            <input type="date" value={form.issueDate||""} onChange={e=>set("issueDate",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Document status</label>
            <select value={form.documentStatus||"draft"} onChange={e=>set("documentStatus",e.target.value)} style={ss.inp}>
              {RAMS_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ss.lbl}>Review due date</label>
            <input type="date" value={form.reviewDate||""} onChange={e=>set("reviewDate",e.target.value)} style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Approved by</label>
            <input value={form.approvedBy||""} onChange={e=>set("approvedBy",e.target.value)}
              placeholder="e.g. Operations manager" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Approval date</label>
            <input type="date" value={form.approvalDate||""} onChange={e=>set("approvalDate",e.target.value)} style={ss.inp} />
          </div>
        </div>
      </section>

      <section className="app-rams-header-section" aria-labelledby="rams-h-team">
        <h3 id="rams-h-team" className="app-rams-header-section-title">Team &amp; job reference</h3>
        <div className="app-rams-header-section-grid">
          <div>
            <label style={ss.lbl}>Lead engineer / supervisor</label>
            <input value={form.leadEngineer||""} onChange={e=>set("leadEngineer",e.target.value)}
              onBlur={(e) => saveRecentHeaderValue("leads", e.target.value)}
              placeholder="e.g. D Anderson" style={ss.inp} />
            {smartFields && recentHeaderValues.leads.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                {recentHeaderValues.leads.map((v) => (
                  <button key={v} type="button" onClick={() => { set("leadEngineer", v); trackEvent("rams_header_recent_chip_clicked", { field: "leadEngineer" }); }} style={{ ...ss.btn, fontSize:11, minHeight:28, padding:"2px 8px" }}>{v}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={ss.lbl}>Job reference</label>
            <input value={form.jobRef||""} onChange={e=>set("jobRef",e.target.value)}
              onBlur={(e) => saveRecentHeaderValue("refs", e.target.value)}
              placeholder="e.g. FP1-DOLAV-001" style={ss.inp} />
            {!String(form.jobRef || "").trim() && (
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:4 }}>
                Suggested format: PRJ-{new Date().getFullYear()}-###
              </div>
            )}
            {smartFields && recentHeaderValues.refs.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                {recentHeaderValues.refs.map((v) => (
                  <button key={v} type="button" onClick={() => { set("jobRef", v); trackEvent("rams_header_recent_chip_clicked", { field: "jobRef" }); }} style={{ ...ss.btn, fontSize:11, minHeight:28, padding:"2px 8px" }}>{v}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {smartFields && (
      <div style={{ marginBottom:12, ...ss.card, padding:10, border:"0.5px solid #e2e8f0" }}>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>
          Cover preview
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12 }}>
          <div><span style={{ color:"var(--color-text-secondary)" }}>Title:</span> {form.title || "—"}</div>
          <div><span style={{ color:"var(--color-text-secondary)" }}>Project:</span> {projects.find((p) => p.id === form.projectId)?.name || "—"}</div>
          <div><span style={{ color:"var(--color-text-secondary)" }}>Location:</span> {form.location || "—"}</div>
          <div><span style={{ color:"var(--color-text-secondary)" }}>Lead:</span> {form.leadEngineer || "—"}</div>
        </div>
      </div>
      )}

      {smartFields && (
      <div style={{ ...ss.card, marginBottom:20, padding:12, border:"0.5px solid #d9e2ec" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
          Issue readiness checks
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {issueChecks.map((c) => (
            <div key={c.label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: c.ok ? "#EAF3DE" : "#FCEBEB",
                color: c.ok ? "#27500A" : "#791F1F",
                fontWeight: 700,
              }}>
                {c.ok ? "✓" : "!"}
              </span>
              <span style={{ color: c.ok ? "var(--color-text-primary)" : "#7F1D1D" }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {showHeaderAdvanced && (
        <>
      <div style={{ ...ss.card, marginBottom:20, padding:12, border:"0.5px solid #dbeafe", background:"#f8fbff" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
          Strict quality mode
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, marginBottom:8, cursor:"pointer" }}>
          <input
            type="checkbox"
            checked={!!form.strictMode}
            onChange={(e) => set("strictMode", e.target.checked)}
            style={{ accentColor:"#0d9488", width:14, height:14 }}
          />
          Enforce advanced quality checks for every risk row
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, opacity:form.strictMode?1:0.65 }}>
          <div>
            <label style={ss.lbl}>Minimum controls per row</label>
            <input
              type="number"
              min={2}
              max={10}
              value={Number(form.strictMinControls || 3)}
              onChange={(e) => set("strictMinControls", Math.max(2, Math.min(10, Number(e.target.value) || 3)))}
              style={ss.inp}
              disabled={!form.strictMode}
            />
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, cursor:"pointer", marginTop:24 }}>
            <input
              type="checkbox"
              checked={!!form.strictRequireHoldPoints}
              onChange={(e) => set("strictRequireHoldPoints", e.target.checked)}
              style={{ accentColor:"#0d9488", width:14, height:14 }}
              disabled={!form.strictMode}
            />
            Require hold points on each risk row
          </label>
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Scope of works</label>
        <textarea value={form.scope||""} onChange={e=>set("scope",e.target.value)}
          placeholder="Describe the work to be carried out…" style={ss.ta} rows={3} />
      </div>
      </>
      )}

      <section className="app-rams-header-section" style={{ background: "var(--color-background-primary,#fff)" }} aria-labelledby="rams-h-pack">
        <h3 id="rams-h-pack" className="app-rams-header-section-title">Hazard pack (surveying)</h3>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 10px", lineHeight:1.45 }}>
          Optional: apply a surveying pack before Step 2. RAMS hazards stay the source of truth for risk rows.
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
          <select value={surveyPackKey} onChange={(e) => setSurveyPackKey(e.target.value)} style={{ ...ss.inp, minWidth: 260 }}>
            <option value="">— Select surveying pack —</option>
            {SURVEYING_PACKS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!surveyPackKey}
            onClick={() => onApplySurveyPack?.(surveyPackKey)}
            style={{ ...ss.btnP, opacity: surveyPackKey ? 1 : 0.45, minHeight: 40 }}
          >
            Apply pack
          </button>
          {!!form.surveyWorkType && (
            <span style={{ fontSize:11, color:"#0C447C", background:"#E6F1FB", padding:"2px 8px", borderRadius:20 }}>
              Active: {form.surveyWorkTypeLabel || SURVEYING_PACKS.find((p) => p.key === form.surveyWorkType)?.label || form.surveyWorkType}
            </span>
          )}
          <button type="button" onClick={() => setShowSurveyAdvanced((v) => !v)} style={{ ...ss.btn, minHeight: 40, fontSize:12 }}>
            {showSurveyAdvanced ? "Hide recommendations" : "Show recommendations"}
          </button>
        </div>
        {selectedSurveyPack && (
          <div style={{ marginTop:10, border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:10, background:"var(--color-background-secondary,#f7f7f5)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--color-text-secondary)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>
              Pack readiness requirements
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:10 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>Permit dependencies</div>
                <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                  {(selectedSurveyMeta.permitDependencies || []).map((x) => <li key={`pd_${x}`}>{x}</li>)}
                </ul>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>Required competencies</div>
                <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                  {(selectedSurveyMeta.requiredCerts || []).map((x) => <li key={`rc_${x}`}>{x}</li>)}
                </ul>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>Mandatory evidence</div>
                <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                  {(selectedSurveyMeta.mandatoryEvidence || []).map((x) => <li key={`ev_${x}`}>{x}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
        {showSurveyAdvanced && (
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:10 }}>
            RAMS remains the primary hazard source. This panel only applies surveying pack wording and suggested rows.
          </div>
        )}
        {String(form.location || "").toLowerCase().includes("zone") && (
          <div style={{ marginTop:8, fontSize:11, color:"#633806", background:"#FAEEDA", padding:"6px 8px", borderRadius:6 }}>
            Hint: This location looks zone-based. Verify hazard pack selection and permit interfaces before Step 2.
          </div>
        )}
      </section>

      <section className="app-rams-header-section" aria-labelledby="rams-h-ops">
        <h3 id="rams-h-ops" className="app-rams-header-section-title">Operatives on this RAMS</h3>
        <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 10px", lineHeight:1.45 }}>
          Select workers for this document. You can include certificates in print when the option below is enabled.
        </p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {workers.map(w=>{
            const sel = (form.operativeIds||[]).includes(w.id);
            return (
              <button key={w.id} type="button" onClick={()=>set("operativeIds", sel ? (form.operativeIds||[]).filter(id=>id!==w.id) : [...(form.operativeIds||[]),w.id])}
                style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                  background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)",
                  color:sel?"#E1F5EE":"var(--color-text-primary)",
                  border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)" }}>
                {w.name}
              </button>
            );
          })}
          {workers.length===0 && <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No workers added yet — add workers in the Workers module.</span>}
        </div>
        {workers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, operativeIds: workers.map((w) => w.id) }))}
              style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}
            >
              Select all operatives
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, operativeIds: [] }))}
              style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}
            >
              Clear selection
            </button>
          </div>
        )}
        {(form.operativeIds || []).length > 0 && (
          <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", fontSize:13, marginTop:12, maxWidth:640, lineHeight:1.45 }}>
            <input
              type="checkbox"
              checked={normalizePrintSections(form.printSections)[RAMS_SECTION_IDS.OPERATIVE_CERTS] === true}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  printSections: { ...f.printSections, operative_certs: e.target.checked },
                }))
              }
              style={{ accentColor:"#0d9488", width:15, height:15, marginTop:2, flexShrink:0 }}
            />
            <span>
              Include <strong>certificates &amp; competencies</strong> for selected operatives (from Workers: dated certs and free-text notes). Optional — appears in preview/print when enabled.
            </span>
          </label>
        )}
      </section>

      <div className="app-rams-more-details-wrap">
        <button
          type="button"
          className="app-rams-more-details-toggle"
          onClick={() => setShowMoreDetails((v) => !v)}
          aria-expanded={showMoreDetails}
        >
          <span style={{ fontWeight:600 }}>{showMoreDetails ? "Hide further details" : "Further details"}</span>
          <span className="app-rams-more-details-badge">{moreDetailsFilledCount ? `${moreDetailsFilledCount} filled` : "Optional"}</span>
        </button>
        {showMoreDetails && (
        <div className="app-rams-more-details-inner">
        <div style={{ marginBottom:14, padding:"8px 10px", borderRadius:8, background:"var(--color-background-secondary,#f7f7f5)", border:"1px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>Quick dates</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button type="button" onClick={() => set("date", today())} style={{ ...ss.btn, fontSize:11, minHeight:28 }}>RAMS date: today</button>
            <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 7); set("reviewDate", d.toISOString().slice(0,10)); }} style={{ ...ss.btn, fontSize:11, minHeight:28 }}>Review +7 days</button>
            <button type="button" onClick={() => { const d = new Date(); const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0); set("reviewDate", eom.toISOString().slice(0,10)); }} style={{ ...ss.btn, fontSize:11, minHeight:28 }}>Review end of month</button>
          </div>
        </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Revision note / change summary</label>
        <textarea
          value={form.revisionSummary||""}
          onChange={e=>set("revisionSummary",e.target.value)}
          placeholder="What changed in this revision and why?"
          style={ss.ta}
          rows={2}
        />
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Survey deliverables / outputs</label>
        <textarea
          value={form.surveyDeliverables||""}
          onChange={e=>set("surveyDeliverables",e.target.value)}
          placeholder="e.g. RAMS PDF, marked utility sketch, CAD extract, QA checklist"
          style={ss.ta}
          rows={2}
        />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap:10, marginBottom:20 }}>
        <div>
          <label style={ss.lbl}>Key assumptions</label>
          <textarea
            value={form.surveyAssumptions||""}
            onChange={e=>set("surveyAssumptions",e.target.value)}
            placeholder="What must be true for this RAMS to remain valid?"
            style={ss.ta}
            rows={3}
          />
        </div>
        <div>
          <label style={ss.lbl}>Communication & permit controls</label>
          <textarea
            value={form.communicationPlan||""}
            onChange={e=>set("communicationPlan",e.target.value)}
            placeholder="Briefing, stop-work authority, permit interfaces, escalation route"
            style={ss.ta}
            rows={3}
          />
        </div>
      </div>

      <div style={{ marginBottom:20, ...ss.card, padding:12, border:"0.5px solid #e2e8f0" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
          Client handover appendix
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap:10, marginBottom:10 }}>
          <div>
            <label style={ss.lbl}>Client / company</label>
            <input value={form.handoverClientName||""} onChange={e=>set("handoverClientName",e.target.value)} placeholder="Client name" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Receiver name</label>
            <input value={form.handoverReceiver||""} onChange={e=>set("handoverReceiver",e.target.value)} placeholder="Person receiving RAMS" style={ss.inp} />
          </div>
          <div>
            <label style={ss.lbl}>Handover date</label>
            <input type="date" value={form.handoverDate||""} onChange={e=>set("handoverDate",e.target.value)} style={ss.inp} />
          </div>
        </div>
        <div>
          <label style={ss.lbl}>Handover notes</label>
          <textarea
            value={form.handoverNotes||""}
            onChange={e=>set("handoverNotes",e.target.value)}
            placeholder="Critical brief, residual risks communicated, permit confirmations..."
            style={ss.ta}
            rows={2}
          />
        </div>
      </div>

      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", margin:"20px 0 10px" }}>
        Site weather, map &amp; emergency (optional)
      </div>
      <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 12px", maxWidth:640 }}>
        Fills printed RAMS sections. Save nearest A&amp;E under <strong>Emergency contacts</strong> and use &quot;Import from Emergency&quot; to copy here.
      </p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
        <button type="button" onClick={importFromEmergency} style={{ ...ss.btn, fontSize:12 }}>
          Import from Emergency module
        </button>
        {form.location?.trim() && (
          <a href={googleMapsSearchUrl(form.location)} target="_blank" rel="noopener noreferrer" style={{ ...ss.btn, fontSize:12, textDecoration:"none", display:"inline-flex", alignItems:"center" }}>
            Open site location in Google Maps
          </a>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap:10, marginBottom:12 }}>
        <div>
          <label style={ss.lbl}>Latitude (for weather)</label>
          <input value={form.siteLat || ""} onChange={(e) => set("siteLat", e.target.value)} placeholder="e.g. 53.58" inputMode="decimal" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Longitude (for weather)</label>
          <input value={form.siteLng || ""} onChange={(e) => set("siteLng", e.target.value)} placeholder="e.g. -0.65" inputMode="decimal" style={ss.inp} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={geoLoading}
            onClick={useMyLocation}
            style={{ ...ss.btn, fontSize: 12, width: "100%", opacity: geoLoading ? 0.7 : 1 }}
          >
            {geoLoading ? "Getting location…" : "Use my location (lat / lng)"}
          </button>
          <button type="button" disabled={weatherLoading || !String(form.siteLat || "").trim() || !String(form.siteLng || "").trim()} onClick={runWeatherLookup} style={{ ...ss.btnP, fontSize:12, width:"100%", opacity: weatherLoading ? 0.7 : 1 }}>
            {weatherLoading ? "Loading…" : "Fetch weather"}
          </button>
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={ss.lbl}>Site weather note</label>
        <textarea value={form.siteWeatherNote || ""} onChange={(e) => set("siteWeatherNote", e.target.value)} rows={2} placeholder="Conditions for the work date, or use Open-Meteo above" style={ss.ta} />
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={ss.lbl}>Map / OSM link (optional)</label>
        <input value={form.siteMapUrl || ""} onChange={(e) => set("siteMapUrl", e.target.value)} placeholder="https://…" style={ss.inp} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap:10, marginBottom:12 }}>
        <div>
          <label style={ss.lbl}>Nearest A&amp;E / hospital</label>
          <input value={form.nearestHospital || ""} onChange={(e) => set("nearestHospital", e.target.value)} placeholder="Hospital name and area" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Directions URL (Google Maps)</label>
          <input value={form.hospitalDirectionsUrl || ""} onChange={(e) => set("hospitalDirectionsUrl", e.target.value)} placeholder="https://maps.google.com/…" style={ss.inp} />
        </div>
      </div>

        </div>
        )}
      </div>

      </div>
      <div style={{
        position: "sticky",
        bottom: 0,
        marginTop: 16,
        paddingTop: 12,
        paddingBottom: 4,
        background: "var(--color-background-primary,#fff)",
        borderTop: "1px solid var(--color-border-tertiary,#e5e5e5)",
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        zIndex: 2,
      }}>
        <button
          type="button"
          onClick={() => {
            if (!valid) {
              trackEvent("rams_header_next_blocked_validation", { missing: headerMissing });
              return;
            }
            if (smartFields) trackEvent("rams_header_quality_score_changed", { score: completenessScore });
            onNext();
          }}
          style={{ ...ss.btnP, opacity:valid?1:0.4 }}
        >
          Next — select hazards →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Hazard picker ──────────────────────────────────────────────────
function HazardPicker({
  selected,
  selectedRows,
  orgActivities,
  hazardPrefs,
  hazardPacks,
  projectId,
  surveyWorkType,
  onToggle,
  onClearSelected,
  onAddAllVisible,
  onCreateOrgActivity,
  onDeleteOrgActivity,
  onToggleHazardFavorite,
  onSaveHazardPack,
  onApplyHazardPack,
  onRenameHazardPack,
  onDeleteHazardPack,
  onTogglePinHazardPack,
  onSetHazardPackStatus,
  onCreateHazardPackVersion,
  onRollbackHazardPackVersion,
  onExportHazardPacks,
  onImportHazardPacks,
  onImportFromLastProject,
  onNext,
  onBack,
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [quickFilter, setQuickFilter] = useState("all"); // all | favorites | most_used
  const [packName, setPackName] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");
  const importPackRef = useRef(null);
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgDraft, setOrgDraft] = useState({
    category: ORG_ACTIVITY_CATEGORY,
    activity: "",
    hazard: "",
    controls: "",
    ppe: "",
    regs: "",
    initialL: 4,
    initialS: 4,
    revisedL: 2,
    revisedS: 4,
  });
  const orgList = Array.isArray(orgActivities) ? orgActivities : [];
  const quickPacks = useMemo(() => {
    const list = Array.isArray(hazardPacks) ? [...hazardPacks] : [];
    return list.sort((a, b) => {
      const sa = String(a?.status || HAZARD_PACK_STATUS.CURRENT);
      const sb = String(b?.status || HAZARD_PACK_STATUS.CURRENT);
      if (sa !== sb) return sa === HAZARD_PACK_STATUS.CURRENT ? -1 : 1;
      const pa = a?.isPinned ? 1 : 0;
      const pb = b?.isPinned ? 1 : 0;
      if (pb !== pa) return pb - pa;
      return new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    });
  }, [hazardPacks]);
  const favoriteIds = new Set(hazardPrefs?.favoriteIds || []);
  const usageCounts = hazardPrefs?.usageCounts || {};
  const recentIds = hazardPrefs?.recentIds || [];
  const recentSet = new Set(recentIds);
  const sourceAll = useMemo(() => [...orgList, ...HAZARD_LIBRARY], [orgList]);

  const baseResults = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return sourceAll.filter(
        (h) =>
          String(h.activity || "").toLowerCase().includes(q) ||
          String(h.hazard || "").toLowerCase().includes(q) ||
          String(h.category || "").toLowerCase().includes(q)
      );
    }
    if (activeCategory === "All") return sourceAll;
    if (activeCategory === ORG_ACTIVITY_CATEGORY) return orgList;
    return [...getByCategory(activeCategory), ...orgList.filter((h) => String(h.category || "") === activeCategory)];
  }, [search, activeCategory, sourceAll, orgList]);
  const results = useMemo(() => {
    let list = [...baseResults];
    if (quickFilter === "favorites") {
      list = list.filter((h) => favoriteIds.has(h.id));
    } else if (quickFilter === "most_used") {
      list.sort((a, b) => Number(usageCounts[b.id] || 0) - Number(usageCounts[a.id] || 0));
      list = list.filter((h) => Number(usageCounts[h.id] || 0) > 0);
    } else if (quickFilter === "recent") {
      list = list.filter((h) => recentSet.has(h.id));
      list.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
    }
    return list;
  }, [baseResults, quickFilter, favoriteIds, usageCounts, recentSet, recentIds]);

  const categoryCounts = useMemo(() => {
    const base = Object.fromEntries(TRADE_CATEGORIES.map((c) => [c, getByCategory(c).length]));
    orgList.forEach((h) => {
      const c = String(h.category || ORG_ACTIVITY_CATEGORY);
      if (c === ORG_ACTIVITY_CATEGORY) return;
      base[c] = (base[c] || 0) + 1;
    });
    base[ORG_ACTIVITY_CATEGORY] = orgList.length;
    return base;
  }, [orgList]);

  const selectedIdSet = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const visibleNotSelectedCount = useMemo(
    () => results.filter((h) => !selectedIdSet.has(h.id)).length,
    [results, selectedIdSet]
  );
  const favoritesNotSelectedCount = useMemo(
    () => sourceAll.filter((h) => favoriteIds.has(h.id) && !selectedIdSet.has(h.id)).length,
    [sourceAll, favoriteIds, selectedIdSet]
  );
  const topQuickTemplates = useMemo(() => {
    const byUse = [...sourceAll].sort((a, b) => Number(usageCounts[b.id] || 0) - Number(usageCounts[a.id] || 0));
    const favs = sourceAll.filter((h) => favoriteIds.has(h.id));
    const merged = [...favs, ...byUse];
    const seen = new Set();
    return merged.filter((h) => {
      if (!h?.id || seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    }).slice(0, 8);
  }, [sourceAll, usageCounts, favoriteIds]);

  const buildPackTemplates = (rows) =>
    (Array.isArray(rows) ? rows : []).map((r) => ({
      templateId: String(r.sourceId || r.id),
      category: r.category || "General",
      activity: r.activity || "",
      hazard: r.hazard || "",
      initialRisk: r.initialRisk || { L: 4, S: 4, RF: 16 },
      revisedRisk: r.revisedRisk || { L: 2, S: 4, RF: 8 },
      controlMeasures: (r.controlMeasures || []).filter(Boolean),
      ppeRequired: (r.ppeRequired || []).filter(Boolean),
      regs: (r.regs || []).filter(Boolean),
    }));

  const buildPackKeywords = (templates) => {
    const text = (templates || [])
      .map((t) => `${t.category || ""} ${t.activity || ""} ${t.hazard || ""}`)
      .join(" ")
      .toLowerCase();
    const words = text.match(/[a-z0-9]{4,}/g) || [];
    const stop = new Set([
      "with", "from", "that", "this", "work", "task", "risk", "site", "activity", "hazard", "general", "using", "where",
      "after", "before", "under", "into", "over", "near", "method", "control", "controls",
    ]);
    const counts = {};
    words.forEach((w) => {
      if (stop.has(w)) return;
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);
  };

  const recommendedPacks = useMemo(() => {
    const selectedIds = new Set((selectedRows || []).map((r) => String(r.sourceId || r.id)));
    const keyText = (selectedRows || [])
      .map((r) => `${r.category || ""} ${r.activity || ""} ${r.hazard || ""}`)
      .join(" ")
      .toLowerCase();
    return quickPacks
      .map((p) => {
        const templateIds = new Set((p.templates || []).map((t) => String(t.templateId || "")));
        const overlap = Array.from(selectedIds).filter((id) => templateIds.has(id)).length;
        const remaining = Math.max(0, templateIds.size - overlap);
        if (templateIds.size === 0 || remaining === 0) return null;
        let score = 0;
        if (projectId && p.projectId && p.projectId === projectId) score += 42;
        if (surveyWorkType && p.surveyWorkType && p.surveyWorkType === surveyWorkType) score += 28;
        score += Math.min(24, overlap * 4);
        score += p.isPinned ? 8 : 0;
        score += Math.min(12, Number(p.appliedCount || 0));
        const kw = Array.isArray(p.keywords) ? p.keywords : [];
        const kwHits = kw.filter((w) => keyText.includes(String(w || "").toLowerCase())).length;
        score += Math.min(12, kwHits * 3);
        return { pack: p, score, remaining, overlap };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [quickPacks, selectedRows, projectId, surveyWorkType]);

  const ensureAddHazard = (h) => {
    if (!h || selectedIdSet.has(h.id)) return;
    onToggle?.(h);
  };

  const saveOrgTemplate = () => {
    const activity = String(orgDraft.activity || "").trim();
    const hazard = String(orgDraft.hazard || "").trim();
    if (!activity || !hazard) {
      window.alert("Activity and hazard are required for organisation activity.");
      return;
    }
    const parseList = (v) =>
      String(v || "")
        .split(/\n|;/)
        .map((x) => x.trim())
        .filter(Boolean);
    const l1 = Number(orgDraft.initialL) || 4;
    const s1 = Number(orgDraft.initialS) || 4;
    const l2 = Number(orgDraft.revisedL) || 2;
    const s2 = Number(orgDraft.revisedS) || 4;
    onCreateOrgActivity?.({
      id: `org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      category: String(orgDraft.category || ORG_ACTIVITY_CATEGORY).trim() || ORG_ACTIVITY_CATEGORY,
      activity,
      hazard,
      initialRisk: { L: l1, S: s1, RF: l1 * s1 },
      revisedRisk: { L: l2, S: s2, RF: l2 * s2 },
      controlMeasures: parseList(orgDraft.controls),
      ppeRequired: parseList(orgDraft.ppe).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean),
      regs: parseList(orgDraft.regs).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean),
      _orgTemplate: true,
    });
    setOrgDraft((d) => ({ ...d, activity: "", hazard: "", controls: "", ppe: "", regs: "" }));
    setShowOrgForm(false);
  };

  const saveSelectedAsPack = () => {
    const name = String(packName || "").trim();
    if (!name) {
      window.alert("Enter pack name.");
      return;
    }
    const rows = Array.isArray(selectedRows) ? selectedRows : [];
    if (rows.length === 0) {
      window.alert("Select at least one activity to save a pack.");
      return;
    }
    const templates = buildPackTemplates(rows);
    onSaveHazardPack?.({
      id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      templates,
      version: 1,
      versionHistory: [],
      status: HAZARD_PACK_STATUS.CURRENT,
      projectId: projectId || "",
      surveyWorkType: surveyWorkType || "",
      keywords: buildPackKeywords(templates),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setPackName("");
  };

  const renameSelectedPack = () => {
    if (!selectedPackId) return;
    const p = quickPacks.find((x) => x.id === selectedPackId);
    if (!p) return;
    const nextName = window.prompt("Rename quick pack", p.name || "");
    if (nextName == null) return;
    const name = String(nextName || "").trim();
    if (!name) return;
    onRenameHazardPack?.(selectedPackId, name);
  };

  const deleteSelectedPack = () => {
    if (!selectedPackId) return;
    const p = quickPacks.find((x) => x.id === selectedPackId);
    if (!p) return;
    if (!window.confirm(`Delete quick pack "${p.name}"?`)) return;
    onDeleteHazardPack?.(selectedPackId);
    setSelectedPackId("");
  };

  const togglePinSelectedPack = () => {
    if (!selectedPackId) return;
    onTogglePinHazardPack?.(selectedPackId);
  };

  const createNewVersionForSelectedPack = () => {
    if (!selectedPackId) return;
    const p = quickPacks.find((x) => x.id === selectedPackId);
    if (!p) return;
    const rows = Array.isArray(selectedRows) ? selectedRows : [];
    if (rows.length === 0) {
      window.alert("Select at least one activity before creating a new pack version.");
      return;
    }
    const note = window.prompt("Version note (optional)", "Adjusted controls for current project context");
    if (note == null) return;
    const templates = buildPackTemplates(rows);
    onCreateHazardPackVersion?.(selectedPackId, templates, String(note || "").trim(), {
      projectId: projectId || "",
      surveyWorkType: surveyWorkType || "",
      keywords: buildPackKeywords(templates),
    });
  };

  const rollbackSelectedPack = () => {
    if (!selectedPackId) return;
    const p = quickPacks.find((x) => x.id === selectedPackId);
    if (!p) return;
    const historyCount = Array.isArray(p.versionHistory) ? p.versionHistory.length : 0;
    if (historyCount === 0) {
      window.alert("No previous versions available to rollback.");
      return;
    }
    if (!window.confirm(`Rollback "${p.name}" to previous version?`)) return;
    onRollbackHazardPackVersion?.(selectedPackId);
  };

  const compareSelectedPackVersionDiff = () => {
    if (!selectedPackId) return;
    const p = quickPacks.find((x) => x.id === selectedPackId);
    if (!p) return;
    const snap = Array.isArray(p.versionHistory) ? p.versionHistory[0] : null;
    if (!snap?.diff) {
      window.alert("No previous version diff available. Create at least one new version first.");
      return;
    }
    const lines = [
      `${p.name} — version diff`,
      `v${Math.max(1, Number(snap.version || 1))} -> v${Math.max(1, Number(p.version || 1))}`,
      `Added: ${Number(snap.diff.addedCount || 0)} | Changed: ${Number(snap.diff.changedCount || 0)} | Removed: ${Number(snap.diff.removedCount || 0)}`,
      "",
    ];
    const addedRows = Array.isArray(snap.diff.addedRows) ? snap.diff.addedRows.slice(0, 6) : [];
    const changedRows = Array.isArray(snap.diff.changedRows) ? snap.diff.changedRows.slice(0, 6) : [];
    const removedRows = Array.isArray(snap.diff.removedRows) ? snap.diff.removedRows.slice(0, 6) : [];
    if (addedRows.length > 0) {
      lines.push("Added activities:");
      addedRows.forEach((r) => lines.push(`+ ${r.activity || "Activity"} (${r.category || "General"})`));
      lines.push("");
    }
    if (changedRows.length > 0) {
      lines.push("Changed activities:");
      changedRows.forEach((r) => {
        lines.push(
          `~ ${r.activity || "Activity"}${r.risksChanged ? " [risk changed]" : ""}${(r.controlsAdded?.length || 0) > 0 ? ` [+${r.controlsAdded.length} controls]` : ""}${(r.controlsRemoved?.length || 0) > 0 ? ` [-${r.controlsRemoved.length} controls]` : ""}`
        );
      });
      lines.push("");
    }
    if (removedRows.length > 0) {
      lines.push("Removed activities:");
      removedRows.forEach((r) => lines.push(`- ${r.activity || "Activity"} (${r.category || "General"})`));
    }
    window.alert(lines.join("\n"));
  };

  const importPacksFromFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onImportHazardPacks?.(parsed);
      } catch (err) {
        window.alert(err?.message || "Could not import packs JSON.");
      }
    };
    reader.onerror = () => window.alert("Could not read packs file.");
    reader.readAsText(file);
  };

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>
        Select all activities that apply to this job. You can edit each one in the next step.
        <span style={{ marginLeft:8, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:"#E6F1FB", color:"#0C447C" }}>
          {selected.length} selected
        </span>
        {visibleNotSelectedCount > 0 && onAddAllVisible && (
          <button
            type="button"
            onClick={() => onAddAllVisible(results)}
            style={{ ...ss.btn, fontSize: 12, padding: "4px 12px", minHeight: 36, marginLeft: 4 }}
          >
            Add all visible ({visibleNotSelectedCount})
          </button>
        )}
        {favoritesNotSelectedCount > 0 && onAddAllVisible && (
          <button
            type="button"
            onClick={() => onAddAllVisible(sourceAll.filter((h) => favoriteIds.has(h.id)))}
            style={{ ...ss.btn, fontSize: 12, padding: "4px 12px", minHeight: 36, marginLeft: 4 }}
          >
            Add favorites ({favoritesNotSelectedCount})
          </button>
        )}
        {selected.length > 0 && onClearSelected && (
          <button type="button" onClick={onClearSelected} style={{ ...ss.btn, fontSize: 12, padding: "4px 12px", minHeight: 36, marginLeft: 4 }}>
            Clear selection
          </button>
        )}
      </div>

      <div style={{ ...ss.card, marginBottom:12, padding:12, border:"0.5px solid #dbeafe", background:"#f8fbff" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
            Quick packs (save your usual activity bundles)
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <input
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder="Pack name (e.g. PAS128 day)"
              style={{ ...ss.inp, minWidth: 180, maxWidth: 280 }}
            />
            <button type="button" onClick={saveSelectedAsPack} style={{ ...ss.btn, fontSize:12 }}>
              Save selected as pack
            </button>
            <button type="button" onClick={onImportFromLastProject} style={{ ...ss.btn, fontSize:12 }} title="Import activities from latest RAMS on the same project">
              Import from last project
            </button>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <select value={selectedPackId} onChange={(e) => setSelectedPackId(e.target.value)} style={{ ...ss.inp, minWidth:220, maxWidth:360 }}>
            <option value="">— Select saved quick pack —</option>
            {quickPacks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.isPinned ? "★ " : ""}{p.name} · v{Math.max(1, Number(p.version || 1))} ({(p.templates || []).length}) · {String(p.status || HAZARD_PACK_STATUS.CURRENT)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedPackId}
            onClick={() => {
              const p = quickPacks.find((x) => x.id === selectedPackId);
              if (p) onApplyHazardPack?.(p);
            }}
            style={{ ...ss.btnP, fontSize:12, opacity:selectedPackId ? 1 : 0.6 }}
          >
            Apply pack
          </button>
          <button type="button" disabled={!selectedPackId} onClick={renameSelectedPack} style={{ ...ss.btn, fontSize:12, opacity:selectedPackId?1:0.6 }}>
            Rename
          </button>
          <button type="button" disabled={!selectedPackId} onClick={togglePinSelectedPack} style={{ ...ss.btn, fontSize:12, opacity:selectedPackId?1:0.6 }}>
            {quickPacks.find((p) => p.id === selectedPackId)?.isPinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            disabled={!selectedPackId}
            onClick={() => {
              const p = quickPacks.find((x) => x.id === selectedPackId);
              if (!p) return;
              const nextStatus =
                String(p.status || HAZARD_PACK_STATUS.CURRENT) === HAZARD_PACK_STATUS.SUPERSEDED
                  ? HAZARD_PACK_STATUS.CURRENT
                  : HAZARD_PACK_STATUS.SUPERSEDED;
              onSetHazardPackStatus?.(selectedPackId, nextStatus);
            }}
            style={{ ...ss.btn, fontSize:12, opacity:selectedPackId?1:0.6 }}
          >
            {String(quickPacks.find((p) => p.id === selectedPackId)?.status || HAZARD_PACK_STATUS.CURRENT) === HAZARD_PACK_STATUS.SUPERSEDED
              ? "Mark current"
              : "Mark superseded"}
          </button>
          <button type="button" disabled={!selectedPackId} onClick={createNewVersionForSelectedPack} style={{ ...ss.btn, fontSize:12, opacity:selectedPackId?1:0.6 }}>
            Save new version
          </button>
          <button type="button" disabled={!selectedPackId} onClick={compareSelectedPackVersionDiff} style={{ ...ss.btn, fontSize:12, opacity:selectedPackId?1:0.6 }}>
            Compare diff
          </button>
          <button type="button" disabled={!selectedPackId} onClick={rollbackSelectedPack} style={{ ...ss.btn, fontSize:12, opacity:selectedPackId?1:0.6 }}>
            Rollback
          </button>
          <button type="button" disabled={!selectedPackId} onClick={deleteSelectedPack} style={{ ...ss.btn, fontSize:12, color:"#A32D2D", borderColor:"#F09595", opacity:selectedPackId?1:0.6 }}>
            Delete
          </button>
          <button type="button" onClick={onExportHazardPacks} style={{ ...ss.btn, fontSize:12 }}>
            Export packs
          </button>
          <input ref={importPackRef} type="file" accept="application/json,.json" style={{ display:"none" }} onChange={importPacksFromFile} />
          <button type="button" onClick={() => importPackRef.current?.click()} style={{ ...ss.btn, fontSize:12 }}>
            Import packs
          </button>
        </div>
        {selectedPackId && (() => {
          const p = quickPacks.find((x) => x.id === selectedPackId);
          if (!p) return null;
          const historyCount = Array.isArray(p.versionHistory) ? p.versionHistory.length : 0;
          const lastChange = p.updatedAt || p.createdAt;
          const latestSnapshot = Array.isArray(p.versionHistory) ? p.versionHistory[0] : null;
          const status = String(p.status || HAZARD_PACK_STATUS.CURRENT);
          return (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:11, color:"var(--color-text-tertiary,#64748b)" }}>
                Version <strong style={{ color:"var(--color-text-primary)" }}>v{Math.max(1, Number(p.version || 1))}</strong>
                {historyCount > 0 ? ` · ${historyCount} rollback point${historyCount !== 1 ? "s" : ""}` : " · no rollback points yet"}
                {lastChange ? ` · updated ${fmtDateTime(lastChange)}` : ""}
                <span
                  style={{
                    marginLeft: 8,
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: status === HAZARD_PACK_STATUS.SUPERSEDED ? "#FCEBEB" : "#EAF3DE",
                    color: status === HAZARD_PACK_STATUS.SUPERSEDED ? "#7F1D1D" : "#27500A",
                  }}
                >
                  {status}
                </span>
              </div>
              {latestSnapshot?.diff && (
                <div style={{ marginTop:6, fontSize:11, color:"#334155", lineHeight:1.4 }}>
                  Diff v{Math.max(1, Number(latestSnapshot.version || 1))} → v{Math.max(1, Number(p.version || 1))}:{" "}
                  +{Number(latestSnapshot.diff.addedCount || 0)} added ·
                  {" "}{Number(latestSnapshot.diff.changedCount || 0)} changed ·
                  {" "}{Number(latestSnapshot.diff.removedCount || 0)} removed
                </div>
              )}
              {latestSnapshot?.diff?.changedRows?.length > 0 && (
                <div style={{ marginTop:4, fontSize:11, color:"#475569" }}>
                  {(latestSnapshot.diff.changedRows || []).slice(0, 3).map((row) => (
                    <div key={`chg_${row.key}`}>
                      • {row.activity}
                      {row.controlsAdded?.length ? ` · +${row.controlsAdded.length} control(s)` : ""}
                      {row.controlsRemoved?.length ? ` · -${row.controlsRemoved.length} control(s)` : ""}
                      {row.risksChanged ? " · risk updated" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {recommendedPacks.length > 0 && (
        <div style={{ ...ss.card, marginBottom:12, padding:12, border:"0.5px solid #dbeafe", background:"linear-gradient(180deg,#f8fbff 0%, #ffffff 72%)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Recommended packs
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {recommendedPacks.map(({ pack, score, remaining, overlap }) => (
              <button
                key={`rec_${pack.id}`}
                type="button"
                onClick={() => onApplyHazardPack?.(pack)}
                style={{ ...ss.btn, fontSize:12, maxWidth:380, textAlign:"left", justifyContent:"flex-start", background:"#fff", boxShadow:"0 1px 6px rgba(15,23,42,0.08)" }}
                title={`Recommendation score: ${score}`}
              >
                {(pack.isPinned ? "★ " : "") + pack.name} · v{Math.max(1, Number(pack.version || 1))}
                <span style={{ marginLeft:6, color:"var(--color-text-tertiary,#64748b)" }}>
                  +{remaining} new · {overlap} already
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!search.trim() && activeCategory === "All" && quickFilter === "all" && topQuickTemplates.length > 0 && (
        <div style={{ ...ss.card, marginBottom:12, padding:12, border:"0.5px solid #dbeafe", background:"linear-gradient(180deg,#f8fbff 0%, #ffffff 72%)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            No-search quick picks
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {topQuickTemplates.map((h) => (
              <button
                key={`qp_${h.id}`}
                type="button"
                onClick={() => ensureAddHazard(h)}
                style={{ ...ss.btn, fontSize:12, maxWidth:320, textAlign:"left", justifyContent:"flex-start", background:"#fff", boxShadow:"0 1px 6px rgba(15,23,42,0.08)" }}
                title={h.hazard}
              >
                {favoriteIds.has(h.id) ? "★ " : ""}{h.activity}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom:12, padding:12, border:"0.5px solid #dbeafe", background:"#f8fbff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
            Organisation RAMS activities: <strong style={{ color:"var(--color-text-primary)" }}>{orgList.length}</strong>
          </div>
          <button type="button" onClick={() => setShowOrgForm((v) => !v)} style={{ ...ss.btn, fontSize:12 }}>
            {showOrgForm ? "Close custom activity form" : "+ Add organisation activity"}
          </button>
        </div>
        {showOrgForm && (
          <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:8 }}>
            <div>
              <label style={ss.lbl}>Category</label>
              <input value={orgDraft.category} onChange={(e)=>setOrgDraft((d)=>({ ...d, category:e.target.value }))} style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Activity *</label>
              <input value={orgDraft.activity} onChange={(e)=>setOrgDraft((d)=>({ ...d, activity:e.target.value }))} style={ss.inp} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Hazard *</label>
              <textarea value={orgDraft.hazard} onChange={(e)=>setOrgDraft((d)=>({ ...d, hazard:e.target.value }))} rows={2} style={ss.ta} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={ss.lbl}>Default controls (one per line or ; separated)</label>
              <textarea value={orgDraft.controls} onChange={(e)=>setOrgDraft((d)=>({ ...d, controls:e.target.value }))} rows={3} style={ss.ta} />
            </div>
            <div>
              <label style={ss.lbl}>PPE (comma or line separated)</label>
              <input value={orgDraft.ppe} onChange={(e)=>setOrgDraft((d)=>({ ...d, ppe:e.target.value }))} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Regulations (comma or line separated)</label>
              <input value={orgDraft.regs} onChange={(e)=>setOrgDraft((d)=>({ ...d, regs:e.target.value }))} style={ss.inp} />
            </div>
            <div>
              <label style={ss.lbl}>Initial L / S</label>
              <div style={{ display:"flex", gap:6 }}>
                <select value={orgDraft.initialL} onChange={(e)=>setOrgDraft((d)=>({ ...d, initialL:Number(e.target.value) }))} style={ss.inp}>{[2,4,6].map(v=><option key={`iL_${v}`} value={v}>{v}</option>)}</select>
                <select value={orgDraft.initialS} onChange={(e)=>setOrgDraft((d)=>({ ...d, initialS:Number(e.target.value) }))} style={ss.inp}>{[2,4,6].map(v=><option key={`iS_${v}`} value={v}>{v}</option>)}</select>
              </div>
            </div>
            <div>
              <label style={ss.lbl}>Residual L / S</label>
              <div style={{ display:"flex", gap:6 }}>
                <select value={orgDraft.revisedL} onChange={(e)=>setOrgDraft((d)=>({ ...d, revisedL:Number(e.target.value) }))} style={ss.inp}>{[2,4,6].map(v=><option key={`rL_${v}`} value={v}>{v}</option>)}</select>
                <select value={orgDraft.revisedS} onChange={(e)=>setOrgDraft((d)=>({ ...d, revisedS:Number(e.target.value) }))} style={ss.inp}>{[2,4,6].map(v=><option key={`rS_${v}`} value={v}>{v}</option>)}</select>
              </div>
            </div>
            <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button type="button" onClick={saveOrgTemplate} style={{ ...ss.btnP, fontSize:12 }}>Save organisation activity</button>
            </div>
          </div>
        )}
      </div>

      {/* search */}
      <div style={{ marginBottom:12 }}>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search activities… e.g. welding, height, electrical isolation"
          style={ss.inp}
          aria-label="Search hazard library"
        />
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)", marginTop: 6 }}>
          Showing {results.length} activit{results.length === 1 ? "y" : "ies"}
          {search.trim() ? ` for “${search.trim()}”` : activeCategory !== "All" ? ` in ${activeCategory}` : ""}
        </div>
      </div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
        {[
          ["all", "All"],
          ["favorites", "Favorites"],
          ["recent", "Recent"],
          ["most_used", "Most used"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setQuickFilter(id)}
            style={{
              ...ss.btn,
              fontSize: 12,
              minHeight: 34,
              background: quickFilter === id ? "#0f172a" : undefined,
              color: quickFilter === id ? "#fff" : undefined,
              borderColor: quickFilter === id ? "#0f172a" : undefined,
              boxShadow: quickFilter === id ? "0 2px 8px rgba(15,23,42,0.25)" : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* category tabs */}
      {!search && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:16 }}>
          {["All", ORG_ACTIVITY_CATEGORY, ...TRADE_CATEGORIES].map(c=>(
            <button key={c} type="button" onClick={()=>setActiveCategory(c)} style={{
              padding:"4px 10px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
              background:activeCategory===c?"#0f172a":"var(--color-background-secondary,#f7f7f5)",
              color:activeCategory===c?"#fff":"var(--color-text-secondary)",
              border:"0.5px solid var(--color-border-secondary,#ccc)",
            }}>
              {c}
              {c === "All"
                ? ` (${sourceAll.length})`
                : categoryCounts[c]
                ? ` (${categoryCounts[c]})`
                : ""}
            </button>
          ))}
        </div>
      )}

      {/* hazard list */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {results.map(h=>{
          const sel = selected.some(s=>s.id===h.id);
          const isOrg = !!h._orgTemplate || String(h.id || "").startsWith("org_");
          return (
            <div
              key={h.id}
              className="app-rams-hazard-row"
              role="button"
              tabIndex={0}
              onClick={() => onToggle(h)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(h);
                }
              }}
              style={{
                ...ss.card,
                cursor:"pointer",
                padding:"12px 14px",
                borderColor:sel?"#0d9488":"var(--color-border-tertiary,#e5e5e5)",
                background:sel?"linear-gradient(180deg,#f0fdf8 0%, #ecfdf5 100%)":"linear-gradient(180deg,var(--color-background-primary,#fff) 0%, #fbfdff 100%)",
                boxShadow: sel ? "0 4px 14px rgba(13,148,136,0.18)" : "0 2px 9px rgba(15,23,42,0.06)",
              }}
            >
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${sel?"#0d9488":"var(--color-border-secondary,#ccc)"}`, background:sel?"#0d9488":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  {sel && <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round"/></svg>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4, alignItems:"center" }}>
                    <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C", fontWeight:500 }}>{h.category}</span>
                    {isOrg && <span style={{ fontSize:10, padding:"1px 8px", borderRadius:20, background:"#ede9fe", color:"#4c1d95", fontWeight:700 }}>ORG</span>}
                    {favoriteIds.has(h.id) && <span style={{ fontSize:10, padding:"1px 8px", borderRadius:20, background:"#FEF3C7", color:"#92400E", fontWeight:700 }}>★</span>}
                    {Number(usageCounts[h.id] || 0) > 0 && (
                      <span style={{ fontSize:10, padding:"1px 8px", borderRadius:20, background:"#ECFEFF", color:"#0F766E", fontWeight:700 }}>
                        used {Number(usageCounts[h.id] || 0)}
                      </span>
                    )}
                    <RiskBadge rf={h.initialRisk.RF} />
                  </div>
                  <div style={{ fontWeight:500, fontSize:13, marginBottom:2 }}>{h.activity}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{h.hazard}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>
                    {h.controlMeasures.length} control measures · PPE: {(h.ppeRequired || []).slice(0,3).join(", ")}{(h.ppeRequired || []).length>3?`…`:""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHazardFavorite?.(h.id);
                  }}
                  style={{ ...ss.btn, padding:"4px 8px", fontSize:12 }}
                  title="Add/remove from hazard favorites"
                >
                  {favoriteIds.has(h.id) ? "★" : "☆"}
                </button>
                {isOrg && onDeleteOrgActivity && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOrgActivity(h.id);
                    }}
                    style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}
                    title="Delete organisation activity template"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {results.length===0 && <div style={{ textAlign:"center", padding:"2rem", color:"var(--color-text-secondary)", fontSize:13 }}>No hazards match your search.</div>}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button type="button" onClick={onBack} style={ss.btn}>← Back</button>
        <button type="button" disabled={selected.length===0} onClick={onNext} style={{ ...ss.btnP, opacity:selected.length>0?1:0.4 }}>
          Next — review & edit ({selected.length}) →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Review / edit each row ────────────────────────────────────────
function HazardEditor({ rows, setRows, onNext, onBack }) {
  const [editing, setEditing] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  const [rowFilter, setRowFilter] = useState("");

  const filteredRows = useMemo(() => {
    const q = rowFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.activity || "")
          .toLowerCase()
          .includes(q) ||
        String(r.hazard || "")
          .toLowerCase()
          .includes(q) ||
        String(r.category || "")
          .toLowerCase()
          .includes(q)
    );
  }, [rows, rowFilter]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (expandAll) setExpandAll(false);
      else if (editing != null) setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandAll, editing]);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, [field]:value} : r));
  };

  const updateControl = (id, idx, value) => {
    setRows(prev => prev.map(r => {
      if (r.id!==id) return r;
      const cms = [...r.controlMeasures];
      cms[idx] = value;
      return {...r, controlMeasures:cms};
    }));
  };

  const addControl = (id) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, controlMeasures:[...r.controlMeasures,""]} : r));
  };

  const removeControl = (id, idx) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, controlMeasures:r.controlMeasures.filter((_,i)=>i!==idx)} : r));
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id!==id));

  const autoTailorRowControls = (id) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const tailored = buildTailoredControlsForRow(r);
        return { ...r, controlMeasures: mergeTailoredControls(r.controlMeasures, tailored) };
      })
    );
  };

  const autoTailorAllControls = () => {
    setRows((prev) =>
      prev.map((r) => {
        const tailored = buildTailoredControlsForRow(r);
        return { ...r, controlMeasures: mergeTailoredControls(r.controlMeasures, tailored) };
      })
    );
  };

  const duplicateRow = (id) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const r = prev[idx];
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = genId();
      const arr = [...prev];
      arr.splice(idx + 1, 0, copy);
      return arr;
    });
    setExpandAll(false);
    setEditing(null);
  };

  const moveRow = (id, dir) => {
    setRows(prev => {
      const idx = prev.findIndex(r=>r.id===id);
      const next = idx + dir;
      if (next<0||next>=prev.length) return prev;
      const arr = [...prev];
      [arr[idx],arr[next]] = [arr[next],arr[idx]];
      return arr;
    });
  };

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:12 }}>
        Review and edit each hazard row. Adjust control measures, risk scores and PPE to match your specific job.
        <span style={{ display: "block", fontSize: 12, color: "var(--color-text-tertiary, #94a3b8)", marginTop: 6 }}>
          Tip: press <kbd style={{ padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary)", fontSize: 11 }}>Esc</kbd> to close an open row or exit &quot;expand all&quot;.
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button type="button" onClick={() => { setExpandAll(true); setEditing(null); }} style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
          Expand all rows
        </button>
        <button type="button" onClick={() => { setExpandAll(false); setEditing(null); }} style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
          Collapse all
        </button>
        <button
          type="button"
          onClick={autoTailorAllControls}
          style={{ ...ss.btnP, fontSize: 12, padding: "6px 12px", minHeight: 36 }}
          title="Generates tailored control measures for every risk row and merges without duplicates"
        >
          Auto-tailor controls (all rows)
        </button>
        {rows.length > 3 && (
          <div style={{ flex: "1 1 220px", minWidth: 0, maxWidth: 420 }}>
            <input
              id="rams-row-filter"
              type="search"
              value={rowFilter}
              onChange={(e) => setRowFilter(e.target.value)}
              placeholder="Filter rows by activity, hazard, category…"
              style={{ ...ss.inp, fontSize: 12, padding: "8px 12px", minHeight: 40 }}
              aria-label="Filter hazard rows"
            />
            {rowFilter.trim() && (
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)", marginTop: 4 }}>
                Showing {filteredRows.length} of {rows.length} rows
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom:20 }}>
        {filteredRows.length === 0 && rowFilter.trim() ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--color-text-secondary)", fontSize: 13 }}>
            No hazard rows match &quot;{rowFilter.trim()}&quot;. Clear the filter to see all rows.
          </div>
        ) : null}
        {filteredRows.map((r) => {
          const idx = rows.findIndex((x) => x.id === r.id);
          const isOpen = expandAll || editing === r.id;
          return (
            <div key={r.id} style={{ ...ss.card, marginBottom:8, borderColor:isOpen?"#0d9488":"var(--color-border-tertiary,#e5e5e5)" }}>
              {/* collapsed header */}
              <div
                style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer" }}
                onClick={() => {
                  if (expandAll) {
                    setExpandAll(false);
                    setEditing(r.id);
                  } else {
                    setEditing(editing === r.id ? null : r.id);
                  }
                }}
              >
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>{r.category}</span>
                    <RiskBadge rf={r.initialRisk.RF} />
                    <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>→</span>
                    <RiskBadge rf={r.revisedRisk.RF} />
                  </div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{r.activity}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>{r.hazard}</div>
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <button type="button" onClick={e=>{e.stopPropagation();moveRow(r.id,-1);}} disabled={idx===0} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:idx===0?0.3:1 }}>↑</button>
                  <button type="button" onClick={e=>{e.stopPropagation();moveRow(r.id,1);}} disabled={idx===rows.length-1} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:idx===rows.length-1?0.3:1 }}>↓</button>
                  <button type="button" onClick={e=>{e.stopPropagation();duplicateRow(r.id);}} style={{ ...ss.btn, padding:"3px 8px", fontSize:11 }} title="Duplicate this hazard row">
                    Dup
                  </button>
                  <button type="button" onClick={e=>{e.stopPropagation();removeRow(r.id);}} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                  <button type="button" onClick={e=>{e.stopPropagation(); if (expandAll) setExpandAll(false); setEditing(editing===r.id?null:r.id);}} style={{ ...ss.btn, padding:"3px 10px", fontSize:11, background:isOpen?"var(--color-background-secondary,#f7f7f5)":"transparent" }}>
                    {isOpen?"Done":"Edit"}
                  </button>
                </div>
              </div>

              {/* expanded editor */}
              {isOpen && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
                    <div>
                      <label style={ss.lbl}>Activity</label>
                      <input value={r.activity} onChange={e=>updateRow(r.id,"activity",e.target.value)} style={ss.inp} />
                    </div>
                    <div>
                      <label style={ss.lbl}>Hazard / additional hazard</label>
                      <input value={r.hazard} onChange={e=>updateRow(r.id,"hazard",e.target.value)} style={ss.inp} />
                    </div>
                  </div>

                  {/* risk matrix */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:12, marginBottom:12 }}>
                    <div style={{ padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Initial risk (before controls)</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
                        {[["L","Likelihood (H=6 M=4 L=2)","initialRisk"],["S","Severity (Fatal=6 Major=4 Minor=2)","initialRisk"]].map(([k,hint,obj])=>(
                          <div key={k}>
                            <label style={{ ...ss.lbl, marginBottom:2 }}>{k} <span style={{ fontWeight:400 }}>({hint})</span></label>
                            <select value={r[obj][k]} onChange={e=>updateRow(r.id,obj,{...r[obj],[k]:parseInt(e.target.value),RF:parseInt(e.target.value)*(k==="L"?r[obj].S:r[obj].L)})} style={{ ...ss.inp, width:"auto" }}>
                              {[2,4,6].map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, fontSize:12 }}>RF = {r.initialRisk.L} × {r.initialRisk.S} = <strong>{r.initialRisk.L*r.initialRisk.S}</strong> <RiskBadge rf={r.initialRisk.L*r.initialRisk.S} /></div>
                    </div>
                    <div style={{ padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Revised risk (after controls)</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
                        {[["L","Likelihood","revisedRisk"],["S","Severity","revisedRisk"]].map(([k,hint,obj])=>(
                          <div key={k}>
                            <label style={{ ...ss.lbl, marginBottom:2 }}>{k}</label>
                            <select value={r[obj][k]} onChange={e=>updateRow(r.id,obj,{...r[obj],[k]:parseInt(e.target.value),RF:parseInt(e.target.value)*(k==="L"?r[obj].S:r[obj].L)})} style={{ ...ss.inp, width:"auto" }}>
                              {[2,4,6].map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, fontSize:12 }}>RF = {r.revisedRisk.L} × {r.revisedRisk.S} = <strong>{r.revisedRisk.L*r.revisedRisk.S}</strong> <RiskBadge rf={r.revisedRisk.L*r.revisedRisk.S} /></div>
                    </div>
                  </div>

                  {/* control measures */}
                  <div style={{ marginBottom:12 }}>
                    <label style={ss.lbl}>Control measures</label>
                    {r.controlMeasures.map((cm,i)=>(
                      <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"flex-start" }}>
                        <span style={{ fontSize:12, color:"var(--color-text-secondary)", paddingTop:9, minWidth:16, textAlign:"right" }}>{i+1}.</span>
                        <textarea value={cm} onChange={e=>updateControl(r.id,i,e.target.value)} rows={2}
                          style={{ ...ss.ta, flex:1, minHeight:40 }} />
                        <button type="button" onClick={()=>removeControl(r.id,i)} style={{ ...ss.btn, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595", flexShrink:0, marginTop:4 }}>×</button>
                      </div>
                    ))}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                      <button type="button" onClick={()=>addControl(r.id)} style={{ ...ss.btn, fontSize:12 }}>+ Add control measure</button>
                      <button
                        type="button"
                        onClick={() => autoTailorRowControls(r.id)}
                        style={{ ...ss.btnP, fontSize:12 }}
                        title="Generate tailored controls for this specific risk row"
                      >
                        Auto-tailor this risk
                      </button>
                    </div>
                  </div>

                  {/* PPE */}
                  <div>
                    <label style={ss.lbl}>PPE required</label>
                    <input value={(r.ppeRequired||[]).join(", ")}
                      onChange={e=>updateRow(r.id,"ppeRequired",e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
                      placeholder="e.g. Hard hat, Safety glasses, Gloves" style={ss.inp} />
                    <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>Comma-separated list</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button type="button" onClick={onBack} style={ss.btn}>← Back</button>
        <button type="button" onClick={onNext} style={ss.btnP}>Next — preview & save →</button>
      </div>
    </div>
  );
}

// ─── Step 4 — Preview & save ─────────────────────────────────────────────────
function PreviewSave({ form, setForm, rows, workers, projects, editingDoc, onSave, onBack }) {
  const [fpCopied, setFpCopied] = useState(false);
  const [briefCopied, setBriefCopied] = useState(false);
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const operatives = (form.operativeIds||[]).map(id=>workerMap[id]).filter(Boolean);
  const selectedWorkers = (form.operativeIds || []).map((id) => workers.find((w) => w.id === id)).filter(Boolean);
  const printFlags = normalizePrintSections(form.printSections);

  const previewFingerprint = computeRamsFingerprint(form, rows);

  const copyFingerprint = () => {
    navigator.clipboard?.writeText(previewFingerprint).then(() => {
      setFpCopied(true);
      setTimeout(() => setFpCopied(false), 2000);
    }).catch(() => {});
  };

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(previewAnchorId(sectionId));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const togglePrintSection = (id, checked) => {
    setForm((f) => ({ ...f, printSections: { ...f.printSections, [id]: checked } }));
  };

  const printRAMS = () => {
    openRamsDocumentWindow(form, rows, workers, projects, { print: true });
  };
  const quickQrSrc = (text, size = 126) =>
    `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(String(text || ""))}`;
  const liveShareUrl =
    typeof window !== "undefined" && String(form.shareToken || "").trim()
      ? `${window.location.origin}${window.location.pathname}?ramsShare=${encodeURIComponent(form.shareToken)}`
      : "";
  const emergencyQuickUrl =
    safeHttpUrl(form.hospitalDirectionsUrl) ||
    safeHttpUrl(form.siteMapUrl) ||
    (form.location?.trim() ? googleMapsSearchUrl(form.location) : "");
  const primaryQrText =
    liveShareUrl ||
    `RAMS ${form.documentNo || "NO-DOC"} | ${form.title || "Untitled"} | Rev ${form.revision || "1A"} | ${String(
      form.documentStatus || "draft"
    ).replace(/_/g, " ")}`;
  const emergencyQrText =
    emergencyQuickUrl ||
    `Emergency quick card | ${form.location || "Site"} | Hospital ${form.nearestHospital || "See RAMS section 4"}`;
  const applyAutoSign = (type) => {
    if (type === "approved") {
      setForm((f) => ({
        ...f,
        approvedBy: String(f.approvedBy || "").trim() || String(f.leadEngineer || "").trim() || "Site Manager",
        approvalDate: String(f.approvalDate || "").trim() || today(),
        signatureEvents: appendSignatureEvent(
          f.signatureEvents,
          {
            action: "approval_signed",
            actor: String(f.approvedBy || "").trim() || String(f.leadEngineer || "").trim() || "Site Manager",
            role: "approver",
            status: String(f.documentStatus || "draft"),
            revision: f.revision || "1A",
            note: "Approval fields auto-completed from preview shortcut.",
          },
          (x) => x.action === "approval_signed" && String(x.revision || "") === String(f.revision || "1A")
        ),
      }));
      return;
    }
    if (type === "issue") {
      setForm((f) => ({
        ...f,
        issueDate: String(f.issueDate || "").trim() || today(),
        documentStatus: f.documentStatus === "draft" ? "internal_review" : f.documentStatus,
        signatureEvents: appendSignatureEvent(
          f.signatureEvents,
          {
            action: "issue_stamp",
            actor: String(f.leadEngineer || "").trim() || "Document controller",
            role: "issuer",
            status: String(f.documentStatus === "draft" ? "internal_review" : f.documentStatus || "draft"),
            revision: f.revision || "1A",
            note: "Issue date stamped from preview shortcut.",
          },
          (x) => x.action === "issue_stamp" && String(x.revision || "") === String(f.revision || "1A")
        ),
      }));
    }
  };

  const tocItems = RAMS_PRINT_SECTIONS.filter((s) => {
    if (s.id === RAMS_SECTION_IDS.COVER) return true;
    if (s.id === RAMS_SECTION_IDS.WEATHER) return !!(form.siteWeatherNote || "").trim();
    if (s.id === RAMS_SECTION_IDS.MAP) return !!(form.siteMapUrl || "").trim() || !!(form.siteLat && form.siteLng);
    if (s.id === RAMS_SECTION_IDS.HOSPITAL) return !!(form.nearestHospital || "").trim() || !!(form.hospitalDirectionsUrl || "").trim();
    if (s.id === RAMS_SECTION_IDS.OPERATIVE_CERTS) return selectedWorkers.length > 0 && printFlags[RAMS_SECTION_IDS.OPERATIVE_CERTS] === true;
    if (s.id === RAMS_SECTION_IDS.HAZARDS) return rows.length > 0;
    if (s.id === RAMS_SECTION_IDS.SIGNATURES) return operatives.length > 0;
    if (s.id === RAMS_SECTION_IDS.INTEGRITY) return true;
    return true;
  });

  const highResidual = rows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
  const medResidual = rows.filter((r) => getRiskLevel(r.revisedRisk) === "medium").length;
  const lowResidual = rows.filter((r) => getRiskLevel(r.revisedRisk) === "low").length;
  const highInitial = rows.filter((r) => getRiskLevel(r.initialRisk) === "high").length;
  const ppeRollup = Array.from(
    new Set(
      rows
        .flatMap((r) => r.ppeRequired || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const regsRollup = Array.from(
    new Set(
      rows
        .flatMap((r) => r.regs || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const matrixCounts = buildRiskMatrixCounts(rows, "revisedRisk");
  const readiness = computeRamsReadiness(rows, operatives.length);
  const qaChecks = buildQaChecklist(form, rows, operatives.length);
  const qaPass = qaChecks.filter((x) => x.ok).length;
  const qaPct = qaChecks.length ? Math.round((qaPass / qaChecks.length) * 100) : 0;
  const briefingPoints = [...rows]
    .sort((a, b) => riskScore(b.revisedRisk) - riskScore(a.revisedRisk))
    .slice(0, 5)
    .map((r, idx) => ({
      id: r.id || `bp_${idx}`,
      text: `${r.activity || "Activity"} — ${r.hazard || "Hazard"} · controls: ${(r.controlMeasures || []).slice(0, 2).join("; ") || "review controls before start"}`,
      rf: riskScore(r.revisedRisk),
    }));
  const toolboxBriefV2 = buildToolboxBriefV2(rows, form);
  const categoryTrend = buildCategoryRiskTrend(rows);
  const detailedControlPack = buildDetailedControlMethodPack(rows);
  const controlAssurance = buildControlAssuranceSummary(detailedControlPack);
  const handoverChecks = [
    { label: "RAMS document shared with client/receiver", ok: !!String(form.handoverClientName || "").trim() && !!String(form.handoverReceiver || "").trim() },
    { label: "Issue date and status communicated", ok: !!String(form.issueDate || "").trim() && !!String(form.documentStatus || "").trim() },
    { label: "Residual risk briefing completed", ok: highResidual === 0 || !!String(form.handoverNotes || "").trim() },
    { label: "Emergency route and permit interface confirmed", ok: !!String(form.hospitalDirectionsUrl || "").trim() || !!String(form.projectId || "").trim() },
  ];
  const competencyAlerts = selectedWorkers
    .flatMap((w) =>
      (w.certifications || []).map((c) => {
        const expiry = getCertificationExpiryState(c?.expiryDate);
        return {
          worker: w.name || w.id,
          cert: c?.certType || "Certification",
          expiryDate: c?.expiryDate,
          ...expiry,
        };
      })
    )
    .filter((x) => x.state === "expired" || x.state === "due")
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  const competencyRequirementCheck = buildCompetencyRequirementCheck(form.surveyRequiredCerts, selectedWorkers);
  const avgReduction =
    rows.length > 0
      ? Math.round(
          rows.reduce((acc, r) => {
            const before = Math.max(1, riskScore(r.initialRisk));
            const after = Math.max(0, riskScore(r.revisedRisk));
            return acc + Math.max(0, ((before - after) / before) * 100);
          }, 0) / rows.length
        )
      : 0;
  const statusStyles = {
    draft: { bg: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-secondary)" },
    internal_review: { bg: "#E6F1FB", color: "#0C447C" },
    approved: { bg: "#EAF3DE", color: "#27500A" },
    issued: { bg: "#FAEEDA", color: "#633806" },
  };
  const statusKey = String(form.documentStatus || "draft");
  const statusTone = statusStyles[statusKey] || statusStyles.draft;
  const issueBlockedByCompetency = statusKey === "issued" && competencyRequirementCheck.blocked;
  const toolboxBriefText = [
    "AUTO-TOOLBOX BRIEF V2",
    `Doc: ${form.documentNo || "—"} | Rev: ${form.revision || "—"} | Status: ${String(form.documentStatus || "draft").replace(/_/g, " ")}`,
    `Location: ${form.location || "—"} | Lead: ${form.leadEngineer || "—"} | Date: ${fmtDate(form.issueDate || form.date)}`,
    "",
    "Must-brief points:",
    ...toolboxBriefV2.mustBriefPoints.map((p, i) => `${i + 1}. ${p}`),
    "",
    "Dynamic risk priorities:",
    ...(toolboxBriefV2.topRisks.length
      ? toolboxBriefV2.topRisks.map((r, i) => `${i + 1}. RF ${r.rf} — ${r.activity} (${r.hazard})${r.controls.length ? ` | controls: ${r.controls.join("; ")}` : ""}`)
      : ["1. No risk rows selected yet."]),
  ].join("\n");
  const copyToolboxBrief = () => {
    navigator.clipboard?.writeText(toolboxBriefText).then(() => {
      setBriefCopied(true);
      setTimeout(() => setBriefCopied(false), 1800);
    }).catch(() => {});
  };
  const liveChangeSummary = editingDoc ? buildChangeSummary(editingDoc, form, rows) : "";
  const signatureEvents = Array.isArray(form.signatureEvents)
    ? [...form.signatureEvents]
        .filter((x) => x && x.action)
        .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    : [];

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:12 }}>
        Review your completed RAMS before saving. Use the table of contents to jump within the preview; toggles control what appears in print.
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 14,
          fontSize: 13,
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: "var(--radius-md, 12px)",
          background: "var(--color-background-secondary, #f8fafc)",
          border: "1px solid var(--color-border-tertiary)",
        }}
      >
        <span>
          <strong style={{ color: "var(--color-text-primary)" }}>{rows.length}</strong> hazard rows
        </span>
        <span>
          <strong style={{ color: "#791F1F" }}>{highResidual}</strong> high residual
        </span>
        <span>
          <strong style={{ color: "#633806" }}>{medResidual}</strong> medium residual
        </span>
        <span>
          <strong style={{ color: "var(--color-text-primary)" }}>{operatives.length}</strong> operatives (signatures)
        </span>
      </div>

      <div style={{ ...ss.card, marginBottom: 14, padding: 12, border: "0.5px solid #c7d2fe", background: "linear-gradient(180deg,#f8fbff 0%, #ffffff 65%)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Executive readiness dashboard
          </div>
          <span style={{ padding:"3px 10px", borderRadius:999, fontSize:12, fontWeight:700, background:"#E6F1FB", color:"#0C447C" }}>
            Grade {readiness.grade} · {readiness.score}/100
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(120px, 100%), 1fr))", gap:8, marginBottom:10 }}>
          {[
            ["Rows", rows.length],
            ["Avg reduction", `${avgReduction}%`],
            ["High residual", highResidual],
            ["Controls", rows.reduce((a, r) => a + (r.controlMeasures || []).filter(Boolean).length, 0)],
            ["Operatives", operatives.length],
          ].map(([k, v]) => (
            <div key={k} style={{ border:"0.5px solid var(--color-border-tertiary,#d7dee7)", borderRadius:8, padding:"8px 10px", background:"#fff" }}>
              <div style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>{k}</div>
              <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
          {readiness.summary}
        </div>
      </div>

      {editingDoc && (
        <div style={{ ...ss.card, marginBottom: 14, padding: 12, border: "0.5px solid #dbeafe", background:"#f8fbff" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Change impact vs previous revision
          </div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
            {liveChangeSummary || "No material changes detected."}
          </div>
          <div style={{ marginTop:6, fontSize:11, color:"#0C447C" }}>
            Previous revision: {editingDoc.revision || "—"} · Current: {form.revision || "—"}
          </div>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom: 14, padding: 12, border: "0.5px solid #dbeafe", background: "#f8fbff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", textTransform:"uppercase", letterSpacing:"0.05em" }}>
            QA readiness checklist
          </div>
          <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:"#E6F1FB", color:"#0C447C" }}>
            {qaPass}/{qaChecks.length} checks · {qaPct}%
          </span>
        </div>
        <div style={{ height:8, borderRadius:999, overflow:"hidden", border:"0.5px solid #d6dce5", marginBottom:10, background:"#fff" }}>
          <div style={{ width:`${qaPct}%`, height:"100%", background: qaPct >= 84 ? "#1D9E75" : qaPct >= 60 ? "#EF9F27" : "#E24B4A", transition:"width 180ms ease" }} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {qaChecks.map((c) => (
            <div key={c.label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
              <span style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: c.ok ? "#EAF3DE" : "#FCEBEB",
                color: c.ok ? "#27500A" : "#791F1F",
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}>
                {c.ok ? "✓" : "!"}
              </span>
              <span style={{ color: c.ok ? "var(--color-text-primary)" : "#7F1D1D" }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...ss.card, marginBottom: 14, padding: 12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Auto-toolbox brief v2 (1-page)
          </div>
          <button type="button" onClick={copyToolboxBrief} style={{ ...ss.btn, fontSize:11, minHeight:30, padding:"4px 10px" }}>
            {briefCopied ? "Brief copied" : "Copy brief text"}
          </button>
        </div>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>
          {toolboxBriefV2.headline}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10, marginBottom:10 }}>
          <div style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px", background:"#fff" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6 }}>Must-brief points</div>
            <ul style={{ margin:0, paddingLeft:16, display:"flex", flexDirection:"column", gap:4 }}>
              {toolboxBriefV2.mustBriefPoints.map((point) => (
                <li key={point} style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{point}</li>
              ))}
            </ul>
          </div>
          <div style={{ border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px", background:"#fff" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6 }}>Dynamic risk priorities</div>
            {toolboxBriefV2.topRisks.length === 0 ? (
              <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No risk rows yet.</div>
            ) : (
              <ol style={{ margin:0, paddingLeft:18, display:"flex", flexDirection:"column", gap:5 }}>
                {toolboxBriefV2.topRisks.map((item) => (
                  <li key={item.id} style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.4 }}>
                    <strong style={{ color:"var(--color-text-primary)" }}>RF {item.rf}</strong> — {item.activity} ({item.hazard})
                    {item.controls.length ? ` · controls: ${item.controls.join("; ")}` : ""}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        {briefingPoints.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No risk rows yet — add hazards to generate briefing points.</div>
        ) : (
          <ol style={{ margin:0, paddingLeft:18, display:"flex", flexDirection:"column", gap:6 }}>
            {briefingPoints.map((p) => (
              <li key={p.id} style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                <strong style={{ color:"var(--color-text-primary)" }}>RF {p.rf}</strong> — {p.text}
              </li>
            ))}
          </ol>
        )}
      </div>

      {categoryTrend.length > 0 && (
        <div style={{ ...ss.card, marginBottom: 14, padding: 12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Category risk trend (before vs after)
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {categoryTrend.map((c) => {
              const widthBefore = Math.min(100, (c.initialAvg / 36) * 100);
              const widthAfter = Math.min(100, (c.residualAvg / 36) * 100);
              return (
                <div key={c.category} style={{ border:"0.5px solid var(--color-border-tertiary,#dbe2ea)", borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{c.category}</span>
                    <span style={{ fontSize:11, color:"#0C447C" }}>rows {c.count} · reduction {c.reductionAvg}%</span>
                  </div>
                  <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Initial avg RF {c.initialAvg}</div>
                  <div style={{ height:6, borderRadius:999, background:"#fee2e2", overflow:"hidden", marginBottom:6 }}>
                    <div style={{ width:`${widthBefore}%`, height:"100%", background:"#ef4444" }} />
                  </div>
                  <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Residual avg RF {c.residualAvg}</div>
                  <div style={{ height:6, borderRadius:999, background:"#dcfce7", overflow:"hidden" }}>
                    <div style={{ width:`${widthAfter}%`, height:"100%", background:"#16a34a" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom: 14, padding: 12, border:"0.5px solid #e2e8f0" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
          Quick actions (site use)
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {(form.hospitalDirectionsUrl || "").trim() && (
            <a href={safeHttpUrl(form.hospitalDirectionsUrl) || "#"} target="_blank" rel="noopener noreferrer" style={{ ...ss.btn, fontSize:12, textDecoration:"none" }}>
              Emergency route
            </a>
          )}
          {form.location?.trim() && (
            <a href={googleMapsSearchUrl(form.location)} target="_blank" rel="noopener noreferrer" style={{ ...ss.btn, fontSize:12, textDecoration:"none" }}>
              Site location
            </a>
          )}
          <span style={{ ...ss.btn, fontSize:12, cursor:"default", background:"#f8fafc" }}>
            Stop-work authority: {form.leadEngineer || "Set in Document info"}
          </span>
          <span style={{ ...ss.btn, fontSize:12, cursor:"default", background:"#f8fafc" }}>
            Permit interface: {form.projectId ? projectMap[form.projectId] || "Project selected" : "Assign project"}
          </span>
        </div>
      </div>

      <div style={{ ...ss.card, marginBottom: 14, padding: 12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
          QR quick access and signature shortcuts
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:10 }}>
          <div style={{ border:"0.5px solid var(--color-border-tertiary,#dbe2ea)", borderRadius:10, padding:8, background:"#fff" }}>
            <img src={quickQrSrc(primaryQrText)} width={96} height={96} alt="RAMS live quick access QR" style={{ display:"block", borderRadius:6 }} />
            <div style={{ marginTop:6, fontSize:10, color:"var(--color-text-secondary)", maxWidth:120 }}>
              Live RAMS / latest copy
            </div>
          </div>
          <div style={{ border:"0.5px solid var(--color-border-tertiary,#dbe2ea)", borderRadius:10, padding:8, background:"#fff" }}>
            <img src={quickQrSrc(emergencyQrText)} width={96} height={96} alt="Emergency quick card QR" style={{ display:"block", borderRadius:6 }} />
            <div style={{ marginTop:6, fontSize:10, color:"var(--color-text-secondary)", maxWidth:120 }}>
              Emergency quick card
            </div>
          </div>
          <div style={{ minWidth:220, flex:"1 1 220px", fontSize:12, color:"var(--color-text-secondary)" }}>
            {liveShareUrl ? (
              <div style={{ marginBottom:6 }}>
                Share URL:{" "}
                <a href={liveShareUrl} target="_blank" rel="noopener noreferrer" style={{ color:"#0d9488", wordBreak:"break-all" }}>
                  {liveShareUrl}
                </a>
              </div>
            ) : (
              <div style={{ marginBottom:6 }}>No share token yet. QR still includes document metadata for printed verification.</div>
            )}
            <div style={{ marginBottom:8 }}>Tip: place this page on top of printed pack for fast mobile access.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button type="button" onClick={() => applyAutoSign("approved")} style={{ ...ss.btn, fontSize:12 }}>
                Auto-sign approval
              </button>
              <button type="button" onClick={() => applyAutoSign("issue")} style={{ ...ss.btn, fontSize:12 }}>
                Stamp issue date
              </button>
            </div>
          </div>
        </div>
      </div>

      {(ppeRollup.length > 0 || regsRollup.length > 0) && (
        <div style={{ ...ss.card, marginBottom: 14, padding: 12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            PPE and legal references pack
          </div>
          {ppeRollup.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>PPE roll-up ({ppeRollup.length})</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {ppeRollup.map((p) => (
                  <span key={p} style={{ padding:"2px 10px", borderRadius:999, fontSize:11, background:"#EAF3DE", color:"#27500A", border:"0.5px solid #cfe7c4" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          {regsRollup.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>Regulatory references ({regsRollup.length})</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {regsRollup.map((r) => (
                  <div key={r} style={{ fontSize:12, color:"var(--color-text-secondary)" }}>• {r}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {competencyRequirementCheck.required.length > 0 && (
        <div
          style={{
            ...ss.card,
            marginBottom: 14,
            padding: 12,
            border: competencyRequirementCheck.blocked ? "0.5px solid #fecaca" : "0.5px solid #bbf7d0",
            background: competencyRequirementCheck.blocked ? "#fff7f7" : "#f0fdf4",
          }}
        >
          <div style={{ fontSize:11, fontWeight:700, color:competencyRequirementCheck.blocked ? "#7F1D1D" : "#14532d", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Competency hard-stop check
          </div>
          <div style={{ fontSize:12, color:competencyRequirementCheck.blocked ? "#7F1D1D" : "#166534", marginBottom:6 }}>
            Required competencies configured: {competencyRequirementCheck.required.length}
            {competencyRequirementCheck.blocked
              ? ` · missing ${competencyRequirementCheck.missing.length} requirement(s) for selected team`
              : " · all requirements covered by selected team"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {competencyRequirementCheck.required.map((req) => {
              const hit = competencyRequirementCheck.matched.find((m) => m.requirement === req);
              const miss = competencyRequirementCheck.missing.find((m) => m.requirement === req);
              const ok = !!hit && !miss;
              const expiredOnly = Array.isArray(miss?.expiredWorkers) ? miss.expiredWorkers : [];
              const names = ok
                ? hit.matchedWorkers.join(", ")
                : expiredOnly.length > 0
                ? `Only expired: ${expiredOnly.join(", ")}`
                : "Missing in selected operatives";
              return (
                <div key={req} style={{ fontSize:12, color: ok ? "#14532d" : "#7F1D1D" }}>
                  {ok ? "✓" : "!"} <strong>{req}</strong> — {names}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {competencyAlerts.length > 0 && (
        <div style={{ ...ss.card, marginBottom: 14, padding: 12, border:"0.5px solid #fecaca", background:"#fff7f7" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#7F1D1D", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Competency expiry alerts
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {competencyAlerts.slice(0, 10).map((a, idx) => (
              <div key={`${a.worker}_${a.cert}_${idx}`} style={{ fontSize:12, color:"#7F1D1D" }}>
                <strong>{a.worker}</strong> — {a.cert} ({a.expiryDate ? fmtDate(a.expiryDate) : "no expiry"})
                {a.state === "expired" ? " · expired" : ` · due in ${a.days} day(s)`}
              </div>
            ))}
          </div>
        </div>
      )}

      {highResidual > 0 && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: "var(--radius-md, 12px)",
            border: "1px solid #F5C2C2",
            background: "#FEF2F2",
            color: "#7F1D1D",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <span>
            <strong>High residual risk:</strong> {highResidual} row{highResidual !== 1 ? "s" : ""} still rated{" "}
            <strong>HIGH</strong> after controls — review likelihood/severity and additional controls before issue.
          </span>
          <button
            type="button"
            onClick={() => scrollToSection(RAMS_SECTION_IDS.HAZARDS)}
            style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36, flexShrink: 0 }}
          >
            Jump to risks in preview
          </button>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom:14, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>Table of contents</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {tocItems.map((s) => (
            <button key={s.id} type="button" onClick={() => scrollToSection(s.id)} style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32 }}>
              {s.short}
            </button>
          ))}
        </div>
        <div style={{ marginTop:12, fontSize:11, color:"var(--color-text-secondary)" }}>
          Include in print:
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:6, alignItems:"center" }}>
          {RAMS_PRINT_SECTIONS.filter((x) => !x.locked).map((s) => (
            <label key={s.id} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer" }}>
              <input
                type="checkbox"
                checked={isSectionIncluded(s, printFlags)}
                onChange={(e) => togglePrintSection(s.id, e.target.checked)}
                style={{ accentColor:"#0d9488", width:14, height:14 }}
              />
              {s.short}
            </label>
          ))}
        </div>
      </div>

      {/* preview card */}
      <div style={{ ...ss.card, marginBottom:20, border:"0.5px solid #9FE1CB", maxHeight:"min(75vh, 780px)", overflowY:"auto", scrollBehavior:"smooth" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 4,
            margin: "-4px -8px 12px",
            padding: "10px 10px 12px",
            background: "linear-gradient(180deg, var(--color-background-primary,#fff) 65%, rgba(255,255,255,0.92) 100%)",
            WebkitBackdropFilter: "blur(8px)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--color-border-tertiary,#e5e5e5)",
            borderRadius: "var(--radius-md, 12px) var(--radius-md, 12px) 0 0",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Jump in preview
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tocItems.map((s) => (
              <button key={`sticky-${s.id}`} type="button" onClick={() => scrollToSection(s.id)} style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32 }}>
                {s.short}
              </button>
            ))}
          </div>
        </div>
        {/* cover */}
        <div id={previewAnchorId(RAMS_SECTION_IDS.COVER)} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", paddingBottom:14, marginBottom:14, scrollMarginTop:72 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            1. Document information
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, background:"#E6F1FB", color:"#0C447C", fontWeight:600 }}>
                {form.documentNo || "No document number"}
              </span>
              <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, background:statusTone.bg, color:statusTone.color, fontWeight:600 }}>
                {(form.documentStatus || "draft").replace(/_/g, " ")}
              </span>
              {form.strictMode && (
                <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, background:"#ede9fe", color:"#4c1d95", fontWeight:700 }}>
                  strict mode
                </span>
              )}
            </div>
            <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              Issued: {fmtDate(form.issueDate)}
            </span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Location</div>
              <div style={{ fontWeight:500 }}>{form.location}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Project</div>
              <div style={{ fontWeight:500 }}>{form.projectId ? projectMap[form.projectId] || "—" : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Job reference</div>
              <div style={{ fontWeight:500 }}>{form.jobRef||"—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Date</div>
              <div>{fmtDate(form.date)}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Lead engineer</div>
              <div>{form.leadEngineer||"—"}</div>
            </div>
          </div>
          <div style={{ background:"#f97316", borderRadius:6, padding:"8px 12px", color:"#fff", fontSize:14, fontWeight:500, textAlign:"center", marginBottom:8 }}>
            {form.title}
          </div>
          {form.scope && <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{form.scope}</div>}
        </div>

        {(form.surveyMethodStatement || "").trim() && (
          <div style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              Surveying method statement addendum
            </div>
            {(form.surveyWorkType || "").trim() && (
              <div style={{ marginBottom:6, fontSize:11, color:"#0C447C" }}>
                Work type: {form.surveyWorkTypeLabel || SURVEYING_PACKS.find((p) => p.key === form.surveyWorkType)?.label || form.surveyWorkType}
              </div>
            )}
            <div style={{ fontSize:12, whiteSpace:"pre-wrap", lineHeight:1.55, color:"var(--color-text-secondary)" }}>
              {form.surveyMethodStatement}
            </div>
          </div>
        )}

        {(form.siteWeatherNote || "").trim() && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.WEATHER)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              2. Site weather
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Site weather</div>
            <div style={{ fontSize:12, whiteSpace:"pre-wrap", lineHeight:1.45 }}>{form.siteWeatherNote}</div>
          </div>
        )}

        {((form.siteMapUrl || "").trim() || (form.siteLat && form.siteLng)) && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.MAP)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              3. Site map / location
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Map / location</div>
            {(form.siteMapUrl || "").trim() && (() => {
              const raw = (form.siteMapUrl || "").trim();
              const safe = safeHttpUrl(raw);
              return safe ? (
                <a href={safe} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#0d9488", wordBreak:"break-all" }}>
                  {raw}
                </a>
              ) : (
                <span style={{ fontSize:12, color:"var(--color-text-secondary)", wordBreak:"break-all" }} title="Use http(s) URL only">{raw}</span>
              );
            })()}
            {(form.siteLat && form.siteLng) && (
              <div style={{ fontSize:12, marginTop:6 }}>
                Coordinates: {form.siteLat}, {form.siteLng}{" "}
                <a href={googleMapsSearchUrl(`${form.siteLat},${form.siteLng}`)} target="_blank" rel="noopener noreferrer" style={{ color:"#0d9488" }}>
                  Open in Google Maps
                </a>
              </div>
            )}
          </div>
        )}

        {((form.nearestHospital || "").trim() || (form.hospitalDirectionsUrl || "").trim()) && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.HOSPITAL)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              4. Emergency response
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Nearest A&amp;E / hospital</div>
            {form.nearestHospital && <div style={{ fontSize:12, marginBottom:4 }}>{form.nearestHospital}</div>}
            {(form.hospitalDirectionsUrl || "").trim() && (() => {
              const raw = (form.hospitalDirectionsUrl || "").trim();
              const safe = safeHttpUrl(raw);
              return safe ? (
                <a href={safe} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#0d9488", wordBreak:"break-all" }}>
                  Directions link
                </a>
              ) : (
                <span style={{ fontSize:12, color:"var(--color-text-secondary)" }} title="Use http(s) URL only">Invalid directions URL</span>
              );
            })()}
          </div>
        )}

        {selectedWorkers.length > 0 && printFlags[RAMS_SECTION_IDS.OPERATIVE_CERTS] === true && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.OPERATIVE_CERTS)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              5. Competence matrix
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>Operative competencies</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8 }}>From Workers — verify on site.</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", textAlign:"left", color:"var(--color-text-secondary)", fontSize:11 }}>
                  <th style={{ padding:"6px 8px 6px 0", fontWeight:600 }}>Name</th>
                  <th style={{ padding:"6px 8px", fontWeight:600 }}>Role</th>
                  <th style={{ padding:"6px 0 6px 8px", fontWeight:600 }}>Certificates / notes</th>
                </tr>
              </thead>
              <tbody>
                {selectedWorkers.map((w) => (
                  <tr key={w.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", verticalAlign:"top" }}>
                    <td style={{ padding:"8px 8px 8px 0", fontWeight:500 }}>{w.name}</td>
                    <td style={{ padding:8, color:"var(--color-text-secondary)" }}>{w.role || "—"}</td>
                    <td style={{ padding:"8px 0 8px 8px", lineHeight:1.45 }}>{formatOperativeCertsLine(w) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* hazard summary */}
        <div id={previewAnchorId(RAMS_SECTION_IDS.HAZARDS)} style={{ scrollMarginTop:72 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            6. Risk assessment and controls
          </div>
          <div
            style={{
              border: "0.5px solid var(--color-border-tertiary,#d9e2ec)",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
              background: "var(--color-background-secondary,#f7f7f5)",
            }}
          >
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>
              Risk profile
            </div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:10 }}>
              {rows.length} risk assessment rows · Initial high risk: <strong style={{ color:"#791F1F" }}>{highInitial}</strong>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
              <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600, background:"#FCEBEB", color:"#791F1F" }}>High {highResidual}</span>
              <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600, background:"#FAEEDA", color:"#633806" }}>Medium {medResidual}</span>
              <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600, background:"#EAF3DE", color:"#27500A" }}>Low {lowResidual}</span>
              <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600, background:"#E6F1FB", color:"#0C447C" }}>Avg reduction {avgReduction}%</span>
            </div>
            <div style={{ height: 8, display:"flex", borderRadius: 999, overflow:"hidden", border:"0.5px solid var(--color-border-tertiary,#d6d6d6)" }}>
              <div style={{ width:`${rows.length ? (highResidual / rows.length) * 100 : 0}%`, background:"#E24B4A" }} />
              <div style={{ width:`${rows.length ? (medResidual / rows.length) * 100 : 0}%`, background:"#EF9F27" }} />
              <div style={{ width:`${rows.length ? (lowResidual / rows.length) * 100 : 0}%`, background:"#1D9E75" }} />
            </div>
          </div>

          <div style={{ ...ss.card, padding:10, marginBottom:12, border:"0.5px solid var(--color-border-tertiary,#d6d6d6)" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>
              Residual risk matrix heatmap (L × S)
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"64px repeat(3, minmax(0, 1fr))", gap:4, alignItems:"center" }}>
              <div />
              {RISK_AXIS.map((s) => (
                <div key={`hx-s-${s}`} style={{ fontSize:10, color:"var(--color-text-secondary)", textAlign:"center" }}>S{s}</div>
              ))}
              {RISK_AXIS.map((l) => (
                <div key={`hx-row-${l}`} style={{ display:"contents" }}>
                  <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>L{l}</div>
                  {RISK_AXIS.map((s) => {
                    const key = `${l}x${s}`;
                    const score = l * s;
                    const lvl = getRiskLevel({ RF: score });
                    const c = RL[lvl];
                    const count = matrixCounts[key] || 0;
                    return (
                      <div key={`hx-${key}`} style={{ borderRadius:6, padding:"6px 4px", background:c.bg, color:c.color, fontSize:11, textAlign:"center", border:"1px solid rgba(15,23,42,0.08)" }}>
                        <div style={{ fontWeight:700 }}>{score}</div>
                        <div>{count}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>
            Detailed risk rows
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {rows.map((r,i)=>{
              const rl = getRiskLevel(r.revisedRisk);
              const c = RL[rl];
              return (
                <div
                  key={r.id}
                  className="app-rams-hazard-row"
                  style={{ padding:"9px 10px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}
                >
                  <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:6 }}>
                    <span style={{ color:"var(--color-text-secondary)", minWidth:20, textAlign:"right", fontSize:12 }}>{i+1}</span>
                    <span style={{ flex:1, fontWeight:600, fontSize:12 }}>{r.activity || "Untitled activity"}</span>
                    <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, background:c.bg, color:c.color, fontWeight:600 }}>
                      Residual RF {riskScore(r.revisedRisk)}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:6 }}>
                    <strong style={{ color:"var(--color-text-primary)" }}>Hazard:</strong> {r.hazard || "—"}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:RL[getRiskLevel(r.initialRisk)].bg, color:RL[getRiskLevel(r.initialRisk)].color }}>
                      Before: {r.initialRisk.L}/{r.initialRisk.S} = {riskScore(r.initialRisk)}
                    </span>
                    <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:c.bg, color:c.color }}>
                      After: {r.revisedRisk.L}/{r.revisedRisk.S} = {riskScore(r.revisedRisk)}
                    </span>
                    <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>
                      Reduced by {Math.max(0, Math.round(((Math.max(1, riskScore(r.initialRisk)) - riskScore(r.revisedRisk)) / Math.max(1, riskScore(r.initialRisk))) * 100))}%
                    </span>
                  </div>
                  {(r.controlMeasures || []).length > 0 && (
                    <ol style={{ margin:"0 0 0 16px", padding:0, fontSize:12, lineHeight:1.45 }}>
                      {(r.controlMeasures || []).map((cm, cmIdx) => (
                        <li key={`${r.id}_${cmIdx}`} style={{ marginBottom:3 }}>{cm}</li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              7. Method statement
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>
              Method statement (risk reduction steps)
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {rows.map((r, i) => (
                <div key={`ms_${r.id}`} style={{ fontSize:12, background:"#fff", border:"0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>Step {i + 1}: {r.activity || "Activity"}</div>
                  <div style={{ color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                    {(r.controlMeasures || []).length > 0
                      ? (r.controlMeasures || []).map((cm) => `• ${cm}`).join(" ")
                      : "No control measures entered yet."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {detailedControlPack.length > 0 && (
          <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              Detailed control method pack (task by task)
            </div>
            <div style={{ border:"0.5px solid #c7d2fe", borderRadius:10, padding:"10px 12px", background:"linear-gradient(180deg,#f8fbff 0%,#ffffff 72%)", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", textTransform:"uppercase", letterSpacing:"0.05em" }}>Control assurance board</div>
                <div style={{ fontSize:11, color:"#0C447C", fontWeight:700 }}>Avg reduction {controlAssurance.avgReduction}%</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginBottom:8 }}>
                {[
                  ["Steps", controlAssurance.steps],
                  ["Permits", controlAssurance.uniquePermits],
                  ["Hold points", controlAssurance.totalHoldPoints],
                  ["Stop-work rules", controlAssurance.totalStopWork],
                  ["High residual steps", controlAssurance.highResidualSteps],
                ].map(([k, v]) => (
                  <div key={k} style={{ border:"0.5px solid #dbe2ea", borderRadius:8, padding:"7px 8px", background:"#fff" }}>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>{k}</div>
                    <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ height:8, borderRadius:999, overflow:"hidden", border:"0.5px solid #d6dce5", background:"#fff", marginBottom:8 }}>
                <div style={{ width:`${Math.max(0, Math.min(100, controlAssurance.avgReduction))}%`, height:"100%", background:controlAssurance.avgReduction >= 70 ? "#1D9E75" : controlAssurance.avgReduction >= 45 ? "#EF9F27" : "#E24B4A" }} />
              </div>
              {controlAssurance.criticalSteps.length > 0 && (
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                  <strong style={{ color:"#7F1D1D" }}>Critical focus steps:</strong>{" "}
                  {controlAssurance.criticalSteps.map((x) => `#${x.stepNo} ${x.title} (RF ${x.residual})`).join(" · ")}
                </div>
              )}
            </div>
            <div style={{ border:"0.5px solid #dbe2ea", borderRadius:10, padding:"10px 12px", background:"#fff", marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                Execution timeline
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:8 }}>
                {[["Pre-start", controlAssurance.timeline.preStart], ["During task", controlAssurance.timeline.during], ["Close-out", controlAssurance.timeline.closeOut]].map(([label, items]) => (
                  <div key={label} style={{ border:"0.5px solid var(--color-border-tertiary,#dbe2ea)", borderRadius:8, padding:"8px 9px", background:"var(--color-background-secondary,#f8fafc)" }}>
                    <div style={{ fontSize:11, fontWeight:600, marginBottom:5 }}>{label}</div>
                    {(items || []).length === 0 ? (
                      <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No checkpoints generated.</div>
                    ) : (
                      (items || []).map((x) => <div key={`${label}_${x}`} style={{ fontSize:12, color:"var(--color-text-secondary)" }}>• {x}</div>)
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {detailedControlPack.map((d) => (
                <div key={d.id} style={{ border:"0.5px solid var(--color-border-tertiary,#dbe2ea)", borderRadius:10, padding:"9px 10px", background:"#fff" }}>
                  <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:8, marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>Step {d.stepNo}: {d.title}</div>
                    <div style={{ fontSize:11, color:"#0C447C" }}>RF {d.initial} → {d.residual} ({d.reductionPct}% reduction)</div>
                  </div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:6 }}>
                    <strong style={{ color:"var(--color-text-primary)" }}>Hazard:</strong> {d.hazard}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:8 }}>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Hierarchy of controls</strong>
                      <div>Eliminate: {(d.controlTree.eliminate[0] || "Review alternative sequence to avoid exposure.")}</div>
                      <div>Substitute: {(d.controlTree.substitute[0] || "Use safer equipment/method where possible.")}</div>
                      <div>Engineering: {(d.controlTree.engineering[0] || "Set barriers/physical separation and safe access.")}</div>
                      <div>Admin: {(d.controlTree.admin[0] || "Brief RAMS task steps and supervision points.")}</div>
                      <div>PPE: {(d.controlTree.ppe[0] || d.ppe.join(", ") || "Task-specific PPE as listed in RAMS.")}</div>
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Permit dependencies</strong>
                      {d.permitDeps.map((x) => <div key={`${d.id}_p_${x}`}>• {x}</div>)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Verification checks</strong>
                      {d.verifyChecks.map((x) => <div key={`${d.id}_v_${x}`}>• {x}</div>)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"#7F1D1D" }}>Stop-work triggers</strong>
                      {d.stopWork.map((x) => <div key={`${d.id}_s_${x}`}>• {x}</div>)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Emergency response</strong>
                      {d.emergency.map((x) => <div key={`${d.id}_e_${x}`}>• {x}</div>)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Environmental controls</strong>
                      {d.environmental.map((x) => <div key={`${d.id}_env_${x}`}>• {x}</div>)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Role assignments</strong>
                      <div><em>Supervisor</em></div>
                      {d.roleAssignments.supervisor.map((x) => <div key={`${d.id}_rs_${x}`}>• {x}</div>)}
                      <div style={{ marginTop:4 }}><em>Operative</em></div>
                      {d.roleAssignments.operative.map((x) => <div key={`${d.id}_ro_${x}`}>• {x}</div>)}
                      {d.roleAssignments.banksman.length > 0 && (
                        <>
                          <div style={{ marginTop:4 }}><em>Banksman / Marshal</em></div>
                          {d.roleAssignments.banksman.map((x) => <div key={`${d.id}_rb_${x}`}>• {x}</div>)}
                        </>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Phase checkpoints</strong>
                      <div><em>Pre-start</em></div>
                      {d.phaseControls.preStart.map((x) => <div key={`${d.id}_pp_${x}`}>• {x}</div>)}
                      <div style={{ marginTop:4 }}><em>During task</em></div>
                      {d.phaseControls.during.map((x) => <div key={`${d.id}_pd_${x}`}>• {x}</div>)}
                      <div style={{ marginTop:4 }}><em>Close-out</em></div>
                      {d.phaseControls.closeOut.map((x) => <div key={`${d.id}_pc_${x}`}>• {x}</div>)}
                    </div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                      <strong style={{ color:"var(--color-text-primary)" }}>Hold points</strong>
                      {d.holdPoints.map((x) => <div key={`${d.id}_hp_${x}`}>☐ {x}</div>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* operatives */}
        {operatives.length>0 && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.SIGNATURES)} style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              8. Sign-off list
            </div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>Operatives to sign:</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {operatives.map(n=>(
                <span key={n} style={{ padding:"2px 10px", borderRadius:20, fontSize:11, background:"#EAF3DE", color:"#27500A" }}>{n}</span>
              ))}
            </div>
          </div>
        )}

        {((form.surveyDeliverables || "").trim() || (form.surveyAssumptions || "").trim() || (form.communicationPlan || "").trim()) && (
          <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              Survey delivery controls
            </div>
            {(form.surveyDeliverables || "").trim() && (
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Deliverables / outputs</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45, whiteSpace:"pre-wrap" }}>{form.surveyDeliverables}</div>
              </div>
            )}
            {(form.surveyAssumptions || "").trim() && (
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Key assumptions</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45, whiteSpace:"pre-wrap" }}>{form.surveyAssumptions}</div>
              </div>
            )}
            {(form.communicationPlan || "").trim() && (
              <div>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Communication & permit controls</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45, whiteSpace:"pre-wrap" }}>{form.communicationPlan}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Client handover appendix
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, fontSize:12, marginBottom:8 }}>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Client:</span> {form.handoverClientName || "—"}</div>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Receiver:</span> {form.handoverReceiver || "—"}</div>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Handover date:</span> {fmtDate(form.handoverDate)}</div>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Status:</span> {(form.documentStatus || "draft").replace(/_/g, " ")}</div>
          </div>
          {(form.handoverNotes || "").trim() && (
            <div style={{ marginBottom:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45, whiteSpace:"pre-wrap" }}>
              <strong style={{ color:"var(--color-text-primary)" }}>Notes:</strong> {form.handoverNotes}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {handoverChecks.map((c) => (
              <div key={c.label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                <span style={{ width:16, height:16, borderRadius:999, display:"inline-flex", alignItems:"center", justifyContent:"center", background:c.ok?"#EAF3DE":"#FCEBEB", color:c.ok?"#27500A":"#791F1F", fontWeight:700, fontSize:11 }}>
                  {c.ok ? "✓" : "!"}
                </span>
                <span style={{ color:c.ok?"var(--color-text-primary)":"#7F1D1D" }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop:14, paddingTop:12, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            9. Approval and revision history
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, fontSize:12 }}>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Revision:</span> {form.revision || "1A"}</div>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Review due:</span> {fmtDate(form.reviewDate)}</div>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Approved by:</span> {form.approvedBy || "—"}</div>
            <div><span style={{ color:"var(--color-text-secondary)" }}>Approval date:</span> {fmtDate(form.approvalDate)}</div>
          </div>
          {(form.revisionSummary || "").trim() && (
            <div style={{ marginTop:8, fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
              <strong style={{ color:"var(--color-text-primary)" }}>Change summary:</strong> {form.revisionSummary}
            </div>
          )}
          <div style={{ marginTop:10, fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>
            Signature evidence trail
          </div>
          {signatureEvents.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
              No signature events yet. Use auto-sign shortcuts above or save as approved/issued.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {signatureEvents.slice(0, 8).map((s, idx) => (
                <div key={s.id || `${s.action}_${idx}`} style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.45 }}>
                  <strong style={{ color:"var(--color-text-primary)" }}>{String(s.action || "").replace(/_/g, " ")}</strong> — {s.actor || "Unknown"} ({s.role || "role n/a"}) · {fmtDateTime(s.at)} · rev {s.revision || "—"} · status {String(s.status || "—").replace(/_/g, " ")}
                </div>
              ))}
            </div>
          )}
        </div>

        <div id={previewAnchorId(RAMS_SECTION_IDS.INTEGRITY)} style={{ marginTop:14, paddingTop:12, borderTop:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            10. Document integrity
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)" }}>Document integrity (preview)</div>
            <button type="button" onClick={copyFingerprint} style={{ ...ss.btn, fontSize:11, padding:"4px 10px", minHeight:32 }}>
              {fpCopied ? "Copied" : "Copy fingerprint"}
            </button>
          </div>
          <div style={{ fontSize:11, fontFamily:"ui-monospace, monospace", color:"var(--color-text-secondary)", wordBreak:"break-all" }}>
            Fingerprint: {previewFingerprint} — updates when content above changes. Stored on save.
          </div>
        </div>
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:8 }}>
        <button type="button" onClick={onBack} style={ss.btn}>← Back</button>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          <button type="button" onClick={printRAMS} style={ss.btn}>
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="1" width="10" height="10" rx="1"/><path d="M1 8h14v6H1z"/><path d="M5 14v-3h6v3"/><circle cx="12" cy="11" r=".5" fill="currentColor"/></svg>
            Print / PDF
          </button>
          <button type="button" onClick={onSave} disabled={issueBlockedByCompetency} style={{ ...ss.btnO, opacity: issueBlockedByCompetency ? 0.55 : 1 }}>
            {issueBlockedByCompetency ? "Save blocked (competency)" : "Save RAMS"}
          </button>
        </div>
      </div>
      {issueBlockedByCompetency && (
        <div style={{ marginTop:8, fontSize:12, color:"#7F1D1D" }}>
          Status is <strong>issued</strong> and required competencies are missing for selected operatives. Assign competent workers or change status before saving.
        </div>
      )}
    </div>
  );
}

// ─── Saved RAMS list ─────────────────────────────────────────────────────────
function SavedList({
  ramsDocs,
  workers,
  projects,
  onNew,
  onEdit,
  onRename,
  onDelete,
  onPreview,
  onPrint,
  onPrintProjectPack,
  onDuplicate,
  onExportJson,
  onExportCompliance,
  onToggleFavorite,
  onCopyShareLink,
  onImportJson,
}) {
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const [q, setQ] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favoriteCount = useMemo(() => ramsDocs.filter((d) => !!d.isFavorite).length, [ramsDocs]);
  const importRef = useRef(null);

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onImportJson(parsed);
      } catch (err) {
        alert(err?.message || "Could not import file.");
      }
    };
    reader.onerror = () => alert("Could not read file.");
    reader.readAsText(file);
  };

  const sortedByDate = useMemo(() => {
    return [...ramsDocs].sort((a, b) => {
      const fa = a.isFavorite ? 1 : 0;
      const fb = b.isFavorite ? 1 : 0;
      if (fb !== fa) return fb - fa;
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [ramsDocs]);

  const filtered = useMemo(() => {
    const base = favoritesOnly ? sortedByDate.filter((d) => !!d.isFavorite) : sortedByDate;
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter((d) => {
      const pn = d.projectId ? projectMap[d.projectId] || "" : "";
      return (
        (d.title || "").toLowerCase().includes(s) ||
        (d.location || "").toLowerCase().includes(s) ||
        (d.jobRef || "").toLowerCase().includes(s) ||
        pn.toLowerCase().includes(s)
      );
    });
  }, [sortedByDate, q, projectMap, favoritesOnly]);

  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:16 }}>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
          {ramsDocs.length} RAMS document{ramsDocs.length!==1?"s":""}
          {favoriteCount > 0 ? ` · ${favoriteCount} favorite${favoriteCount !== 1 ? "s" : ""}` : ""}
          {q.trim() ? ` · showing ${filtered.length}` : ""}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
          {ramsDocs.length > 0 && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, location, ref, project…"
              style={{ ...ss.inp, minWidth: 200, maxWidth: 360 }}
              aria-label="Search RAMS list"
            />
          )}
          <button type="button" onClick={() => setFavoritesOnly((v) => !v)} style={{ ...ss.btn, fontSize:12 }}>
            {favoritesOnly ? "★ Favorites only" : "☆ Favorites"}
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onImportFile} aria-hidden />
          <button type="button" onClick={() => importRef.current?.click()} style={ss.btn} title="Restore from a previously exported .json file">
            Import JSON
          </button>
          <button type="button" onClick={onNew} style={ss.btnO}>+ Build new RAMS</button>
        </div>
      </div>

      {ramsDocs.length===0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2.75rem 1.25rem",
            border: "2px dashed var(--color-border-tertiary,#e2e8f0)",
            borderRadius: "var(--radius-lg, 16px)",
            background: "linear-gradient(180deg, rgba(13,148,136,0.06) 0%, var(--color-background-primary) 55%)",
          }}
        >
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0, lineHeight: 1.55, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            No RAMS yet. Use <strong style={{ color: "var(--color-text-primary)" }}>Build new</strong> or <strong style={{ color: "var(--color-text-primary)" }}>Import JSON</strong> above (e.g. from another device or backup).
          </p>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ ...ss.card, textAlign:"center", color:"var(--color-text-secondary)", fontSize:13 }}>
          No documents match your search.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="app-rams-doc-row"
              style={{
                ...ss.card,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                border: doc.isFavorite ? "1px solid #f59e0b" : "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                background: doc.isFavorite
                  ? "linear-gradient(180deg,#fffdf5 0%, #ffffff 68%)"
                  : "linear-gradient(180deg,var(--color-background-primary,#fff) 0%, #fbfdff 100%)",
                boxShadow: doc.isFavorite ? "0 4px 16px rgba(245,158,11,0.14)" : "0 2px 10px rgba(15,23,42,0.06)",
              }}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                  {doc.isFavorite ? "★ " : ""}{doc.title}
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12, color:"var(--color-text-secondary)" }}>
                  <span>{doc.location}</span>
                  {doc.projectId && projectMap[doc.projectId] && <span>Project: {projectMap[doc.projectId]}</span>}
                  {doc.documentNo && <span style={{ fontFamily:"ui-monospace, monospace" }}>{doc.documentNo}</span>}
                  {doc.jobRef && <span>Ref: {doc.jobRef}</span>}
                  <span>{doc.rows?.length||0} hazard rows</span>
                  {Array.isArray(doc.signatureEvents) && doc.signatureEvents.length > 0 && <span>Signatures: {doc.signatureEvents.length}</span>}
                  <span>Created: {fmtDate(doc.createdAt)}</span>
                  {doc.issueDate && <span>Issued: {fmtDate(doc.issueDate)}</span>}
                  {doc.reviewDate && <span style={{ color: new Date(doc.reviewDate)<new Date() ? "#A32D2D" : "inherit" }}>Review: {fmtDate(doc.reviewDate)}</span>}
                  {doc.contentHash && <span style={{ fontFamily:"ui-monospace, monospace", fontSize:10 }} title="Fingerprint">#{String(doc.contentHash).slice(0,8)}…</span>}
                </div>
                {(doc.operativeIds||[]).length>0 && (
                  <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(doc.operativeIds||[]).map(id=>(
                      <span key={id} style={{ padding:"1px 8px", borderRadius:20, fontSize:10, background:"#EAF3DE", color:"#27500A" }}>{workerMap[id]||id}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0, justifyContent:"flex-end", maxWidth: 420 }}>
                <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600,
                  background:(doc.documentStatus || doc.status)==="approved"?"#EAF3DE":(doc.documentStatus || doc.status)==="issued"?"#E6F1FB":(doc.documentStatus || doc.status)==="draft"?"var(--color-background-secondary,#f7f7f5)":"#FAEEDA",
                  color:(doc.documentStatus || doc.status)==="approved"?"#27500A":(doc.documentStatus || doc.status)==="issued"?"#0C447C":(doc.documentStatus || doc.status)==="draft"?"var(--color-text-secondary)":"#633806" }}>
                  {(doc.documentStatus || doc.status || "draft").replace(/_/g, " ")}
                </span>
                <button
                  type="button"
                  onClick={() => onPreview(doc)}
                  style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}
                  title="Opens A4 layout in a new tab (then use browser Print → Save as PDF)"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onPrint(doc)}
                  style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}
                  title="Opens print dialog — choose Save as PDF or a printer"
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => onPrintProjectPack(doc)}
                  style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}
                  title="One-click Site Pack: RAMS + project permits + audit summary + key contacts (A4)"
                >
                  Site Pack
                </button>
                <button type="button" onClick={()=>onDuplicate(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Duplicate</button>
                <button type="button" onClick={()=>onRename(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }} title="Quick rename document title">
                  Rename
                </button>
                <button type="button" onClick={()=>onToggleFavorite(doc.id)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }} title="Pin/unpin document as favorite">
                  {doc.isFavorite ? "★ Unfavorite" : "☆ Favorite"}
                </button>
                <button type="button" onClick={()=>onExportJson(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>JSON</button>
                <button type="button" onClick={()=>onExportCompliance(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }} title="Export compliance/audit snapshot CSV">
                  Compliance
                </button>
                <button type="button" onClick={()=>onCopyShareLink(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }} title="Read-only link, this browser only">Share</button>
                <button type="button" onClick={()=>onEdit(doc)} style={{ ...ss.btnP, padding:"4px 10px", fontSize:12 }}>Edit</button>
                <button type="button" onClick={()=>onDelete(doc.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formShapeForCompare(f) {
  if (!f || typeof f !== "object") return {};
  return {
    title: f.title,
    location: f.location,
    scope: f.scope,
    date: f.date,
    projectId: f.projectId,
    leadEngineer: f.leadEngineer,
    jobRef: f.jobRef,
    revision: f.revision,
    reviewDate: f.reviewDate,
    approvedBy: f.approvedBy,
    approvalDate: f.approvalDate,
    revisionSummary: f.revisionSummary,
    surveyWorkType: f.surveyWorkType,
    surveyWorkTypeLabel: f.surveyWorkTypeLabel,
    surveyMethodStatement: f.surveyMethodStatement,
    surveyDeliverables: f.surveyDeliverables,
    surveyAssumptions: f.surveyAssumptions,
    surveyRequiredPermits: [...(f.surveyRequiredPermits || [])],
    surveyRequiredCerts: [...(f.surveyRequiredCerts || [])],
    surveyEvidenceSet: [...(f.surveyEvidenceSet || [])],
    surveyHoldPoints: [...(f.surveyHoldPoints || [])],
    communicationPlan: f.communicationPlan,
    handoverClientName: f.handoverClientName,
    handoverReceiver: f.handoverReceiver,
    handoverDate: f.handoverDate,
    handoverNotes: f.handoverNotes,
    documentNo: f.documentNo,
    documentStatus: f.documentStatus,
    issueDate: f.issueDate,
    strictMode: !!f.strictMode,
    strictMinControls: Number(f.strictMinControls || 0),
    strictRequireHoldPoints: !!f.strictRequireHoldPoints,
    operativeIds: [...(f.operativeIds || [])].sort(),
    siteWeatherNote: f.siteWeatherNote,
    siteMapUrl: f.siteMapUrl,
    siteLat: f.siteLat,
    siteLng: f.siteLng,
    nearestHospital: f.nearestHospital,
    hospitalDirectionsUrl: f.hospitalDirectionsUrl,
    printSections: f.printSections,
  };
}

function rowsShapeForCompare(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    sourceId: r.sourceId,
    category: r.category,
    activity: r.activity,
    hazard: r.hazard,
    initialRisk: r.initialRisk,
    revisedRisk: r.revisedRisk,
    controlMeasures: r.controlMeasures,
    ppeRequired: r.ppeRequired,
  }));
}

function snapshotBuilderState(step, form, rows) {
  return JSON.stringify({
    step,
    form: formShapeForCompare(form),
    rows: rowsShapeForCompare(rows),
  });
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function RAMSTemplateBuilder() {
  const [view, setView] = useState("list"); // list | builder
  const [step, setStep] = useState(1);
  const [ramsDocs, setRamsDocs] = useState(()=>load("rams_builder_docs",[]));
  const [orgActivities, setOrgActivities] = useState(() => load(RAMS_ORG_ACTIVITIES_KEY, []));
  const [hazardPrefs, setHazardPrefs] = useState(() =>
    load(RAMS_HAZARD_PREFS_KEY, { favoriteIds: [], usageCounts: {}, recentIds: [] })
  );
  const [hazardPacks, setHazardPacks] = useState(() => load(RAMS_HAZARD_PACKS_KEY, []));
  const [workers] = useState(()=>load("mysafeops_workers",[]));
  const [projects] = useState(()=>load("mysafeops_projects",[]));
  const [editingDoc, setEditingDoc] = useState(null);

  // builder state
  const [form, setForm] = useState({});
  const [selectedHazards, setSelectedHazards] = useState([]);
  const [editedRows, setEditedRows] = useState([]);

  const builderBaselineRef = useRef("");

  const builderDirty = useMemo(
    () => snapshotBuilderState(step, form, editedRows) !== builderBaselineRef.current,
    [step, form, editedRows]
  );

  useEffect(() => {
    if (view !== "builder" || !builderDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [view, builderDirty]);

  useEffect(() => {
    if (view !== "builder") return undefined;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(
          RAMS_DRAFT_KEY,
          JSON.stringify({
            step,
            form,
            editedRows,
            selectedHazards,
            savedAt: Date.now(),
          })
        );
      } catch (e) {
        /* quota or private mode */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [view, step, form, editedRows, selectedHazards]);

  useEffect(()=>{ save("rams_builder_docs",ramsDocs); },[ramsDocs]);
  useEffect(()=>{ save(RAMS_ORG_ACTIVITIES_KEY, orgActivities); },[orgActivities]);
  useEffect(()=>{ save(RAMS_HAZARD_PREFS_KEY, hazardPrefs); },[hazardPrefs]);
  useEffect(()=>{ save(RAMS_HAZARD_PACKS_KEY, hazardPacks); },[hazardPacks]);

  const startNew = () => {
    let formInit = {
      ...RAMS_FORM_DEFAULTS,
      date: today(),
      issueDate: today(),
      revision: "1A",
      documentStatus: "draft",
      documentNo: generateRamsDocNo(),
    };
    let rowsInit = [];
    let selInit = [];
    let startStep = 1;
    let usedAi = false;
    try {
      const raw = sessionStorage.getItem("mysafeops_ai_rams_prefill");
      if (raw) {
        usedAi = true;
        sessionStorage.removeItem("mysafeops_ai_rams_prefill");
        const d = JSON.parse(raw);
        formInit = {
          ...formInit,
          title: d.title || "",
          location: d.location || "",
          leadEngineer: d.leadEngineer || "",
          jobRef: d.jobRef || "",
        };
        (d.hazards || []).forEach((h) => {
          const id = genId();
          const sourceId = `ai_${id}`;
          rowsInit.push({
            id,
            sourceId,
            category: h.category || "General",
            activity: h.activity || "",
            hazard: h.hazard || "",
            initialRisk: h.initialRisk || { L: 3, S: 4, RF: 12 },
            revisedRisk: h.revisedRisk || { L: 2, S: 4, RF: 8 },
            controlMeasures: h.controlMeasures || [],
            ppeRequired: h.ppeRequired || [],
            regs: h.regs || [],
          });
          selInit.push({ id: sourceId });
        });
        if (rowsInit.length) startStep = 3;
      }
    } catch (e) {
      console.warn(e);
    }

    if (!usedAi) {
      try {
        const rawDraft = sessionStorage.getItem(RAMS_DRAFT_KEY);
        if (rawDraft) {
          const d = JSON.parse(rawDraft);
          const age = Date.now() - (d.savedAt || 0);
          if (
            d &&
            typeof d.step === "number" &&
            age >= 0 &&
            age < RAMS_DRAFT_MAX_AGE_MS
          ) {
            const when = d.savedAt ? new Date(d.savedAt).toLocaleString() : "recently";
            if (window.confirm(`Resume unsaved RAMS draft from ${when}?`)) {
              const fi = {
                ...RAMS_FORM_DEFAULTS,
                ...(d.form || {}),
                date: (d.form && d.form.date) || today(),
                issueDate: (d.form && d.form.issueDate) || today(),
                documentStatus: (d.form && d.form.documentStatus) || "draft",
                documentNo: (d.form && d.form.documentNo) || generateRamsDocNo(),
              };
              const er = Array.isArray(d.editedRows) ? d.editedRows : [];
              const sh = Array.isArray(d.selectedHazards) ? d.selectedHazards : [];
              const st = Math.min(4, Math.max(1, Number(d.step) || 1));
              setForm(fi);
              setEditedRows(er);
              setSelectedHazards(sh);
              setStep(st);
              setEditingDoc(null);
              builderBaselineRef.current = snapshotBuilderState(st, fi, er);
              setView("builder");
              return;
            }
            sessionStorage.removeItem(RAMS_DRAFT_KEY);
          } else if (rawDraft) {
            sessionStorage.removeItem(RAMS_DRAFT_KEY);
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    setForm(formInit);
    setSelectedHazards(selInit);
    setEditedRows(rowsInit);
    setStep(startStep);
    setEditingDoc(null);
    builderBaselineRef.current = snapshotBuilderState(startStep, formInit, rowsInit);
    setView("builder");
  };

  const startEdit = (doc) => {
    const { rows: docRows, ...docRest } = doc;
    const mergedForm = {
      ...RAMS_FORM_DEFAULTS,
      ...docRest,
      documentNo: docRest.documentNo || generateRamsDocNo(),
      documentStatus: docRest.documentStatus || docRest.status || "draft",
      issueDate: docRest.issueDate || docRest.date || today(),
    };
    const rows = docRows || [];
    setForm(mergedForm);
    setEditedRows(rows);
    setSelectedHazards((doc.rows||[]).map(r=>({ id:r.sourceId||r.id })));
    setEditingDoc(doc);
    setStep(3); // jump to editor
    builderBaselineRef.current = snapshotBuilderState(3, mergedForm, rows);
    setView("builder");
  };

  const goToList = () => {
    if (builderDirty && !window.confirm("Leave RAMS builder? Unsaved changes will be lost.")) return;
    setView("list");
  };

  const clearHazardSelection = () => {
    setSelectedHazards([]);
    setEditedRows([]);
  };

  const addOrgActivityTemplate = (tpl) => {
    if (!tpl || !tpl.id) return;
    setOrgActivities((prev) => {
      if (prev.some((x) => x.id === tpl.id)) return prev;
      return [tpl, ...prev];
    });
  };

  const deleteOrgActivityTemplate = (id) => {
    if (!id) return;
    if (!window.confirm("Delete this organisation RAMS activity template?")) return;
    setOrgActivities((prev) => prev.filter((x) => x.id !== id));
    setSelectedHazards((prev) => prev.filter((s) => s.id !== id));
    setEditedRows((prev) => prev.filter((r) => (r.sourceId || r.id) !== id));
  };

  const toggleHazardFavorite = (id) => {
    if (!id) return;
    setHazardPrefs((prev) => {
      const favs = new Set(prev?.favoriteIds || []);
      if (favs.has(id)) favs.delete(id);
      else favs.add(id);
      return {
        ...(prev || {}),
        favoriteIds: Array.from(favs),
        usageCounts: prev?.usageCounts || {},
        recentIds: prev?.recentIds || [],
      };
    });
  };

  const toggleFavoriteDoc = (id) => {
    setRamsDocs((prev) => prev.map((d) => (d.id === id ? { ...d, isFavorite: !d.isFavorite, updatedAt: new Date().toISOString() } : d)));
  };

  const saveHazardPack = (pack) => {
    if (!pack?.id || !String(pack?.name || "").trim()) return;
    setHazardPacks((prev) => {
      const existing = prev.find((p) => p.id === pack.id);
      if (existing) {
        return prev.map((p) =>
          p.id === pack.id
            ? {
                ...pack,
                version: Math.max(1, Number(pack.version || p.version || 1)),
                versionHistory: Array.isArray(pack.versionHistory) ? pack.versionHistory : (p.versionHistory || []),
                status: String(pack.status || p.status || HAZARD_PACK_STATUS.CURRENT),
                updatedAt: new Date().toISOString(),
              }
            : p
        );
      }
      return [
        {
          ...pack,
          version: Math.max(1, Number(pack.version || 1)),
          versionHistory: Array.isArray(pack.versionHistory) ? pack.versionHistory : [],
          status: String(pack.status || HAZARD_PACK_STATUS.CURRENT),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 80);
    });
  };

  const renameHazardPack = (id, name) => {
    if (!id || !String(name || "").trim()) return;
    setHazardPacks((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: String(name).trim(), updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const deleteHazardPack = (id) => {
    if (!id) return;
    setHazardPacks((prev) => prev.filter((p) => p.id !== id));
  };

  const togglePinHazardPack = (id) => {
    if (!id) return;
    setHazardPacks((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, isPinned: !p.isPinned, updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const setHazardPackStatus = (id, status) => {
    if (!id) return;
    const nextStatus = String(status || HAZARD_PACK_STATUS.CURRENT);
    if (![HAZARD_PACK_STATUS.CURRENT, HAZARD_PACK_STATUS.SUPERSEDED].includes(nextStatus)) return;
    setHazardPacks((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const createHazardPackVersion = (id, templates, note, meta) => {
    if (!id || !Array.isArray(templates) || templates.length === 0) return;
    setHazardPacks((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const now = new Date().toISOString();
        const prevVersion = Math.max(1, Number(p.version || 1));
        const nextVersion = prevVersion + 1;
        const diff = buildPackVersionDiff(p.templates, templates);
        const historyEntry = {
          version: prevVersion,
          templates: Array.isArray(p.templates) ? p.templates : [],
          at: now,
          note: String(note || "").trim() || "Version snapshot",
          templateCount: Array.isArray(p.templates) ? p.templates.length : 0,
          diff,
        };
        return {
          ...p,
          templates,
          version: nextVersion,
          versionHistory: [historyEntry, ...(Array.isArray(p.versionHistory) ? p.versionHistory : [])].slice(0, 30),
          projectId: meta?.projectId || p.projectId || "",
          surveyWorkType: meta?.surveyWorkType || p.surveyWorkType || "",
          keywords: Array.isArray(meta?.keywords) && meta.keywords.length ? meta.keywords : (p.keywords || []),
          status: HAZARD_PACK_STATUS.CURRENT,
          updatedAt: now,
        };
      })
    );
  };

  const rollbackHazardPackVersion = (id) => {
    if (!id) return;
    let restored = null;
    setHazardPacks((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const history = Array.isArray(p.versionHistory) ? p.versionHistory : [];
        if (history.length === 0) return p;
        const [snap, ...rest] = history;
        restored = snap;
        return {
          ...p,
          templates: Array.isArray(snap.templates) ? snap.templates : p.templates,
          version: Math.max(1, Number(snap.version || 1)),
          versionHistory: rest,
          status: HAZARD_PACK_STATUS.CURRENT,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    if (restored) {
      window.alert(`Pack restored to version v${Math.max(1, Number(restored.version || 1))}.`);
    }
  };

  const exportHazardPacks = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      packs: hazardPacks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rams_quick_packs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importHazardPacks = (parsed) => {
    const packs = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.packs) ? parsed.packs : null;
    if (!packs) throw new Error("Invalid packs file. Expected array or { packs: [] }.");
    const cleaned = packs
      .map((p) => ({
        id: p?.id || `pack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: String(p?.name || "").trim(),
        templates: Array.isArray(p?.templates) ? p.templates : [],
        isPinned: !!p?.isPinned,
        version: Math.max(1, Number(p?.version || 1)),
        versionHistory: Array.isArray(p?.versionHistory) ? p.versionHistory : [],
        status: String(p?.status || HAZARD_PACK_STATUS.CURRENT),
        projectId: String(p?.projectId || ""),
        surveyWorkType: String(p?.surveyWorkType || ""),
        keywords: Array.isArray(p?.keywords) ? p.keywords.filter(Boolean).map((x) => String(x).toLowerCase()).slice(0, 20) : [],
        appliedCount: Math.max(0, Number(p?.appliedCount || 0)),
        lastAppliedAt: p?.lastAppliedAt || "",
        createdAt: p?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      .filter((p) => p.name && p.templates.length > 0);
    if (cleaned.length === 0) throw new Error("No valid packs found in file.");
    setHazardPacks((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      cleaned.forEach((p) => map.set(p.id, p));
      return Array.from(map.values()).slice(0, 120);
    });
    window.alert(`Imported ${cleaned.length} quick pack(s).`);
  };

  const applyHazardPack = (pack) => {
    if (!pack || !Array.isArray(pack.templates) || pack.templates.length === 0) return;
    if (String(pack.status || HAZARD_PACK_STATUS.CURRENT) === HAZARD_PACK_STATUS.SUPERSEDED) {
      if (!window.confirm(`"${pack.name}" is marked superseded. Apply anyway?`)) return;
    }
    const existing = new Set(selectedHazards.map((s) => s.id));
    const toAdd = pack.templates.filter((t) => t && t.templateId && !existing.has(t.templateId));
    if (toAdd.length === 0) {
      window.alert("All activities from this pack are already selected.");
      return;
    }
    const mapped = toAdd.map((t) => ({
      id: t.templateId,
      category: t.category || "General",
      activity: t.activity || "",
      hazard: t.hazard || "",
      initialRisk: t.initialRisk || { L: 4, S: 4, RF: 16 },
      revisedRisk: t.revisedRisk || { L: 2, S: 4, RF: 8 },
      controlMeasures: (t.controlMeasures || []).filter(Boolean),
      ppeRequired: (t.ppeRequired || []).filter(Boolean),
      regs: (t.regs || []).filter(Boolean),
      _orgTemplate: String(t.templateId).startsWith("org_"),
    }));
    setSelectedHazards((prev) => [...prev, ...mapped.map((x) => ({ id: x.id, ...x }))]);
    setEditedRows((rows) => [
      ...rows,
      ...mapped.map((x) => ({ ...JSON.parse(JSON.stringify(x)), sourceId: x.id, id: genId() })),
    ]);
    setHazardPacks((prev) =>
      prev.map((p) =>
        p.id === pack.id
          ? {
              ...p,
              appliedCount: Math.max(0, Number(p.appliedCount || 0)) + 1,
              lastAppliedAt: new Date().toISOString(),
            }
          : p
      )
    );
    window.alert(`Applied pack "${pack.name}" — added ${toAdd.length} activity row(s).`);
  };

  const importFromLastProject = () => {
    if (!form.projectId) {
      window.alert("Set Project in Document info first, then use Import from last project.");
      return;
    }
    const history = [...ramsDocs]
      .filter((d) => d.projectId === form.projectId && d.id !== editingDoc?.id)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    if (history.length === 0) {
      window.alert("No previous RAMS found for this project.");
      return;
    }
    const latest = history[0];
    const existing = new Set(selectedHazards.map((s) => s.id));
    const srcRows = Array.isArray(latest.rows) ? latest.rows : [];
    const toAdd = srcRows
      .map((r) => ({
        id: String(r.sourceId || r.id || ""),
        category: r.category || "General",
        activity: r.activity || "",
        hazard: r.hazard || "",
        initialRisk: r.initialRisk || { L: 4, S: 4, RF: 16 },
        revisedRisk: r.revisedRisk || { L: 2, S: 4, RF: 8 },
        controlMeasures: (r.controlMeasures || []).filter(Boolean),
        ppeRequired: (r.ppeRequired || []).filter(Boolean),
        regs: (r.regs || []).filter(Boolean),
      }))
      .filter((x) => x.id && !existing.has(x.id));
    if (toAdd.length === 0) {
      window.alert("All activities from latest project RAMS are already selected.");
      return;
    }
    setSelectedHazards((prev) => [...prev, ...toAdd.map((x) => ({ id: x.id, ...x }))]);
    setEditedRows((rows) => [
      ...rows,
      ...toAdd.map((x) => ({ ...JSON.parse(JSON.stringify(x)), sourceId: x.id, id: genId() })),
    ]);
    window.alert(`Imported ${toAdd.length} activities from latest RAMS: ${latest.title || latest.documentNo || latest.id}`);
  };

  const addHazardsVisible = (visibleList) => {
    if (!Array.isArray(visibleList) || visibleList.length === 0) return;
    const existing = new Set(selectedHazards.map((s) => s.id));
    const toAdd = visibleList.filter((h) => h && !existing.has(h.id));
    if (toAdd.length === 0) return;
    setSelectedHazards((prev) => [...prev, ...toAdd]);
    setEditedRows((rows) => [
      ...rows,
      ...toAdd.map((h) => ({ ...JSON.parse(JSON.stringify(h)), sourceId: h.id, id: genId() })),
    ]);
  };

  const toggleHazard = (h) => {
    setSelectedHazards(prev => {
      const exists = prev.some(s=>s.id===h.id);
      if (exists) {
        setEditedRows(rows => rows.filter(r=>(r.sourceId||r.id)!==h.id));
        return prev.filter(s=>s.id!==h.id);
      } else {
        // add to edited rows with copy of library data
        const newRow = { ...JSON.parse(JSON.stringify(h)), sourceId:h.id, id:genId() };
        setEditedRows(rows=>[...rows, newRow]);
        setHazardPrefs((prev) => {
          const current = Array.isArray(prev?.recentIds) ? prev.recentIds : [];
          const nextRecent = [h.id, ...current.filter((x) => x !== h.id)].slice(0, 50);
          return {
            favoriteIds: prev?.favoriteIds || [],
            usageCounts: prev?.usageCounts || {},
            recentIds: nextRecent,
          };
        });
        return [...prev, h];
      }
    });
  };

  const applySurveyPack = (packKey) => {
    const pack = findSurveyPackByKey(packKey);
    if (!pack) return;
    const meta = surveyPackMetaFor(pack.key);
    setForm((prev) => {
      const scoped = String(prev.scope || "").trim();
      const addLine = `Surveying addendum: ${pack.scope}`;
      const mergedScope = scoped
        ? scoped.includes(addLine) || scoped.includes(pack.scope)
          ? scoped
          : `${scoped}\n\n${addLine}`
        : pack.scope;
      return {
        ...prev,
        surveyWorkType: pack.key,
        surveyWorkTypeLabel: pack.label,
        surveyMethodStatement: pack.method,
        surveyDeliverables:
          prev.surveyDeliverables ||
          "Issued RAMS PDF, hazard register, control summary, survey notes, and client handover record.",
        surveyAssumptions:
          prev.surveyAssumptions ||
          "Utility records available before start, access to survey extents confirmed, and site induction completed by all operatives.",
        communicationPlan:
          prev.communicationPlan ||
          `Daily briefing before start; stop-work escalation via supervisor; permit coordination with site manager; end-of-day handover to client rep.\n\nPermit dependencies:\n- ${(meta.permitDependencies || []).join("\n- ")}`,
        handoverNotes:
          prev.handoverNotes ||
          "Handover includes briefing outcomes, residual risk alerts, and confirmation that controls remain in place for issue status.",
        surveyRequiredPermits: meta.permitDependencies || [],
        surveyRequiredCerts: meta.requiredCerts || [],
        surveyEvidenceSet: meta.mandatoryEvidence || [],
        surveyHoldPoints: meta.holdPoints || [],
        scope: mergedScope,
      };
    });

    const recommended = findHazardsForSurveyPack(pack);
    if (recommended.length > 0) {
      const existing = new Set(selectedHazards.map((s) => s.id));
      const toAdd = recommended.filter((h) => h && !existing.has(h.id));
      if (toAdd.length > 0) {
        setSelectedHazards((prev) => [...prev, ...toAdd]);
        setEditedRows((rows) => [
          ...rows,
          ...toAdd.map((h) => ({ ...JSON.parse(JSON.stringify(h)), sourceId: h.id, id: genId() })),
        ]);
      }
      window.alert(`Applied "${pack.label}". Added ${toAdd.length} recommended hazard row(s).`);
      trackEvent("rams_survey_pack_applied", { pack: pack.key, hazardsAdded: toAdd.length });
      return;
    }
    trackEvent("rams_survey_pack_applied", { pack: pack.key, hazardsAdded: 0 });
    window.alert(`Applied "${pack.label}". No matching hazard rows were found automatically; you can add hazards manually in Step 2.`);
  };

  const handleSave = () => {
    const highResidualRows = editedRows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
    if (highResidualRows > 0) {
      if (
        !window.confirm(
          `This RAMS has ${highResidualRows} hazard row(s) with HIGH residual risk after controls. Only save if that is intentional (e.g. further controls on site). Continue?`
        )
      ) {
        return;
      }
    }
    try {
      sessionStorage.removeItem(RAMS_DRAFT_KEY);
    } catch (e) {
      /* ignore */
    }
    const contentHash = computeRamsFingerprint(form, editedRows);
    const resolvedStatus = String(form.documentStatus || form.status || "draft");
    const previousStatus = String(editingDoc?.documentStatus || editingDoc?.status || "draft");
    const hasContentChanged = !!editingDoc && contentHash !== editingDoc.contentHash;
    const nextRevision =
      hasContentChanged && String(form.revision || "").trim().toUpperCase() === String(editingDoc?.revision || "").trim().toUpperCase()
        ? bumpRevisionCode(form.revision || editingDoc?.revision || "1A")
        : (form.revision || editingDoc?.revision || "1A");
    const nextRevisionSummary =
      String(form.revisionSummary || "").trim() || (editingDoc ? buildChangeSummary(editingDoc, { ...form, revision: nextRevision }, editedRows) : "");
    const qaChecksOnSave = buildQaChecklist(form, editedRows, (form.operativeIds || []).length);
    const qaPassOnSave = qaChecksOnSave.filter((x) => x.ok).length;
    const qaPctOnSave = qaChecksOnSave.length ? Math.round((qaPassOnSave / qaChecksOnSave.length) * 100) : 0;
    const selectedWorkersOnSave = (form.operativeIds || []).map((id) => workers.find((w) => w.id === id)).filter(Boolean);
    const competencyCheckOnSave = buildCompetencyRequirementCheck(form.surveyRequiredCerts, selectedWorkersOnSave);
    if (resolvedStatus === "issued" && competencyCheckOnSave.blocked) {
      const missingList = competencyCheckOnSave.missing
        .map((m) => {
          const expired = Array.isArray(m.expiredWorkers) ? m.expiredWorkers : [];
          if (expired.length === 0) return `- ${m.requirement}`;
          return `- ${m.requirement} (only expired in team: ${expired.join(", ")})`;
        })
        .join("\n");
      window.alert(
        `Cannot save as ISSUED: required competencies are missing in selected team.\n\n${missingList}\n\nAssign competent operatives or lower document status.`
      );
      return;
    }
    if (form.strictMode && ["approved", "issued"].includes(resolvedStatus) && qaPassOnSave !== qaChecksOnSave.length) {
      window.alert(
        `Strict mode blocks ${resolvedStatus.toUpperCase()}: ${qaPassOnSave}/${qaChecksOnSave.length} checks passed. Complete all strict checks or lower status.`
      );
      return;
    }
    if (resolvedStatus === "issued" && qaPassOnSave !== qaChecksOnSave.length) {
      window.alert(
        `Cannot save as ISSUED: ${qaPassOnSave}/${qaChecksOnSave.length} QA checks passed (${qaPctOnSave}%). Complete all checks or change status.`
      );
      return;
    }
    if (resolvedStatus === "approved" && qaPctOnSave < 84) {
      if (!window.confirm(`QA readiness is ${qaPctOnSave}%. Save as APPROVED anyway?`)) return;
    }
    let nextSignatureEvents = Array.isArray(form.signatureEvents) ? [...form.signatureEvents] : [];
    if (
      ["approved", "issued"].includes(resolvedStatus) &&
      String(form.approvedBy || "").trim() &&
      String(form.approvalDate || "").trim()
    ) {
      nextSignatureEvents = appendSignatureEvent(
        nextSignatureEvents,
        {
          action: "approval_signed",
          actor: String(form.approvedBy || "").trim(),
          role: "approver",
          status: resolvedStatus,
          revision: nextRevision,
          note: "Approval evidence captured on save.",
        },
        (x) =>
          x.action === "approval_signed" &&
          String(x.revision || "") === String(nextRevision) &&
          String(x.actor || "").trim().toLowerCase() === String(form.approvedBy || "").trim().toLowerCase()
      );
    }
    if (resolvedStatus === "issued" && previousStatus !== "issued") {
      nextSignatureEvents = appendSignatureEvent(nextSignatureEvents, {
        action: "issue_released",
        actor: String(form.leadEngineer || "").trim() || String(form.approvedBy || "").trim() || "Document controller",
        role: "issuer",
        status: resolvedStatus,
        revision: nextRevision,
        note: "Document moved to ISSUED status.",
      });
    }
    const doc = {
      ...form,
      documentNo: form.documentNo || generateRamsDocNo(),
      revision: nextRevision,
      revisionSummary: nextRevisionSummary,
      signatureEvents: nextSignatureEvents,
      id: editingDoc?.id || genId(),
      rows: editedRows,
      status: resolvedStatus,
      isFavorite: !!editingDoc?.isFavorite,
      createdAt: editingDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contentHash,
    };
    const usedTemplateIds = Array.from(
      new Set(
        (editedRows || [])
          .map((r) => String(r.sourceId || "").trim())
          .filter(Boolean)
      )
    );
    if (usedTemplateIds.length > 0) {
      setHazardPrefs((prev) => {
        const base = prev?.usageCounts || {};
        const nextCounts = { ...base };
        usedTemplateIds.forEach((id) => {
          nextCounts[id] = Number(nextCounts[id] || 0) + 1;
        });
        return {
          favoriteIds: prev?.favoriteIds || [],
          usageCounts: nextCounts,
          recentIds: prev?.recentIds || [],
        };
      });
    }
    setRamsDocs(prev => editingDoc
      ? prev.map(d=>d.id===doc.id?doc:d)
      : [doc,...prev]
    );
    setView("list");
  };

  const deleteDoc = (id) => {
    if (!confirm("Delete this RAMS?")) return;
    setRamsDocs((prev) => {
      const victim = prev.find((d) => d.id === id);
      if (victim) {
        pushRecycleBinItem({
          moduleId: "rams",
          moduleLabel: "RAMS",
          itemType: "rams_document",
          itemLabel: victim.title || victim.documentNo || victim.id,
          sourceKey: "rams_builder_docs",
          payload: victim,
        });
      }
      return prev.filter((d) => d.id !== id);
    });
  };

  const previewSavedDoc = (doc) => {
    openRamsDocumentWindow(doc, doc.rows || [], workers, projects, { print: false });
  };

  const printSavedDoc = (doc) => {
    openRamsPrintWindow(doc, doc.rows || [], workers, projects);
  };

  const buildSitePackMeta = (doc, permitsForProject) => {
    let org = {};
    try {
      org = JSON.parse(localStorage.getItem("mysafeops_org_settings") || "{}");
    } catch {
      org = {};
    }
    const contactMap = new Map();
    const pushContact = (name, role, channel = "") => {
      const trimmed = String(name || "").trim();
      if (!trimmed) return;
      const key = `${trimmed.toLowerCase()}|${String(role || "").toLowerCase()}|${String(channel || "").toLowerCase()}`;
      if (!contactMap.has(key)) {
        contactMap.set(key, { name: trimmed, role: role || "", channel: channel || "" });
      }
    };
    pushContact(doc.leadEngineer, "Lead engineer");
    pushContact(org.emergencyContact, "Emergency contact");
    permitsForProject.forEach((p) => {
      pushContact(p.issuedBy, "Permit issuer");
      pushContact(p.issuedTo, "Permit holder");
    });

    const allAudit = permitsForProject.flatMap((p) =>
      (Array.isArray(p.auditLog) ? p.auditLog : []).map((entry) => ({
        at: entry.at || p.updatedAt || p.createdAt || "",
        action: entry.action || "updated",
        permitId: p.id,
      }))
    );
    const auditSummary = {
      total: allAudit.length,
      created: allAudit.filter((x) => x.action === "created").length,
      updated: allAudit.filter((x) => x.action === "updated").length,
      statusChanged: allAudit.filter((x) => x.action === "status_changed").length,
      deleted: allAudit.filter((x) => x.action === "deleted").length,
    };
    const recentAudit = [...allAudit]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 12);
    const projectName = projects.find((p) => p.id === doc.projectId)?.name || "";
    return {
      generatedAt: new Date().toISOString(),
      projectName,
      contacts: Array.from(contactMap.values()),
      auditSummary,
      recentAudit,
    };
  };

  const printProjectPackForDoc = (doc) => {
    const allPermits = load("permits_v2", []);
    if (!doc.projectId) {
      window.alert(
        "To build an A4 pack with permits, open Edit on this RAMS and set the Project (Document info). Permits must use the same project in the Permits module."
      );
      return;
    }
    const forProject = allPermits.filter((p) => p.projectId === doc.projectId);
    if (forProject.length === 0) {
      window.alert(
        "No permits are stored for this project. In Permits, create or edit permits and assign the same project as this RAMS."
      );
      return;
    }
    const sitePackMeta = buildSitePackMeta(doc, forProject);
    trackEvent("rams_site_pack_opened", { permitCount: forProject.length });
    openRamsDocumentWindow(doc, doc.rows || [], workers, projects, {
      print: false,
      permits: forProject,
      sitePackMeta,
    });
  };

  const duplicateDoc = (doc) => {
    const { shareToken: _st, contentHash: _ch, id: _oid, rows: srcRows, ...rest } = doc;
    const rows = JSON.parse(JSON.stringify(srcRows || []));
    const newDoc = {
      ...RAMS_FORM_DEFAULTS,
      ...rest,
      id: genId(),
      title: `${doc.title || "RAMS"} (copy)`,
      documentNo: generateRamsDocNo(),
      issueDate: today(),
      rows,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareToken: undefined,
      contentHash: undefined,
      status: "draft",
      isFavorite: false,
    };
    newDoc.contentHash = computeRamsFingerprint(newDoc, rows);
    setRamsDocs((prev) => [newDoc, ...prev]);
  };

  const renameDoc = (doc) => {
    const current = String(doc?.title || "").trim();
    const next = prompt("Rename RAMS document title:", current || "RAMS");
    if (next == null) return;
    const clean = String(next).trim();
    if (!clean) {
      alert("Title cannot be empty.");
      return;
    }
    setRamsDocs((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? {
              ...d,
              title: clean,
              updatedAt: new Date().toISOString(),
            }
          : d
      )
    );
  };

  const exportDocJson = (doc) => {
    const safe = (doc.title || "rams").replace(/[^\w\-\s]/g, "").replace(/\s+/g, "_").slice(0, 48);
    const wm = Object.fromEntries(workers.map((w) => [w.id, w.name || ""]));
    const operativeNames = (doc.operativeIds || []).map((id) => wm[id] || "");
    const payload = {
      ...doc,
      _mysafeops_export: {
        version: 1,
        exportedAt: new Date().toISOString(),
        operativeNames,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}_${(doc.id || "").slice(-8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportComplianceSnapshot = (doc) => {
    const rows = doc.rows || [];
    const opCount = (doc.operativeIds || []).length;
    const qaChecks = buildQaChecklist(doc, rows, opCount);
    const readiness = computeRamsReadiness(rows, opCount);
    const byCategory = buildCategoryRiskTrend(rows);
    const totals = {
      riskRows: rows.length,
      highResidual: rows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length,
      mediumResidual: rows.filter((r) => getRiskLevel(r.revisedRisk) === "medium").length,
      lowResidual: rows.filter((r) => getRiskLevel(r.revisedRisk) === "low").length,
      operatives: opCount,
    };
    const csvEsc = (value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
    const csvRows = [];
    csvRows.push(["section","key","value"]);
    csvRows.push(["document","documentNo", doc.documentNo || doc.id || ""]);
    csvRows.push(["document","title", doc.title || ""]);
    csvRows.push(["document","status", doc.documentStatus || doc.status || "draft"]);
    csvRows.push(["document","issueDate", doc.issueDate || ""]);
    csvRows.push(["document","revision", doc.revision || ""]);
    csvRows.push(["document","reviewDate", doc.reviewDate || ""]);
    csvRows.push(["document","fingerprint", doc.contentHash || computeRamsFingerprint(doc, rows)]);
    csvRows.push(["document","generatedAt", new Date().toISOString()]);
    csvRows.push(["totals","riskRows", totals.riskRows]);
    csvRows.push(["totals","highResidual", totals.highResidual]);
    csvRows.push(["totals","mediumResidual", totals.mediumResidual]);
    csvRows.push(["totals","lowResidual", totals.lowResidual]);
    csvRows.push(["totals","operatives", totals.operatives]);
    csvRows.push(["readiness","score", readiness.score]);
    csvRows.push(["readiness","grade", readiness.grade]);
    csvRows.push(["readiness","summary", readiness.summary || ""]);
    qaChecks.forEach((check, idx) => {
      csvRows.push(["qaChecklist", `check_${idx + 1}`, `${check.ok ? "PASS" : "CHECK"} - ${check.label}`]);
    });
    byCategory.forEach((cat) => {
      csvRows.push(["categoryTrend", `${cat.category} rows`, cat.count]);
      csvRows.push(["categoryTrend", `${cat.category} initialAvg`, cat.initialAvg]);
      csvRows.push(["categoryTrend", `${cat.category} residualAvg`, cat.residualAvg]);
      csvRows.push(["categoryTrend", `${cat.category} reductionPct`, cat.reduction]);
    });
    (Array.isArray(doc.signatureEvents) ? doc.signatureEvents : []).forEach((sig, idx) => {
      csvRows.push([
        "signatureEvents",
        `event_${idx + 1}`,
        `${sig?.action || "action"} | ${sig?.actor || "actor"} | ${sig?.role || "role"} | ${sig?.at || ""}`,
      ]);
    });
    csvRows.push(["handover","client", doc.handoverClientName || ""]);
    csvRows.push(["handover","receiver", doc.handoverReceiver || ""]);
    csvRows.push(["handover","date", doc.handoverDate || ""]);
    csvRows.push(["handover","notes", doc.handoverNotes || ""]);
    const safe = (doc.title || "rams_compliance").replace(/[^\w\-\s]/g, "").replace(/\s+/g, "_").slice(0, 48);
    const csv = csvRows.map((row) => row.map(csvEsc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}_${(doc.id || "").slice(-8)}_compliance.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importRamsJson = (parsed) => {
    if (!parsed || typeof parsed !== "object") throw new Error("File must contain a JSON object.");
    if (!Array.isArray(parsed.rows)) throw new Error('Expected a "rows" array (hazard lines). Export from MySafeOps or use a compatible backup.');
    const rows = parsed.rows.map((r) => ({ ...r, id: genId() }));
    const {
      id: _i,
      shareToken: _st,
      contentHash: _ch,
      rows: _r,
      createdAt: _c,
      updatedAt: _u,
      _mysafeops_export: exportMeta,
      ...rest
    } = parsed;
    const rawOpIds = Array.isArray(parsed.operativeIds) ? parsed.operativeIds : [];
    const operativeNames = exportMeta?.operativeNames;
    const operativeIds = remapOperativeIds(rawOpIds, operativeNames, workers);
    const doc = {
      ...RAMS_FORM_DEFAULTS,
      ...rest,
      id: genId(),
      rows,
      operativeIds,
      title: (typeof parsed.title === "string" && parsed.title.trim()) ? parsed.title.trim() : "Imported RAMS",
      documentNo: String(parsed.documentNo || "").trim() || generateRamsDocNo(),
      issueDate: parsed.issueDate || today(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareToken: undefined,
      status: parsed.status || "draft",
      isFavorite: !!parsed.isFavorite,
    };
    doc.contentHash = computeRamsFingerprint(doc, rows);
    setRamsDocs((prev) => [doc, ...prev]);
    alert(`Imported: ${doc.title}`);
  };

  const genShareToken = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;

  const copyShareLink = (doc) => {
    let token = doc.shareToken;
    if (!token) {
      token = genShareToken();
      setRamsDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, shareToken: token, updatedAt: new Date().toISOString() } : d
        )
      );
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const url = `${base}?ramsShare=${encodeURIComponent(token)}`;
    navigator.clipboard?.writeText(url).then(() =>
      alert("Link copied. Opens read-only RAMS in this browser only (same saved data as here).")
    );
  };

  const STEPS = ["Document info","Select hazards","Review & edit","Preview & save"];

  if (view==="list") {
    return (
      <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
        <PageHero
          badgeText="RAMS"
          title="RAMS builder"
          lead="Build RAMS from the hazard library — export/import JSON, share read-only links, optional operative certificates from Workers, site weather and map links. Unsaved work is kept as a draft in this browser for up to a week — choose &quot;Resume&quot; when you start a new RAMS."
        />
        <SavedList
          ramsDocs={ramsDocs}
          workers={workers}
          projects={projects}
          onNew={startNew}
          onEdit={startEdit}
          onRename={renameDoc}
          onDelete={deleteDoc}
          onPreview={previewSavedDoc}
          onPrint={printSavedDoc}
          onPrintProjectPack={printProjectPackForDoc}
          onDuplicate={duplicateDoc}
          onExportJson={exportDocJson}
          onExportCompliance={exportComplianceSnapshot}
          onToggleFavorite={toggleFavoriteDoc}
          onCopyShareLink={copyShareLink}
          onImportJson={importRamsJson}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {/* header */}
      <div
        className="app-panel-surface app-rams-builder-header"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
          padding: "15px 14px 14px",
        }}
      >
        <button type="button" onClick={goToList} style={{ ...ss.btn, fontSize: 12 }}>
          ← Back to list
        </button>
        <h2 style={{ fontWeight: 600, fontSize: 17, margin: 0, flex: "1 1 200px", letterSpacing: "-0.02em" }}>
          {editingDoc ? `Edit: ${form.title || "Untitled"}` : "New RAMS"}
        </h2>
      </div>

      {/* step progress — click a completed step to go back */}
      <div className="app-rams-stepper" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const done = stepNum < step;
          const current = stepNum === step;
          const canGoBack = step > stepNum;
          return (
            <div key={i} style={{ flex: "1 1 120px", textAlign: "center", minWidth: 0 }}>
              <button
                type="button"
                className="app-rams-stepper-btn"
                disabled={!canGoBack}
                onClick={() => canGoBack && setStep(stepNum)}
                aria-label={canGoBack ? `Go back to step ${stepNum}: ${s}` : current ? `Current step: ${s}` : `Step ${stepNum}: ${s}`}
                aria-current={current ? "step" : undefined}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  padding: "4px 4px 0",
                  cursor: canGoBack ? "pointer" : "default",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <div
                    className="app-rams-stepper-dot"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-full, 9999px)",
                      background: done ? "var(--color-accent,#0d9488)" : current ? "#f97316" : "var(--color-background-primary,#fff)",
                      color: done || current ? "#fff" : "var(--color-text-muted,#94a3b8)",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: current ? "2px solid #fdba74" : done ? "none" : "1px solid var(--color-border-tertiary)",
                      boxShadow: current ? "0 0 0 4px rgba(249, 115, 22, 0.2)" : done ? "0 2px 8px rgba(13, 148, 136, 0.25)" : "var(--shadow-sm)",
                      pointerEvents: "none",
                    }}
                  >
                    {stepNum}
                  </div>
                </div>
                <div
                  className="app-stepper-segment"
                  style={{
                    height: 4,
                    borderRadius: 4,
                    background: done ? "var(--color-accent,#0d9488)" : current ? "#fed7aa" : "var(--color-border-tertiary)",
                    marginBottom: 8,
                    maxWidth: 100,
                    marginLeft: "auto",
                    marginRight: "auto",
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: current ? 600 : 500,
                    color: current ? "#c2410c" : done ? "var(--color-accent-hover,#0f766e)" : "var(--color-text-secondary)",
                    lineHeight: 1.35,
                    display: "block",
                    pointerEvents: "none",
                  }}
                >
                  {s}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* steps */}
      <div className="app-rams-step-body">
        {step===1 && (
          <StepInfo
            form={form}
            setForm={setForm}
            projects={projects}
            workers={workers}
            onApplySurveyPack={applySurveyPack}
            onNext={() => setStep(2)}
          />
        )}
        {step===2 && (
          <HazardPicker
            selected={selectedHazards}
            selectedRows={editedRows}
            orgActivities={orgActivities}
            hazardPrefs={hazardPrefs}
            hazardPacks={hazardPacks}
            projectId={form.projectId}
            surveyWorkType={form.surveyWorkType}
            onToggle={toggleHazard}
            onClearSelected={clearHazardSelection}
            onAddAllVisible={addHazardsVisible}
            onCreateOrgActivity={addOrgActivityTemplate}
            onDeleteOrgActivity={deleteOrgActivityTemplate}
            onToggleHazardFavorite={toggleHazardFavorite}
            onSaveHazardPack={saveHazardPack}
            onApplyHazardPack={applyHazardPack}
            onRenameHazardPack={renameHazardPack}
            onDeleteHazardPack={deleteHazardPack}
            onTogglePinHazardPack={togglePinHazardPack}
            onSetHazardPackStatus={setHazardPackStatus}
            onCreateHazardPackVersion={createHazardPackVersion}
            onRollbackHazardPackVersion={rollbackHazardPackVersion}
            onExportHazardPacks={exportHazardPacks}
            onImportHazardPacks={importHazardPacks}
            onImportFromLastProject={importFromLastProject}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step===3 && <HazardEditor rows={editedRows} setRows={setEditedRows} onNext={()=>setStep(4)} onBack={() => setStep(2)} />}
        {step===4 && (
          <PreviewSave
            form={form}
            setForm={setForm}
            rows={editedRows}
            workers={workers}
            projects={projects}
            editingDoc={editingDoc}
            onSave={handleSave}
            onBack={()=>setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
