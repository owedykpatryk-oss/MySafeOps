/**
 * Evidence-only GPR relevance classifier.
 *
 * Security properties:
 * - OPENAI_API_KEY is read server-side only.
 * - every POST requires a valid Supabase access token and same-site browser origin;
 * - model, prompt, schema and token ceiling are server controlled;
 * - a durable Supabase RPC enforces 2/min, 10/day and 100/30 days per user;
 * - the model can return only controlled enums tied to supplied evidence IDs.
 */

import crypto from "node:crypto";
import {
  API_JSON_HEADERS,
  checkRateLimit,
  getClientIp,
  isSameSiteApiRequest,
  readJsonBody,
  sendJson,
} from "./securityUtils.js";
import { parseBearerToken, verifySupabaseAccessToken } from "./verifySupabaseAuth.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL_ALLOWLIST = new Set(["gpt-6-luna", "gpt-6-sol"]);
const DEFAULT_MODEL = "gpt-6-luna";
const MAX_JSON_BYTES = 48_000;
const MAX_EVIDENCE = 12;
const MAX_OUTPUT_TOKENS = 1200;

const RELEVANCE = ["high", "moderate", "low", "not_relevant"];
const MECHANISMS = [
  "former_foundations",
  "buried_demolition_material",
  "disturbed_or_made_ground",
  "possible_void_or_cellar",
  "historic_services_or_drainage",
  "grave_or_burial_features",
  "geological_attenuation",
  "geological_clutter",
  "none",
];
const ACTIONS = [
  "correlate_with_radargrams",
  "target_orthogonal_lines",
  "increase_line_density",
  "compare_with_current_plan",
  "seek_additional_archive_source",
  "confirm_by_intrusive_method",
  "record_as_context_only",
  "none",
];
const CAVEATS = [
  "source_is_not_site_investigation",
  "historic_feature_extent_uncertain",
  "map_registration_may_be_approximate",
  "image_date_or_coverage_limited",
  "correlation_not_causation",
  "none",
];

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assessments: {
      type: "array",
      maxItems: MAX_EVIDENCE,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          evidenceId: { type: "string" },
          relevance: { type: "string", enum: RELEVANCE },
          mechanisms: { type: "array", items: { type: "string", enum: MECHANISMS }, maxItems: 4 },
          recommendedActions: { type: "array", items: { type: "string", enum: ACTIONS }, maxItems: 4 },
          caveat: { type: "string", enum: CAVEATS },
        },
        required: ["evidenceId", "relevance", "mechanisms", "recommendedActions", "caveat"],
      },
    },
  },
  required: ["assessments"],
};

function cleanText(value, max) {
  return String(value || "").replace(/[\0\r]/g, "").trim().slice(0, max);
}

export function sanitizeEvidenceRequest(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.evidence)) return null;
  const seen = new Set();
  const evidence = [];
  for (const raw of body.evidence.slice(0, MAX_EVIDENCE)) {
    const id = cleanText(raw?.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
    const observedFact = cleanText(raw?.observedFact, 1200);
    const sourceUrl = cleanText(raw?.sourceUrl, 800);
    if (!id || seen.has(id) || !observedFact || raw?.verified !== true) continue;
    if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) continue;
    seen.add(id);
    evidence.push({
      id,
      kind: cleanText(raw?.kind, 40),
      title: cleanText(raw?.title, 240),
      sourceName: cleanText(raw?.sourceName, 180),
      sourceUrl,
      sourceDate: cleanText(raw?.sourceDate, 80),
      observedFact,
    });
  }
  if (!evidence.length) return null;
  return {
    reportRef: cleanText(body.reportRef, 100),
    siteAddress: cleanText(body.siteAddress, 300),
    evidence,
  };
}

function resolveSupabase() {
  return {
    url: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, ""),
    anon: String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim(),
  };
}

async function claimDurableBudget(token) {
  const { url, anon } = resolveSupabase();
  if (!url || !anon) return { ok: false, error: "ai_budget_not_configured" };
  try {
    const response = await fetch(`${url}/rest/v1/rpc/claim_gpr_ai_usage_budget`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) return { ok: false, error: "ai_budget_unavailable" };
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row?.allowed === true
      ? { ok: true }
      : { ok: false, error: "ai_quota_exceeded", limits: row || null };
  } catch {
    return { ok: false, error: "ai_budget_unavailable" };
  }
}

