import { supabase } from "../lib/supabase.js";
import { appApiUrl } from "./appApiUrl";

const ERROR_MESSAGES = {
  unauthorized: "Sign in before running the evidence review.",
  invalid_session: "Your session expired. Sign in again.",
  verified_evidence_required: "Add and verify at least one cited evidence item first.",
  ai_quota_exceeded: "AI review limit reached (2/min, 10/day, 100/30 days). Try again after the limit resets.",
  ai_budget_not_configured: "The server-side AI budget is not configured.",
  ai_budget_unavailable: "The durable AI budget check is unavailable; the request was blocked to protect cost.",
  openai_not_configured: "OPENAI_API_KEY is not configured on the server.",
  openai_rate_limited: "OpenAI is rate limited. Try again later.",
  openai_evidence_mismatch: "AI returned an evidence mismatch, so the result was rejected.",
  openai_invalid_response: "AI returned an invalid structured response, so nothing was added to the report.",
};

export async function reviewGprEvidence(payload) {
  if (!supabase) throw new Error("Cloud sign-in is required for evidence AI.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error(ERROR_MESSAGES.unauthorized);

  const response = await fetch(appApiUrl("/api/gpr-evidence-review"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(ERROR_MESSAGES[body?.error] || "Evidence review failed safely; no report content was changed.");
  return body;
}
