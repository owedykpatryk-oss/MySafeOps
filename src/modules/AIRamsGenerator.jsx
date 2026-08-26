import { useState } from "react";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { anthropicMessages, isAnthropicConfigured } from "../utils/anthropicClient";
import { pushAudit } from "../utils/auditLog";
import { getIndustryPackLabel } from "../utils/industryPackProfile";
import { getRamsStarterAiHint } from "../utils/ramsIndustryStarters";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { getOrgMarketId } from "../utils/orgMarket";
import { getRamsShortLabel } from "../utils/marketLabels";

const ss = { ...ms, ta: { ...ms.inp, minHeight: 120, resize: "vertical" } };

const MARKET_AI_CONTEXT = {
  uk: { jurisdiction: "the United Kingdom", language: "British English", document: "RAMS (Risk Assessment and Method Statement)", authority: "UK legislation and HSE guidance" },
  au: { jurisdiction: "Australia", language: "Australian English", document: "SWMS / RAMS", authority: "the applicable state or territory WHS legislation and regulator guidance" },
  pl: { jurisdiction: "Poland", language: "Polish", document: "IBWR (Instrukcja Bezpiecznego Wykonywania Robót)", authority: "Polish BHP and construction legislation, including the Labour Code and applicable regulations" },
  de: { jurisdiction: "Germany", language: "German", document: "Gefährdungsbeurteilung (GBU) with safe work sequence", authority: "ArbSchG, BaustellV, BetrSichV, GefStoffV and applicable DGUV rules" },
  at: { jurisdiction: "Austria", language: "Austrian German", document: "Evaluierung with safe work sequence", authority: "ASchG, BauKG and applicable Austrian regulations and AUVA guidance" },
  ch: { jurisdiction: "Switzerland", language: "Swiss Standard German", document: "Gefährdungsermittlung / SiKo work package", authority: "BauAV, VUV, ArG and applicable EKAS/Suva guidance" },
};

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
      "initialRisk": { "L": 1-5, "S": 1-5, "RF": number },
      "controlMeasures": ["string", ...],
      "revisedRisk": { "L": 1-5, "S": 1-5, "RF": number },
      "ppeRequired": ["string", ...],
      "regs": ["string — ${market.authority} only; use accurate titles and omit uncertain citations"]
    }
  ],
  "methodSteps": ["high-level safe sequence step 1", "step 2", ...]
}
Use ${market.language}. Never cite UK HSE, CDM, COSHH, LOLER, PUWER or other foreign legislation unless the selected jurisdiction is the United Kingdom. Risk factor RF = L * S. Be specific to the activity described. Include 6–15 hazards for a typical site job. Treat the result as a draft requiring approval by a competent person.`;
}

export default function AIRamsGenerator() {
  const marketId = getOrgMarketId();
  const documentLabel = getRamsShortLabel(marketId);
  const [activity, setActivity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");

  const run = async () => {
    if (!activity.trim()) return;
    setError("");
    setLoading(true);
    setRaw("");
    try {
      const text = await anthropicMessages({
        system: buildAiRamsSystemPrompt(marketId),
        messages: [
          {
            role: "user",
            content: `${getRamsStarterAiHint()}\nWorkspace profile: ${getIndustryPackLabel()}.\n\nActivity / scope:\n${activity.trim()}`,
          },
        ],
        maxTokens: 8192,
      });
      setRaw(text);
      pushAudit({ action: "ai_rams_generate", entity: "claude", detail: "ok" });
    } catch (e) {
      setError(e.message || "Request failed");
      pushAudit({ action: "ai_rams_generate", entity: "claude", detail: "error" });
    } finally {
      setLoading(false);
    }
  };

  const applyToBuilder = () => {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("no json");
      const json = JSON.parse(raw.slice(start, end + 1));
      sessionStorage.setItem("mysafeops_ai_rams_prefill", JSON.stringify(json));
      alert('Go to RAMS tab → "+ Build new RAMS" — AI draft will load into the builder.');
    } catch {
      setError("Could not parse JSON. Copy the response and fix manually.");
    }
  };

  const hasKey = isAnthropicConfigured();
  const showDevHints = showAdminLoginHints();

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="AI"
        title={`AI ${documentLabel} generator`}
        lead={
          showDevHints ? (
            <>
              Uses Anthropic Claude. Local dev: <code style={{ fontSize: 12 }}>VITE_ANTHROPIC_API_KEY</code> in <code style={{ fontSize: 12 }}>.env</code>. Production:{" "}
              <code style={{ fontSize: 12 }}>VITE_ANTHROPIC_PROXY_URL=/api/anthropic-messages</code> plus server{" "}
              <code style={{ fontSize: 12 }}>ANTHROPIC_API_KEY</code> on Vercel.
            </>
          ) : (
            "Draft RAMS content from a plain-language description of the work. Your organisation admin enables the AI service."
          )
        }
      />
      {!hasKey && (
        <div style={{ ...ss.card, background: "#FAEEDA", color: "#633806", marginBottom: 16 }}>
          {showDevHints ? "No API key configured." : "AI RAMS is not enabled for this site yet. Contact your administrator."}
        </div>
      )}
      <div style={ss.card}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Describe the work</label>
        <textarea style={ss.ta} value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g. Install stainless pipework in food factory live area, hot works on mezzanine, MEWP for high-level fixings…" />
        <button type="button" style={{ ...ss.btnP, marginTop: 10 }} disabled={loading || !hasKey} onClick={run}>
          {loading ? "Generating…" : "Generate RAMS JSON"}
        </button>
      </div>
      {error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}
      {raw && (
        <div style={{ ...ss.card, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Response</div>
          <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 320, background: "#f8fafc", padding: 10, borderRadius: 6 }}>{raw}</pre>
          <button type="button" style={{ ...ss.btnP, marginTop: 10 }} onClick={applyToBuilder}>
            Stage for RAMS builder
          </button>
        </div>
      )}
    </div>
  );
}
