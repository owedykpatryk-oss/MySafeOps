/**
 * Shared RAMS → print HTML + fingerprint (used by builder and public share view).
 */
import { getRiskLevel } from "./ramsAllHazards";
import { normalizePrintSections, RAMS_SECTION_IDS, documentContentHash } from "./ramsSectionConfig";
import { renderPermitDocumentHtml } from "../permits/PermitSystem.jsx";

const RL = {
  high: { bg: "#FCEBEB", color: "#791F1F" },
  medium: { bg: "#FAEEDA", color: "#633806" },
  low: { bg: "#EAF3DE", color: "#27500A" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskScore(risk) {
  const l = Number(risk?.L || 0);
  const s = Number(risk?.S || 0);
  return l * s;
}

const RISK_AXIS = [2, 4, 6];

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

function buildQaChecklist(form, rows, operatives) {
  const list = rows || [];
  const hasRows = list.length > 0;
  const controlsCoverage = hasRows
    ? list.every((r) => Array.isArray(r.controlMeasures) && r.controlMeasures.filter(Boolean).length > 0)
    : false;
  const noHighResidual = hasRows ? list.every((r) => getRiskLevel(r.revisedRisk) !== "high") : false;
  const needsApproval = ["approved", "issued"].includes(String(form.documentStatus || form.status || ""));
  const strictChecks = buildStrictQaChecks(form, rows);
  return [
    { label: "Header complete (title, location, document no.)", ok: !!(form.title && form.location && form.documentNo) },
    { label: "At least one risk row selected", ok: hasRows },
    { label: "Every risk row has control measures", ok: controlsCoverage },
    { label: "No residual HIGH risks", ok: noHighResidual },
    { label: "Operatives assigned for briefing/sign-off", ok: (operatives || []).length > 0 },
    {
      label: "Approval fields complete for approved/issued status",
      ok: !needsApproval || (!!form.approvedBy && !!form.approvalDate),
    },
    ...strictChecks,
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
  const byCat = new Map();
  (rows || []).forEach((r) => {
    const key = String(r.category || "Uncategorised");
    if (!byCat.has(key)) {
      byCat.set(key, { category: key, count: 0, initial: 0, residual: 0 });
    }
    const rec = byCat.get(key);
    rec.count += 1;
    rec.initial += riskScore(r.initialRisk);
    rec.residual += riskScore(r.revisedRisk);
  });
  return Array.from(byCat.values())
    .map((c) => {
      const initialAvg = c.count ? c.initial / c.count : 0;
      const residualAvg = c.count ? c.residual / c.count : 0;
      const reduction = initialAvg > 0 ? Math.max(0, ((initialAvg - residualAvg) / initialAvg) * 100) : 0;
      return {
        category: c.category,
        count: c.count,
        initialAvg: Number(initialAvg.toFixed(1)),
        residualAvg: Number(residualAvg.toFixed(1)),
        reduction: Math.round(reduction),
      };
    })
    .sort((a, b) => b.initialAvg - a.initialAvg)
    .slice(0, 8);
}

function textHasAny(text, needles) {
  const t = String(text || "").toLowerCase();
  return (needles || []).some((n) => t.includes(String(n).toLowerCase()));
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
  const stopWorkFor = (text, revisedRisk) => {
    const list = [
      "Stop if controls cannot be implemented as written.",
      "Stop for unsafe weather/visibility or changing site conditions.",
      "Stop if exclusion zone integrity is lost.",
    ];
    if (textHasAny(text, ["electrical", "live cable", "utility"])) list.push("Stop on uncharted/live service exposure.");
    if (textHasAny(text, ["height", "ladder", "roof", "mewp"])) list.push("Stop if fall prevention systems are missing.");
    if (textHasAny(text, ["confined", "gas", "fume"])) list.push("Stop if atmosphere test fails or monitor alarms.");
    if (getRiskLevel(revisedRisk) === "high") list.push("Escalate to approver before resuming (residual HIGH).");
    return list.slice(0, 5);
  };
  const emergencyFor = (text) => {
    const list = ["Raise alarm, make area safe, and contact site emergency coordinator."];
    if (textHasAny(text, ["electrical"])) list.push("Isolate supply only if trained and safe.");
    if (textHasAny(text, ["chemical", "fume", "spill"])) list.push("Follow SDS first-aid/spill response route.");
    if (textHasAny(text, ["traffic", "vehicle"])) list.push("Secure route and follow traffic incident protocol.");
    if (textHasAny(text, ["height", "fall"])) list.push("Activate rescue plan immediately.");
    return list.slice(0, 4);
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
      "Re-check controls after interruption, weather shift, or interface conflict.",
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
    const initial = riskScore(r.initialRisk);
    const residual = riskScore(r.revisedRisk);
    return {
      id: r.id || `row_${idx}`,
      stepNo: idx + 1,
      title: r.activity || "Activity",
      hazard: r.hazard || "Hazard not specified",
      initial,
      residual,
      reductionPct: Math.max(0, Math.round(((Math.max(1, initial) - residual) / Math.max(1, initial)) * 100)),
      controlTree,
      permitDeps: permitDependenciesFor(text),
      verifyChecks: [
        "Pre-start briefing delivered and understood.",
        "Controls physically in place before work starts.",
        "Supervisor check completed at start and after change.",
      ],
      stopWork: stopWorkFor(text, r.revisedRisk),
      emergency: emergencyFor(text),
      roleAssignments: roleAssignmentsFor(text, controlTree),
      phaseControls: phaseControlsFor(text),
      holdPoints: holdPointsFor(text),
      environmental: [
        "Maintain housekeeping and prevent debris/waste escape.",
        textHasAny(text, ["spill", "fuel", "oil", "chemical"]) ? "Use drip trays/spill kit at point of work." : "Control pollution pathways and drainage.",
        textHasAny(text, ["dust", "cutting", "grinding", "noise"]) ? "Apply dust/noise controls and working time limits." : "Monitor nuisance impact during task.",
      ],
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

/** Human-readable competency line from Workers record (certs text + structured certifications). */
export function formatOperativeCertsLine(w) {
  if (!w) return "";
  const parts = [];
  if (w.certs?.trim()) parts.push(w.certs.trim());
  (w.certifications || []).forEach((c) => {
    if (c?.certType && c?.expiryDate) {
      parts.push(`${c.certType} (exp. ${fmtDate(c.expiryDate)})`);
    } else if (c?.certType) {
      parts.push(c.certType);
    }
  });
  return parts.join(" · ");
}

function escHtml(s) {
  if (s == null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRamsShareUrl(form) {
  const token = String(form?.shareToken || "").trim();
  if (!token || typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}?ramsShare=${encodeURIComponent(token)}`;
}

function buildQrSrc(text, size = 126) {
  return `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(String(text || ""))}`;
}

export function ramsHashPayload(form, rows) {
  return {
    title: form.title,
    location: form.location,
    scope: form.scope,
    surveyWorkType: form.surveyWorkType,
    surveyWorkTypeLabel: form.surveyWorkTypeLabel,
    surveyMethodStatement: form.surveyMethodStatement,
    surveyDeliverables: form.surveyDeliverables,
    surveyAssumptions: form.surveyAssumptions,
    communicationPlan: form.communicationPlan,
    handoverClientName: form.handoverClientName,
    handoverReceiver: form.handoverReceiver,
    handoverDate: form.handoverDate,
    handoverNotes: form.handoverNotes,
    documentNo: form.documentNo,
    documentStatus: form.documentStatus || form.status,
    issueDate: form.issueDate,
    strictMode: !!form.strictMode,
    strictMinControls: Number(form.strictMinControls || 0),
    strictRequireHoldPoints: !!form.strictRequireHoldPoints,
    date: form.date,
    siteWeatherNote: form.siteWeatherNote,
    siteMapUrl: form.siteMapUrl,
    siteLat: form.siteLat,
    siteLng: form.siteLng,
    nearestHospital: form.nearestHospital,
    hospitalDirectionsUrl: form.hospitalDirectionsUrl,
    printSections: form.printSections,
    operativeIds: form.operativeIds || [],
    rows: (rows || []).map((r) => ({
      id: r.id,
      activity: r.activity,
      hazard: r.hazard,
      initialRisk: r.initialRisk,
      revisedRisk: r.revisedRisk,
      controlMeasures: r.controlMeasures,
    })),
  };
}

export function computeRamsFingerprint(form, rows) {
  return documentContentHash(ramsHashPayload(form, rows));
}

function ramsDocumentCss() {
  return `
    @page { size: A4; margin: 12mm; }
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;padding:16px 16px 36px;box-sizing:border-box;position:relative}
    h1{font-size:16px;font-weight:bold;text-align:center;background:#f97316;color:#fff;padding:10px;margin:0 0 16px}
    .header-table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .header-table td{padding:4px 8px;font-size:11px;border:0.5px solid #ccc}
    .header-table .lbl{color:#666;font-weight:bold}
    table.ra{width:100%;border-collapse:collapse;margin-bottom:20px}
    table.ra th{background:#0f172a;color:#fff;padding:8px;font-size:11px;text-align:left;border:1px solid #0f172a}
    .rams-watermark{
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      pointer-events:none;
      font-size:84px;
      font-weight:800;
      letter-spacing:0.14em;
      color:rgba(100,116,139,0.10);
      transform:rotate(-28deg);
      z-index:0;
      text-transform:uppercase;
    }
    .rams-content{position:relative;z-index:1}
    .cover-page{
      position:relative;
      border:1px solid #dbe2ea;
      border-radius:14px;
      padding:22px 22px 20px;
      background:linear-gradient(180deg,#f8fbff 0%,#ffffff 62%);
      margin-bottom:12px;
    }
    .cover-meta{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
      margin-top:14px;
    }
    .cover-kpi{
      border:1px solid #e5e7eb;
      border-radius:8px;
      padding:6px 8px;
      background:#fff;
      font-size:11px;
    }
    .page-footer{
      position:fixed;
      left:0;
      right:0;
      bottom:0;
      padding:6px 16px 8px;
      font-size:10px;
      color:#64748b;
      border-top:1px solid #e5e7eb;
      background:#fff;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }
    .page-footer .page-num::after{
      content:"Page " counter(page);
    }
    @media print{
      body{padding:0}
      .cover-page{min-height:248mm;page-break-after:always}
      .pack-rams{page-break-after:always}
      .pack-permit-wrap{page-break-before:always}
      h1,h2,.header,.ptw-type{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  `;
}

function wrapRamsPrintDocument(pageTitle, bodyInner, extraHeadCss = "", footerMeta = "") {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(pageTitle)}</title>
  <style>${ramsDocumentCss()}${extraHeadCss || ""}</style></head><body>${bodyInner}
  <div class="page-footer"><span>${escHtml(footerMeta)}</span><span class="page-num"></span></div>
  </body></html>`;
}

function splitPermitDocumentHtml(fullHtml) {
  const styleM = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
  const bodyM = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return {
    style: styleM ? styleM[1].trim() : "",
    body: bodyM ? bodyM[1].trim() : "",
  };
}

/** RAMS body only (no html/head wrapper). */
function buildRamsPrintBodyHTML(form, rows, operatives, projectMap, printFlags, contentFingerprint, workersAll) {
  const rowList = rows || [];
  const opList = operatives || [];
  const pf = printFlags || normalizePrintSections({});
  const projName = form.projectId ? projectMap[form.projectId] || "" : "";
  const initialHighCount = rowList.filter((r) => getRiskLevel(r.initialRisk) === "high").length;
  const residualHighCount = rowList.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
  const residualMediumCount = rowList.filter((r) => getRiskLevel(r.revisedRisk) === "medium").length;
  const residualLowCount = rowList.filter((r) => getRiskLevel(r.revisedRisk) === "low").length;
  const matrixCounts = buildRiskMatrixCounts(rowList, "revisedRisk");
  const controlsCount = rowList.reduce((acc, r) => acc + (r.controlMeasures || []).filter(Boolean).length, 0);
  const ppeRollup = Array.from(
    new Set(
      rowList
        .flatMap((r) => r.ppeRequired || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const regsRollup = Array.from(
    new Set(
      rowList
        .flatMap((r) => r.regs || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const qaChecks = buildQaChecklist(form, rowList, opList);
  const qaPass = qaChecks.filter((x) => x.ok).length;
  const qaPct = qaChecks.length ? Math.round((qaPass / qaChecks.length) * 100) : 0;
  const categoryTrend = buildCategoryRiskTrend(rowList);
  const detailedControlPack = buildDetailedControlMethodPack(rowList);
  const controlAssurance = buildControlAssuranceSummary(detailedControlPack);
  const briefingPoints = [...rowList]
    .sort((a, b) => riskScore(b.revisedRisk) - riskScore(a.revisedRisk))
    .slice(0, 5)
    .map((r) => ({
      rf: riskScore(r.revisedRisk),
      text: `${r.activity || "Activity"} — ${r.hazard || "Hazard"} · controls: ${(r.controlMeasures || []).slice(0, 2).join("; ") || "review controls before start"}`,
    }));
  const handoverChecks = [
    { label: "RAMS document shared with client/receiver", ok: !!(form.handoverClientName && form.handoverReceiver) },
    { label: "Issue date and status communicated", ok: !!(form.issueDate && (form.documentStatus || form.status)) },
    { label: "Residual risk briefing completed", ok: residualHighCount === 0 || !!form.handoverNotes },
    { label: "Emergency route and permit interface confirmed", ok: !!(form.hospitalDirectionsUrl || projName) },
  ];
  const competencyAlerts =
    workersAll?.length && (form.operativeIds || []).length > 0
      ? (form.operativeIds || [])
          .map((id) => workersAll.find((w) => w.id === id))
          .filter(Boolean)
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
          .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
      : [];
  const avgReduction =
    rowList.length > 0
      ? Math.round(
          rowList.reduce((acc, r) => {
            const before = Math.max(1, riskScore(r.initialRisk));
            const after = Math.max(0, riskScore(r.revisedRisk));
            return acc + Math.max(0, ((before - after) / before) * 100);
          }, 0) / rowList.length
        )
      : 0;

  const rowsHTML = rowList
    .map(
      (r, idx) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e5e5;font-weight:500;vertical-align:top;font-size:12px">${idx + 1}. ${escHtml(r.activity)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:top;font-size:12px">${escHtml(r.hazard)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;vertical-align:top;font-size:12px;background:${RL[getRiskLevel(r.initialRisk)]?.bg}">
        ${r.initialRisk.L}<br/>${r.initialRisk.S}<br/><strong>${riskScore(r.initialRisk)}</strong>
      </td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:top;font-size:11px"><ol style="margin:0;padding-left:16px">${(r.controlMeasures || []).map((cm) => `<li style="margin-bottom:4px">${escHtml(cm)}</li>`).join("")}</ol></td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;vertical-align:top;font-size:12px;background:${RL[getRiskLevel(r.revisedRisk)]?.bg}">
        ${r.revisedRisk.L}<br/>${r.revisedRisk.S}<br/><strong>${riskScore(r.revisedRisk)}</strong>
      </td>
    </tr>`
    )
    .join("");

  const sigRows = opList
    .map(
      (n) => `
    <tr style="height:40px">
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:12px">${escHtml(n)}</td>
      <td style="border:1px solid #e5e5e5"></td>
      <td style="border:1px solid #e5e5e5"></td>
    </tr>`
    )
    .join("");

  const weatherBlock =
    pf[RAMS_SECTION_IDS.WEATHER] && (form.siteWeatherNote || "").trim()
      ? `<h2 style="font-size:13px;margin:18px 0 8px">2. Site weather</h2>
         <p style="font-size:12px;white-space:pre-wrap;margin:0 0 12px">${escHtml(form.siteWeatherNote)}</p>`
      : "";

  const mapBlock =
    pf[RAMS_SECTION_IDS.MAP] &&
    ((form.siteMapUrl || "").trim() || ((form.siteLat || "").trim() && (form.siteLng || "").trim()))
      ? `<h2 style="font-size:13px;margin:18px 0 8px">3. Site map / location</h2>
         ${(form.siteMapUrl || "").trim() ? `<p style="font-size:12px;word-break:break-all"><a href="${escHtml(form.siteMapUrl)}">${escHtml(form.siteMapUrl)}</a></p>` : ""}
         ${(form.siteLat || "").trim() && (form.siteLng || "").trim()
        ? `<p style="font-size:12px">Coordinates: ${escHtml(form.siteLat)}, ${escHtml(form.siteLng)}</p>`
        : ""}`
      : "";

  const hospitalBlock =
    pf[RAMS_SECTION_IDS.HOSPITAL] &&
    ((form.nearestHospital || "").trim() || (form.hospitalDirectionsUrl || "").trim())
      ? `<h2 style="font-size:13px;margin:18px 0 8px">4. Emergency response</h2>
         <p style="font-size:11px;color:#64748b;margin:0 0 6px">Nearest A&amp;E / hospital</p>
         ${(form.nearestHospital || "").trim() ? `<p style="font-size:12px;margin:4px 0">${escHtml(form.nearestHospital)}</p>` : ""}
         ${(form.hospitalDirectionsUrl || "").trim()
        ? `<p style="font-size:12px;word-break:break-all"><a href="${escHtml(form.hospitalDirectionsUrl)}">Directions</a></p>`
        : ""}`
      : "";

  const operativeCertsBlock =
    pf[RAMS_SECTION_IDS.OPERATIVE_CERTS] &&
    workersAll?.length &&
    (form.operativeIds || []).length > 0
      ? (() => {
          const selected = (form.operativeIds || [])
            .map((id) => workersAll.find((w) => w.id === id))
            .filter(Boolean);
          if (!selected.length) return "";
          const certRows = selected
            .map(
              (w) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:12px;font-weight:500;vertical-align:top">${escHtml(w.name)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;vertical-align:top">${escHtml(w.role || "—")}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;vertical-align:top">${escHtml(formatOperativeCertsLine(w) || "—")}</td>
    </tr>`
            )
            .join("");
          return `<h2 style="font-size:13px;margin:18px 0 8px">5. Competence matrix</h2>
  <p style="font-size:10px;color:#666;margin:0 0 8px">From Workers module — verify training and expiry on site.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:22%">Name</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:18%">Role</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Certificates / notes</th>
    </tr></thead>
    <tbody>${certRows}</tbody>
  </table>`;
        })()
      : "";

  const riskTable =
    pf[RAMS_SECTION_IDS.HAZARDS] && rowList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">6. Risk assessment and controls</h2>
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fafafa">
    <div style="font-size:11px;color:#334155;margin-bottom:8px">
      ${rowList.length} assessed activities · Initial high risk: <strong>${initialHighCount}</strong> · Residual high: <strong>${residualHighCount}</strong>
    </div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span style="font-size:10px;background:#FCEBEB;color:#791F1F;padding:2px 8px;border-radius:999px">High ${residualHighCount}</span>
      <span style="font-size:10px;background:#FAEEDA;color:#633806;padding:2px 8px;border-radius:999px">Medium ${residualMediumCount}</span>
      <span style="font-size:10px;background:#EAF3DE;color:#27500A;padding:2px 8px;border-radius:999px">Low ${residualLowCount}</span>
      <span style="font-size:10px;background:#E6F1FB;color:#0C447C;padding:2px 8px;border-radius:999px">Avg reduction ${avgReduction}%</span>
    </div>
  </div>
  <table class="ra">
    <thead><tr>
      <th style="width:18%">Activity</th>
      <th style="width:18%">Additional hazard</th>
      <th style="width:10%">Risk factor<br/>L / S / RF</th>
      <th style="width:40%">Control measures</th>
      <th style="width:10%">Revised RF<br/>L / S / RF</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>`
      : "";

  const readinessScore =
    rowList.length > 0
      ? Math.max(
          0,
          Math.min(
            100,
            52 +
              Math.round((rowList.filter((r) => (r.controlMeasures || []).filter(Boolean).length > 0).length / rowList.length) * 26) +
              Math.round(Math.min(22, avgReduction * 0.32)) -
              residualHighCount * 7 +
              (opList.length > 0 ? 4 : 0)
          )
        )
      : 0;
  const readinessGrade =
    readinessScore >= 86 ? "A" : readinessScore >= 72 ? "B" : readinessScore >= 58 ? "C" : readinessScore >= 42 ? "D" : readinessScore > 0 ? "E" : "N/A";

  const readinessBlock =
    rowList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Executive readiness dashboard</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
    <tbody>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Readiness score</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px"><strong>${readinessScore}/100</strong> (Grade ${readinessGrade})</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Risk rows</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${rowList.length}</td>
      </tr>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Controls listed</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${controlsCount}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Average reduction</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${avgReduction}%</td>
      </tr>
    </tbody>
  </table>`
      : "";

  const matrixRows = RISK_AXIS.map((l) => {
    const cells = RISK_AXIS.map((s) => {
      const key = `${l}x${s}`;
      const score = l * s;
      const lvl = getRiskLevel({ RF: score });
      const c = RL[lvl];
      return `<td style="padding:6px;border:1px solid #e5e5e5;text-align:center;background:${c.bg};color:${c.color};font-size:11px;font-weight:600">${score}<br/>${matrixCounts[key] || 0}</td>`;
    }).join("");
    return `<tr><td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">L${l}</td>${cells}</tr>`;
  }).join("");

  const matrixBlock =
    rowList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Residual risk matrix heatmap (L × S)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:12%">Likelihood</th>
        ${RISK_AXIS.map((s) => `<th style="padding:6px;border:1px solid #ccc;text-align:center;font-size:11px;background:#f5f5f5">S${s}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${matrixRows}</tbody>
  </table>`
      : "";

  const categoryTrendBlock =
    categoryTrend.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Category risk trend (before vs after)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Category</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:center;font-size:11px;background:#f5f5f5;width:11%">Rows</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:center;font-size:11px;background:#f5f5f5;width:18%">Initial avg RF</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:center;font-size:11px;background:#f5f5f5;width:18%">Residual avg RF</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:center;font-size:11px;background:#f5f5f5;width:14%">Reduction</th>
    </tr></thead>
    <tbody>
      ${categoryTrend
        .map(
          (c) => `<tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(c.category)}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;text-align:center">${c.count}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;text-align:center;color:#7f1d1d">${c.initialAvg}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;text-align:center;color:#166534">${c.residualAvg}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;text-align:center;color:#0C447C;font-weight:700">${c.reduction}%</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>`
      : "";

  const qaChecklistBlock =
    rowList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">QA readiness checklist</h2>
  <p style="font-size:11px;color:#334155;margin:0 0 8px">${qaPass}/${qaChecks.length} checks passed (${qaPct}%).</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tbody>
      ${qaChecks
        .map(
          (c) => `<tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;width:8%;text-align:center;background:${c.ok ? "#EAF3DE" : "#FCEBEB"};color:${c.ok ? "#27500A" : "#791F1F"};font-weight:700">${c.ok ? "PASS" : "CHECK"}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(c.label)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>`
      : "";

  const briefingPointsBlock =
    briefingPoints.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Daily briefing points (toolbox talk)</h2>
  <ol style="margin:0 0 12px;padding-left:18px;font-size:11px;line-height:1.5">
    ${briefingPoints.map((p) => `<li><strong>RF ${p.rf}</strong> — ${escHtml(p.text)}</li>`).join("")}
  </ol>`
      : "";

  const quickActionsBlock =
    ((form.hospitalDirectionsUrl || "").trim() || (form.siteMapUrl || "").trim() || (form.location || "").trim())
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Quick actions (site use)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tbody>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Emergency route</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${(form.hospitalDirectionsUrl || "").trim() ? `<a href="${escHtml(form.hospitalDirectionsUrl)}">${escHtml(form.hospitalDirectionsUrl)}</a>` : "—"}</td>
      </tr>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Stop-work authority</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(form.leadEngineer || "Set lead engineer")}</td>
      </tr>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Permit interface</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(projName || "Assign project")}</td>
      </tr>
    </tbody>
  </table>`
      : "";

  const ppeRegsBlock =
    ppeRollup.length > 0 || regsRollup.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">PPE and legal references pack</h2>
  ${ppeRollup.length > 0 ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px"><strong>PPE roll-up</strong> (${ppeRollup.length})</p><p style="font-size:11px;line-height:1.5;margin:0 0 8px">${ppeRollup.map((p) => `• ${escHtml(p)}`).join("<br/>")}</p>` : ""}
  ${regsRollup.length > 0 ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px"><strong>Regulatory references</strong> (${regsRollup.length})</p><p style="font-size:11px;line-height:1.5;margin:0 0 12px">${regsRollup.map((r) => `• ${escHtml(r)}`).join("<br/>")}</p>` : ""}`
      : "";

  const competencyAlertsBlock =
    competencyAlerts.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Competency expiry alerts</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Operative</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Certification</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Expiry</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Status</th>
    </tr></thead>
    <tbody>
      ${competencyAlerts
        .slice(0, 12)
        .map(
          (a) => `<tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(a.worker)}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(a.cert)}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(fmtDate(a.expiryDate))}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:${a.state === "expired" ? "#7F1D1D" : "#92400e"}">${a.state === "expired" ? "Expired" : `Due in ${a.days} day(s)`}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>`
      : "";

  const handoverAppendixBlock = `<h2 style="font-size:13px;margin:18px 0 8px">Client handover appendix</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
    <tbody>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Client</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(form.handoverClientName || "—")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Receiver</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(form.handoverReceiver || "—")}</td>
      </tr>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Handover date</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(fmtDate(form.handoverDate))}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Status</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(String(form.documentStatus || form.status || "draft").replace(/_/g, " "))}</td>
      </tr>
    </tbody>
  </table>
  ${(form.handoverNotes || "").trim() ? `<p style="font-size:11px;line-height:1.5;white-space:pre-wrap;margin:0 0 8px"><strong>Notes:</strong> ${escHtml(form.handoverNotes)}</p>` : ""}
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tbody>
      ${handoverChecks
        .map(
          (c) => `<tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;width:12%;text-align:center;background:${c.ok ? "#EAF3DE" : "#FCEBEB"};color:${c.ok ? "#27500A" : "#791F1F"};font-weight:700">${c.ok ? "PASS" : "CHECK"}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(c.label)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Prepared by</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Received by (client)</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Date</th>
    </tr></thead>
    <tbody>
      <tr style="height:42px">
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(form.leadEngineer || "—")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(form.handoverReceiver || "—")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(fmtDate(form.handoverDate))}</td>
      </tr>
    </tbody>
  </table>`;

  const sigTable =
    pf[RAMS_SECTION_IDS.SIGNATURES] && opList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">8. Sign-off list</h2>
  <p style="font-size:10px;color:#666;margin:0 0 8px">Operative signatures</p>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Name</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Signature</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Date</th>
    </tr></thead>
    <tbody>${sigRows}</tbody>
  </table>`
      : "";

  const methodStatementBlock =
    rowList.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">7. Method statement (risk reduction steps)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:7%">Step</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:28%">Activity</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Control method to reduce risk</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:15%">Residual RF</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5;width:12%">Reduction</th>
    </tr></thead>
    <tbody>
      ${rowList
        .map((r, idx) => {
          const revised = riskScore(r.revisedRisk);
          return `<tr>
            <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;text-align:center">${idx + 1}</td>
            <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;font-weight:600">${escHtml(r.activity || "—")}</td>
            <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px">${(r.controlMeasures || []).map((cm) => `• ${escHtml(cm)}`).join("<br/>") || "—"}</td>
            <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;background:${RL[getRiskLevel(r.revisedRisk)]?.bg};color:${RL[getRiskLevel(r.revisedRisk)]?.color};font-weight:700;text-align:center">${revised}</td>
            <td style="padding:8px;border:1px solid #e5e5e5;font-size:11px;text-align:center">${Math.max(0, Math.round(((Math.max(1, riskScore(r.initialRisk)) - revised) / Math.max(1, riskScore(r.initialRisk))) * 100))}%</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>`
      : "";

  const detailedControlPackBlock =
    detailedControlPack.length > 0
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Detailed control method pack (task by task)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
    <tbody>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:10px;color:#64748b;width:20%">Control assurance board</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:10px">
          Steps: <strong>${controlAssurance.steps}</strong> · Permits: <strong>${controlAssurance.uniquePermits}</strong> · Hold points: <strong>${controlAssurance.totalHoldPoints}</strong> · Stop-work rules: <strong>${controlAssurance.totalStopWork}</strong> · High residual steps: <strong>${controlAssurance.highResidualSteps}</strong> · Avg reduction: <strong>${controlAssurance.avgReduction}%</strong>
          ${
            controlAssurance.criticalSteps.length
              ? `<br/><span style="color:#7F1D1D">Critical focus steps: ${controlAssurance.criticalSteps.map((x) => `#${x.stepNo} ${escHtml(x.title)} (RF ${x.residual})`).join(" · ")}</span>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Execution timeline</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:10px">
          <strong>Pre-start</strong><br/>${controlAssurance.timeline.preStart.map((x) => `• ${escHtml(x)}`).join("<br/>") || "—"}
          <br/><strong>During task</strong><br/>${controlAssurance.timeline.during.map((x) => `• ${escHtml(x)}`).join("<br/>") || "—"}
          <br/><strong>Close-out</strong><br/>${controlAssurance.timeline.closeOut.map((x) => `• ${escHtml(x)}`).join("<br/>") || "—"}
        </td>
      </tr>
    </tbody>
  </table>
  ${detailedControlPack
    .map(
      (d) => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#fff">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      <strong style="font-size:11px">Step ${d.stepNo}: ${escHtml(d.title)}</strong>
      <span style="font-size:10px;color:#0C447C">RF ${d.initial} -> ${d.residual} (${d.reductionPct}% reduction)</span>
    </div>
    <p style="font-size:11px;color:#334155;margin:0 0 6px"><strong>Hazard:</strong> ${escHtml(d.hazard)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
      <tbody>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b;width:28%">Hierarchy of controls</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">
          Eliminate: ${escHtml(d.controlTree.eliminate[0] || "Review alternative sequence to avoid exposure.")}<br/>
          Substitute: ${escHtml(d.controlTree.substitute[0] || "Use safer equipment/method where possible.")}<br/>
          Engineering: ${escHtml(d.controlTree.engineering[0] || "Set barriers/physical separation and safe access.")}<br/>
          Admin: ${escHtml(d.controlTree.admin[0] || "Brief RAMS task steps and supervision points.")}<br/>
          PPE: ${escHtml(d.controlTree.ppe[0] || d.ppe.join(", ") || "Task-specific PPE as listed in RAMS.")}
        </td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Permit dependencies</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">${d.permitDeps.map((x) => `• ${escHtml(x)}`).join("<br/>")}</td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Verification checks</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">${d.verifyChecks.map((x) => `• ${escHtml(x)}`).join("<br/>")}</td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Stop-work triggers</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#7F1D1D">${d.stopWork.map((x) => `• ${escHtml(x)}`).join("<br/>")}</td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Emergency response</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">${d.emergency.map((x) => `• ${escHtml(x)}`).join("<br/>")}</td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Environmental controls</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">${d.environmental.map((x) => `• ${escHtml(x)}`).join("<br/>")}</td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Role assignments</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">
          <strong>Supervisor:</strong><br/>${d.roleAssignments.supervisor.map((x) => `• ${escHtml(x)}`).join("<br/>")}<br/>
          <strong>Operative:</strong><br/>${d.roleAssignments.operative.map((x) => `• ${escHtml(x)}`).join("<br/>")}
          ${d.roleAssignments.banksman.length ? `<br/><strong>Banksman / Marshal:</strong><br/>${d.roleAssignments.banksman.map((x) => `• ${escHtml(x)}`).join("<br/>")}` : ""}
        </td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Phase checkpoints</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">
          <strong>Pre-start:</strong><br/>${d.phaseControls.preStart.map((x) => `• ${escHtml(x)}`).join("<br/>")}<br/>
          <strong>During task:</strong><br/>${d.phaseControls.during.map((x) => `• ${escHtml(x)}`).join("<br/>")}<br/>
          <strong>Close-out:</strong><br/>${d.phaseControls.closeOut.map((x) => `• ${escHtml(x)}`).join("<br/>")}
        </td></tr>
        <tr><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px;color:#64748b">Hold points</td><td style="padding:4px;border:1px solid #e5e5e5;font-size:10px">${d.holdPoints.map((x) => `☐ ${escHtml(x)}`).join("<br/>")}</td></tr>
      </tbody>
    </table>
  </div>`
    )
    .join("")}`
      : "";

  const approvalBlock = `<h2 style="font-size:13px;margin:18px 0 8px">9. Approval and revision history</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tbody>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Revision</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${escHtml(form.revision || "1A")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b;width:20%">Review due</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${escHtml(fmtDate(form.reviewDate))}</td>
      </tr>
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Approved by</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${escHtml(form.approvedBy || "—")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px;color:#64748b">Approval date</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:12px">${escHtml(fmtDate(form.approvalDate))}</td>
      </tr>
    </tbody>
  </table>
  ${(form.revisionSummary || "").trim()
    ? `<p style="font-size:11px;color:#475569;margin:0 0 12px"><strong>Change summary:</strong> ${escHtml(form.revisionSummary)}</p>`
    : ""}`;
  const signatureEvidenceRows = (Array.isArray(form.signatureEvents) ? form.signatureEvents : [])
    .filter((x) => x && x.action)
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 12)
    .map(
      (s) => `<tr>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(String(s.action || "").replace(/_/g, " "))}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(s.actor || "Unknown")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(s.role || "—")}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(fmtDateTime(s.at))}</td>
        <td style="padding:6px;border:1px solid #e5e5e5;font-size:11px">${escHtml(s.revision || "—")}</td>
      </tr>`
    )
    .join("");
  const signatureEvidenceBlock =
    signatureEvidenceRows
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Signature evidence trail</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <thead><tr>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Action</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Actor</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Role</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Timestamp</th>
      <th style="padding:6px;border:1px solid #ccc;text-align:left;font-size:11px;background:#f5f5f5">Revision</th>
    </tr></thead>
    <tbody>${signatureEvidenceRows}</tbody>
  </table>`
      : "";

  const surveyingMethodBlock =
    (form.surveyMethodStatement || "").trim()
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Surveying method statement addendum</h2>
  ${(form.surveyWorkType || "").trim()
    ? `<p style="font-size:10px;color:#0C447C;margin:0 0 8px">Work type: ${escHtml(form.surveyWorkTypeLabel || form.surveyWorkType)}</p>`
    : ""}
  <p style="font-size:12px;line-height:1.55;white-space:pre-wrap;margin:0 0 12px">${escHtml(form.surveyMethodStatement)}</p>`
      : "";

  const deliveryControlsBlock =
    ((form.surveyDeliverables || "").trim() || (form.surveyAssumptions || "").trim() || (form.communicationPlan || "").trim())
      ? `<h2 style="font-size:13px;margin:18px 0 8px">Survey delivery controls</h2>
  ${(form.surveyDeliverables || "").trim() ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px"><strong>Deliverables / outputs</strong></p><p style="font-size:12px;line-height:1.5;white-space:pre-wrap;margin:0 0 8px">${escHtml(form.surveyDeliverables)}</p>` : ""}
  ${(form.surveyAssumptions || "").trim() ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px"><strong>Key assumptions</strong></p><p style="font-size:12px;line-height:1.5;white-space:pre-wrap;margin:0 0 8px">${escHtml(form.surveyAssumptions)}</p>` : ""}
  ${(form.communicationPlan || "").trim() ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px"><strong>Communication & permit controls</strong></p><p style="font-size:12px;line-height:1.5;white-space:pre-wrap;margin:0 0 12px">${escHtml(form.communicationPlan)}</p>` : ""}`
      : "";

  const docStatus = String(form.documentStatus || form.status || "draft");
  const statusLabel = docStatus.replace(/_/g, " ").toUpperCase();
  const watermark =
    docStatus === "issued"
      ? "ISSUED"
      : docStatus === "approved"
      ? "APPROVED"
      : docStatus === "internal_review"
      ? "IN REVIEW"
      : "DRAFT";

  const integrityBlock =
    pf[RAMS_SECTION_IDS.INTEGRITY] && contentFingerprint
      ? `<p style="font-size:10px;color:#555;margin-top:16px;font-family:Consolas,monospace">Document fingerprint: ${escHtml(contentFingerprint)}</p>`
      : "";
  const liveShareUrl = buildRamsShareUrl(form);
  const emergencyQuickUrl = String(form.hospitalDirectionsUrl || form.siteMapUrl || "").trim();
  const primaryQrText =
    liveShareUrl ||
    `RAMS ${form.documentNo || "NO-DOC"} | ${form.title || "Untitled"} | Rev ${form.revision || "1A"} | ${statusLabel}`;
  const emergencyQrText =
    emergencyQuickUrl ||
    `Emergency quick card | ${form.location || "Site"} | Hospital ${form.nearestHospital || "See section 4"}`;
  const primaryQrSrc = buildQrSrc(primaryQrText, 132);
  const emergencyQrSrc = buildQrSrc(emergencyQrText, 132);

  const coverPage = `<div class="cover-page">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <div style="font-size:10px;letter-spacing:0.07em;text-transform:uppercase;color:#475569;font-weight:700;margin-bottom:6px">MySafeOps</div>
        <div style="font-size:24px;line-height:1.15;font-weight:800;color:#0f172a;margin-bottom:4px">${escHtml(form.title || "Risk Assessment & Method Statement")}</div>
        <div style="font-size:12px;color:#334155;max-width:520px">${escHtml(form.scope || "Detailed RAMS pack generated for field execution and compliance review.")}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <div style="padding:6px 10px;border-radius:999px;background:#E6F1FB;color:#0C447C;font-size:11px;font-weight:700">${escHtml(statusLabel)}</div>
        ${form.strictMode ? `<div style="padding:6px 10px;border-radius:999px;background:#ede9fe;color:#4c1d95;font-size:11px;font-weight:700">STRICT MODE</div>` : ""}
        <div style="display:flex;gap:8px">
          <div style="border:1px solid #dbe2ea;border-radius:8px;padding:6px;background:#fff;text-align:center">
            <img src="${escHtml(primaryQrSrc)}" alt="Live RAMS QR" width="78" height="78" style="display:block"/>
            <div style="font-size:9px;color:#64748b;margin-top:3px">Live copy</div>
          </div>
          <div style="border:1px solid #dbe2ea;border-radius:8px;padding:6px;background:#fff;text-align:center">
            <img src="${escHtml(emergencyQrSrc)}" alt="Emergency QR" width="78" height="78" style="display:block"/>
            <div style="font-size:9px;color:#64748b;margin-top:3px">Emergency</div>
          </div>
        </div>
      </div>
    </div>
    <div class="cover-meta">
      <div class="cover-kpi"><strong>Document no.</strong><br/>${escHtml(form.documentNo || "—")}</div>
      <div class="cover-kpi"><strong>Issue date</strong><br/>${escHtml(fmtDate(form.issueDate))}</div>
      <div class="cover-kpi"><strong>Location</strong><br/>${escHtml(form.location || "—")}</div>
      <div class="cover-kpi"><strong>Project</strong><br/>${escHtml(projName || "—")}</div>
      <div class="cover-kpi"><strong>Lead engineer</strong><br/>${escHtml(form.leadEngineer || "—")}</div>
      <div class="cover-kpi"><strong>Revision</strong><br/>${escHtml(form.revision || "1A")}</div>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <span style="font-size:11px;background:#FCEBEB;color:#791F1F;padding:2px 8px;border-radius:999px">High residual ${residualHighCount}</span>
      <span style="font-size:11px;background:#FAEEDA;color:#633806;padding:2px 8px;border-radius:999px">Medium ${residualMediumCount}</span>
      <span style="font-size:11px;background:#EAF3DE;color:#27500A;padding:2px 8px;border-radius:999px">Low ${residualLowCount}</span>
      <span style="font-size:11px;background:#E6F1FB;color:#0C447C;padding:2px 8px;border-radius:999px">QA ${qaPass}/${qaChecks.length} · ${qaPct}%</span>
      <span style="font-size:11px;background:#ecfeff;color:#0f766e;padding:2px 8px;border-radius:999px">Readiness ${readinessScore}/100</span>
    </div>
    <div style="margin-top:16px;font-size:11px;color:#64748b">Prepared by MySafeOps • Operational RAMS dossier • A4 issue pack</div>
    ${liveShareUrl ? `<div style="margin-top:6px;font-size:10px;color:#0C447C;word-break:break-all">Live URL: ${escHtml(liveShareUrl)}</div>` : ""}
  </div>`;

  return `
  ${coverPage}
  <div class="rams-watermark">${escHtml(watermark)}</div>
  <div class="rams-content">
  <table class="header-table"><tr>
    <td><span class="lbl">Location:</span> ${escHtml(form.location)}</td>
    <td><span class="lbl">Project:</span> ${escHtml(projName || "—")}</td>
    <td><span class="lbl">Job reference:</span> ${escHtml(form.jobRef || "—")}</td>
  </tr><tr>
    <td><span class="lbl">Date:</span> ${escHtml(fmtDate(form.date))}</td>
    <td><span class="lbl">Lead engineer:</span> ${escHtml(form.leadEngineer || "—")}</td>
    <td><span class="lbl">Doc no:</span> ${escHtml(form.documentNo || "—")}</td>
  </tr><tr>
    <td><span class="lbl">Issue date:</span> ${escHtml(fmtDate(form.issueDate) || "—")}</td>
    <td colspan="2"><span class="lbl">Status:</span> ${escHtml(statusLabel)}</td>
  </tr></table>
  <h1>1. ${escHtml(form.title)}</h1>
  ${form.scope ? `<p style="font-size:12px;margin-bottom:16px">${escHtml(form.scope)}</p>` : ""}
  ${surveyingMethodBlock}
  ${deliveryControlsBlock}
  ${readinessBlock}
  ${qaChecklistBlock}
  ${briefingPointsBlock}
  ${quickActionsBlock}
  ${ppeRegsBlock}
  ${competencyAlertsBlock}
  ${weatherBlock}
  ${mapBlock}
  ${hospitalBlock}
  ${operativeCertsBlock}
  ${methodStatementBlock}
  ${detailedControlPackBlock}
  ${categoryTrendBlock}
  ${matrixBlock}
  ${riskTable}
  ${sigTable}
  ${handoverAppendixBlock}
  ${approvalBlock}
  ${signatureEvidenceBlock}
  <h2 style="font-size:13px;margin:18px 0 8px">10. Document integrity</h2>
  <p style="font-size:10px;color:#888;margin-top:20px">Generated by MySafeOps · REVISION ${escHtml(form.revision || "1A")} · Review due: ${escHtml(fmtDate(form.reviewDate) || "—")} · Layout: A4</p>
  ${integrityBlock}
  </div>
  `;
}

export function generatePrintHTML(form, rows, operatives, projectMap, printFlags, contentFingerprint, workersAll) {
  const inner = buildRamsPrintBodyHTML(form, rows, operatives, projectMap, printFlags, contentFingerprint, workersAll);
  const footer = `${form.documentNo || "RAMS"} · ${String(form.documentStatus || form.status || "draft").replace(/_/g, " ")} · ${fmtDate(form.issueDate)} · Scan cover QR for live copy`;
  return wrapRamsPrintDocument(form.title || "RAMS", inner, "", footer);
}

/** Single HTML document: RAMS plus permit pages (same project). Uses permit module styling. */
export function generateRamsProjectPackHTML(form, rows, workers, projects, permits) {
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const operatives = (form.operativeIds || []).map((id) => workerMap[id]).filter(Boolean);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const pf = normalizePrintSections(form.printSections);
  const fp = computeRamsFingerprint(form, rows);
  const ramsInner = buildRamsPrintBodyHTML(form, rows || [], operatives, projectMap, pf, fp, workers);
  let permitExtraCss = "";
  const permitBlocks = [];
  for (const p of permits) {
    const full = renderPermitDocumentHtml(p);
    const { style, body } = splitPermitDocumentHtml(full);
    if (!permitExtraCss && style) permitExtraCss = `\n${style}\n`;
    if (body) permitBlocks.push(`<div class="pack-permit-wrap">${body}</div>`);
  }
  const combinedBody = `<div class="pack-rams">${ramsInner}</div>${permitBlocks.join("")}`;
  const pageTitle = `${form.title || "RAMS"} · RAMS + permits (A4)`;
  const footer = `${form.documentNo || "RAMS"} · ${String(form.documentStatus || form.status || "draft").replace(/_/g, " ")} · ${fmtDate(form.issueDate)} · Scan cover QR for live copy`;
  return wrapRamsPrintDocument(pageTitle, combinedBody, permitExtraCss, footer);
}

/**
 * Open RAMS (or RAMS+permits pack) in a new window.
 * @param options.print If true, open the system print dialog (save as PDF from there).
 * @param options.permits Optional permits list (e.g. same projectId as RAMS) to append after RAMS.
 */
export function openRamsDocumentWindow(form, rows, workers, projects, options = {}) {
  const doPrint = options.print === true;
  const permits = options.permits;
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const operatives = (form.operativeIds || []).map((id) => workerMap[id]).filter(Boolean);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const pf = normalizePrintSections(form.printSections);
  const fp = computeRamsFingerprint(form, rows);
  const html =
    Array.isArray(permits) && permits.length > 0
      ? generateRamsProjectPackHTML(form, rows, workers, projects, permits)
      : generatePrintHTML(form, rows || [], operatives, projectMap, pf, fp, workers);
  const win = window.open("", "_blank");
  if (!win) {
    window.alert(
      "Could not open a new window — your browser may be blocking pop-ups. Allow pop-ups for this site, then use Preview or Print again."
    );
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (doPrint) {
    const triggerPrint = () => {
      win.focus();
      setTimeout(() => win.print(), 180);
    };
    if (win.document.readyState === "complete") {
      triggerPrint();
    } else {
      win.onload = triggerPrint;
    }
  }
}

/** Open print dialog for a saved RAMS document (same output as builder preview print). */
export function openRamsPrintWindow(form, rows, workers, projects) {
  openRamsDocumentWindow(form, rows, workers, projects, { print: true });
}