function extractOutputText(payload) {
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

export function validateAssessmentOutput(value, evidenceIds) {
  if (!value || !Array.isArray(value.assessments)) return null;
  const expected = new Set(evidenceIds);
  const seen = new Set();
  const assessments = [];
  for (const item of value.assessments) {
    const evidenceId = cleanText(item?.evidenceId, 80);
    if (!expected.has(evidenceId) || seen.has(evidenceId)) return null;
    if (!RELEVANCE.includes(item?.relevance) || !CAVEATS.includes(item?.caveat)) return null;
    if (!Array.isArray(item?.mechanisms) || item.mechanisms.some((x) => !MECHANISMS.includes(x))) return null;
    if (!Array.isArray(item?.recommendedActions) || item.recommendedActions.some((x) => !ACTIONS.includes(x))) return null;
    seen.add(evidenceId);
    assessments.push({
      evidenceId,
      relevance: item.relevance,
      mechanisms: [...new Set(item.mechanisms)].slice(0, 4),
      recommendedActions: [...new Set(item.recommendedActions)].slice(0, 4),
      caveat: item.caveat,
    });
  }
  if (seen.size !== expected.size) return null;
  return assessments;
}

function estimatedUsd(model, usage) {
  const rates = model === "gpt-6-sol" ? { input: 2, output: 10 } : { input: 0.1, output: 0.5 };
  const input = Number(usage?.input_tokens) || 0;
  const output = Number(usage?.output_tokens) || 0;
  return Number(((input * rates.input + output * rates.output) / 1_000_000).toFixed(6));
}

export default async function handler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    const configured = Boolean(String(process.env.OPENAI_API_KEY || "").trim());
    res.writeHead(configured ? 200 : 503, API_JSON_HEADERS);
    if (req.method === "HEAD") return res.end();
    return res.end(JSON.stringify({ ok: configured, configured, model: DEFAULT_MODEL }));
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...API_JSON_HEADERS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  if (!isSameSiteApiRequest(req)) return sendJson(res, 403, { error: "forbidden_origin" });

  const token = parseBearerToken(req);
  const user = token ? await verifySupabaseAccessToken(token) : null;
  if (!user) return sendJson(res, 401, { error: token ? "invalid_session" : "unauthorized" });

  const parsed = await readJsonBody(req, MAX_JSON_BYTES);
  if (parsed?.__body_too_large) return sendJson(res, 413, { error: "payload_too_large" });
  if (parsed === null) return sendJson(res, 400, { error: "invalid_json" });
  const input = sanitizeEvidenceRequest(parsed);
  if (!input) return sendJson(res, 400, { error: "verified_evidence_required" });

  const fastLimit = checkRateLimit(`gpr-ai:${user.id}:${getClientIp(req)}`, { max: 2, windowMs: 60_000 });
  if (!fastLimit.allowed) {
    res.setHeader("Retry-After", String(fastLimit.retryAfterSeconds));
    return sendJson(res, 429, { error: "ai_quota_exceeded" });
  }
  const budget = await claimDurableBudget(token);
  if (!budget.ok) return sendJson(res, budget.error === "ai_quota_exceeded" ? 429 : 503, budget);

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return sendJson(res, 503, { error: "openai_not_configured" });
  const configuredModel = String(process.env.OPENAI_GPR_MODEL || DEFAULT_MODEL).trim();
  const model = MODEL_ALLOWLIST.has(configuredModel) ? configuredModel : DEFAULT_MODEL;
  const requestId = crypto.randomUUID();

  const instructions = [
    "You classify supplied, human-verified evidence for Ground Penetrating Radar survey planning and interpretation.",
    "Never add or infer a site fact. Never identify a building, burial, utility, date, material or event that is not explicitly present in the supplied evidence.",
    "Return exactly one assessment for every evidence ID and no others.",
    "Mechanisms are possible GPR response mechanisms only, not claims that the mechanism exists at the site.",
    "Use grave_or_burial_features only when the evidence explicitly states cemetery, burial ground, grave or interment.",
    "Use correlation_not_causation whenever recommending correlation of historic evidence with a radar anomaly.",
  ].join(" ");

  let upstream;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Client-Request-Id": requestId,
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        instructions,
        input: JSON.stringify(input),
        text: {
          format: {
            type: "json_schema",
            name: "gpr_evidence_assessment",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });
  } catch {
    return sendJson(res, 502, { error: "openai_unreachable", requestId });
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    return sendJson(res, upstream.status === 429 ? 429 : 502, {
      error: upstream.status === 429 ? "openai_rate_limited" : "openai_error",
      requestId,
    });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return sendJson(res, 502, { error: "openai_invalid_response", requestId });
  }
  let structured;
  try {
    structured = JSON.parse(extractOutputText(payload));
  } catch {
    return sendJson(res, 502, { error: "openai_invalid_response", requestId });
  }
  const assessments = validateAssessmentOutput(structured, input.evidence.map((x) => x.id));
  if (!assessments) return sendJson(res, 502, { error: "openai_evidence_mismatch", requestId });

  return sendJson(res, 200, {
    assessments,
    model,
    reviewedAt: new Date().toISOString(),
    requestId,
    usage: payload.usage || null,
    estimatedCostUsd: estimatedUsd(model, payload.usage),
    policy: "verified-evidence-only",
  });
}
