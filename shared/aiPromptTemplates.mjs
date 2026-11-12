/**
 * Server-pinned Anthropic system prompts. The browser may request a promptId;
 * it must not supply a freeform system string through the production proxy.
 */

/** @typedef {'rams_draft' | 'toolbox_talk' | 'survey_prose' | 'photo_hazard'} AiPromptId */

/** @type {ReadonlySet<string>} */
export const AI_PROMPT_IDS = Object.freeze(new Set(["rams_draft", "toolbox_talk", "survey_prose", "photo_hazard"]));

const MARKET_AI_CONTEXT = {
  uk: {
    jurisdiction: "the United Kingdom",
    language: "British English",
    document: "RAMS (Risk Assessment and Method Statement)",
    authority: "UK legislation and HSE guidance",
  },
  au: {
    jurisdiction: "Australia",
    language: "Australian English",
    document: "SWMS / RAMS",
    authority: "the applicable state or territory WHS legislation and regulator guidance",
  },
  pl: {
    jurisdiction: "Poland",
    language: "Polish",
    document: "IBWR (Instrukcja Bezpiecznego Wykonywania Robót)",
    authority: "Polish BHP and construction legislation, including the Labour Code and applicable regulations",
  },
  de: {
    jurisdiction: "Germany",
    language: "German",
    document: "Gefährdungsbeurteilung (GBU) with safe work sequence",
    authority: "ArbSchG, BaustellV, BetrSichV, GefStoffV and applicable DGUV rules",
  },
  at: {
    jurisdiction: "Austria",
    language: "Austrian German",
    document: "Evaluierung with safe work sequence",
    authority: "ASchG, BauKG and applicable Austrian regulations and AUVA guidance",
  },
  ch: {
    jurisdiction: "Switzerland",
    language: "Swiss Standard German",
    document: "Gefährdungsermittlung / SiKo work package",
    authority: "BauAV, VUV, ArG and applicable EKAS/Suva guidance",
  },
};

/**
 * @param {string} [marketId]
 * @returns {string}
 */
export function buildAiRamsSystemPrompt(marketId = "uk") {
  const market = MARKET_AI_CONTEXT[marketId] || MARKET_AI_CONTEXT.uk;
  return `You are a construction health and safety drafting assistant for ${market.jurisdiction} creating ${market.document}.
Respond with a single JSON object only, no markdown, with this shape:
{
  "title": "string",
  "location": "string",
  "leadEngineer": "string or empty",
  "jobRef": "string or empty",
  "hazards": [
    {
      "category": "string",
      "activity": "string",
      "hazard": "string",
      "initialRisk": { "L": 1-6, "S": 1-6, "RF": number },
      "controlMeasures": ["string", ...],
      "revisedRisk": { "L": 1-6, "S": 1-6, "RF": number },
      "ppeRequired": ["string", ...],
      "regs": ["string — ${market.authority} only; use accurate titles and omit uncertain citations"]
    }
  ],
  "methodSteps": ["high-level safe sequence step 1", "step 2", ...]
}
Use ${market.language}. Never cite UK HSE, CDM, COSHH, LOLER, PUWER or other foreign legislation unless the selected jurisdiction is the United Kingdom. Use integer L and S from 1 to 6 on the application's existing scale. Risk factor RF = L * S; bands are low below 12, medium from 12 to 23, high from 24. Do not lower severity merely because a control reduces likelihood. Describe why any reduction of severity is justified. Be specific to the activity described. Include 6–15 hazards for a typical site job. Treat the result as a draft requiring approval by a competent person.`;
}

const TOOLBOX_TALK_SYSTEM =
  "You write short UK site toolbox talks (5–7 bullet points, plain English, no jargon). Include one UK regulation reference where relevant. No JSON.";

const SURVEY_PROSE_SYSTEM = `You draft UK construction/surveying report prose for MySafeOps. Write in professional British English, PAS128-aware where relevant. No markdown headings. Return exactly four labelled paragraphs:
EXECUTIVE SUMMARY:
SCOPE NOTE:
FINDINGS DRAFT:
RECOMMENDATIONS:`;

const PHOTO_HAZARD_SYSTEM =
  "You are a UK construction safety observer. List visible hazards and practical controls (bullet list). Note limitations: photo may not show full context. British English.";

/**
 * @param {string | null | undefined} promptId
 * @param {string | null | undefined} [marketId]
 * @returns {string | null}
 */
export function resolveAiSystemPrompt(promptId, marketId = "uk") {
  const id = String(promptId || "").trim();
  if (!AI_PROMPT_IDS.has(id)) return null;
  if (id === "rams_draft") return buildAiRamsSystemPrompt(marketId);
  if (id === "toolbox_talk") return TOOLBOX_TALK_SYSTEM;
  if (id === "survey_prose") return SURVEY_PROSE_SYSTEM;
  if (id === "photo_hazard") return PHOTO_HAZARD_SYSTEM;
  return null;
}
