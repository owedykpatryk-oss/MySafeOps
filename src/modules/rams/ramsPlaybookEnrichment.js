/**
 * Enrich a RAMS draft from survey pack + optional site-context overlay (playbook one-click).
 */
import {
  getSiteContextOverlay,
  appendSiteContextScope,
  formatSiteContextBriefing,
  findHazardsForSiteContext,
  mergeUniqueStrings,
} from "./ramsSiteContextOverlays.js";

/**
 * Match hazard library rows by token substring (same idea as RAMSTemplateBuilder).
 * @param {{ hazardTokens?: string[] } | null | undefined} pack
 * @param {object[]} hazardLibrary
 * @param {number} [limit]
 */
export function findHazardsForSurveyPackTokens(pack, hazardLibrary, limit = 12) {
  if (!pack || !Array.isArray(hazardLibrary)) return [];
  const toks = (pack.hazardTokens || []).map((t) => String(t).toLowerCase()).filter(Boolean);
  if (!toks.length) return [];
  const matched = hazardLibrary.filter((h) => {
    const hay = `${h.id} ${h.category} ${h.activity} ${h.hazard}`.toLowerCase();
    return toks.some((t) => hay.includes(t));
  });
  return matched.slice(0, limit);
}

/**
 * @param {object} h
 * @param {() => string} genId
 */
function hazardToRamsRow(h, genId) {
  return {
    id: genId("row"),
    sourceId: h.id,
    category: h.category || "General",
    activity: h.activity || "",
    hazard: h.hazard || "",
    initialRisk: h.initialRisk || { L: 3, S: 3, RF: 9 },
    revisedRisk: h.revisedRisk || { L: 2, S: 3, RF: 6 },
    controlMeasures: h.controlMeasures || [],
    ppeRequired: h.ppeRequired || [],
    regs: h.regs || [],
    rowSource: "survey_pack",
  };
}

/**
 * Apply surveying pack + site context overlay onto a RAMS draft (mutates via return).
 * @param {object} draft
 * @param {{ ramsSurveyKey?: string, surveyType?: string, siteContextKey?: string }} playbook
 * @param {{ label?: string, scope?: string, method?: string, hazardTokens?: string[], packMeta?: object } | null} pack
 * @param {object[]} [hazardLibrary]
 * @param {() => string} genId
 */
export function enrichRamsDraftFromPlaybookPack(draft, playbook, pack, hazardLibrary = [], genId) {
  if (!draft || typeof draft !== "object") return draft;
  const packKey = String(playbook?.ramsSurveyKey || playbook?.surveyType || draft.surveyWorkType || "").trim();
  const overlay = getSiteContextOverlay(playbook?.siteContextKey || draft.siteContextKey);

  let next = {
    ...draft,
    surveyWorkType: packKey || draft.surveyWorkType || "",
    surveyWorkTypeLabel: pack?.label || draft.surveyWorkTypeLabel || "",
    surveyDeliverables: draft.surveyDeliverables || pack?.scope || "",
    surveyMethodStatement: draft.surveyMethodStatement || pack?.method || "",
  };

  const meta = pack?.packMeta || {};
  if (!(next.surveyRequiredPermits || []).length && meta.permitDependencies?.length) {
    next.surveyRequiredPermits = [...meta.permitDependencies];
  }
  if (!(next.surveyRequiredCerts || []).length && meta.requiredCerts?.length) {
    next.surveyRequiredCerts = [...meta.requiredCerts];
  }
  if (!(next.surveyEvidenceSet || []).length && meta.mandatoryEvidence?.length) {
    next.surveyEvidenceSet = [...meta.mandatoryEvidence];
  }
  if (!(next.surveyHoldPoints || []).length && meta.holdPoints?.length) {
    next.surveyHoldPoints = [...meta.holdPoints];
  }

  if (overlay) {
    const briefing = formatSiteContextBriefing(overlay);
    const photoBlock = [
      `Site context photo checklist (${overlay.shortLabel}):`,
      ...overlay.photoChecklist.map((p) => `- ${p}`),
    ].join("\n");
    next.siteContextKey = overlay.key;
    next.siteContextLabel = overlay.label;
    next.scope = appendSiteContextScope(next.scope || pack?.scope || "", overlay);
    const plan = String(next.communicationPlan || "").trim();
    next.communicationPlan = plan.includes(`Site context briefing (${overlay.shortLabel})`)
      ? plan
      : plan
        ? `${plan}\n\n${briefing}`
        : briefing;
    const notes = String(next.handoverNotes || "").trim();
    next.handoverNotes = notes.includes(`Site context photo checklist (${overlay.shortLabel})`)
      ? notes
      : notes
        ? `${notes}\n\n${photoBlock}`
        : photoBlock;
    next.surveyRequiredPermits = mergeUniqueStrings(next.surveyRequiredPermits, overlay.permitHints);
    next.surveyRequiredCerts = mergeUniqueStrings(next.surveyRequiredCerts, overlay.requiredCerts);
    next.surveyHoldPoints = mergeUniqueStrings(next.surveyHoldPoints, overlay.holdPoints);
    next.surveyEvidenceSet = mergeUniqueStrings(next.surveyEvidenceSet, overlay.photoChecklist);
  }

  if ((!next.rows || next.rows.length === 0) && Array.isArray(hazardLibrary) && hazardLibrary.length && typeof genId === "function") {
    const fromPack = findHazardsForSurveyPackTokens(pack, hazardLibrary, 10);
    const fromSite = overlay ? findHazardsForSiteContext(overlay, hazardLibrary, 8) : [];
    const seen = new Set();
    const merged = [];
    for (const h of [...fromSite, ...fromPack]) {
      if (!h?.id || seen.has(h.id)) continue;
      seen.add(h.id);
      merged.push(h);
      if (merged.length >= 14) break;
    }
    if (merged.length) next.rows = merged.map((h) => hazardToRamsRow(h, genId));
  }

  return next;
}

/** Short label for PDF / UI badges. */
export function siteContextBadgeLabel(formOrDoc) {
  const key = String(formOrDoc?.siteContextKey || "").trim();
  if (!key) return "";
  const overlay = getSiteContextOverlay(key);
  return (
    String(formOrDoc?.siteContextLabel || "").trim() ||
    overlay?.shortLabel ||
    overlay?.label ||
    key
  );
}
