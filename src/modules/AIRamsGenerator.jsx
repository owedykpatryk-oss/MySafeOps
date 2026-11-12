import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { ramsDraftScope } from "./rams/ramsBuilderDraft";
import { ramsDocumentStorageScope } from "./rams/ramsDocumentSave";
import { writeAiRamsPrefill } from "./rams/ramsAiPrefill";
import { useState, useRef } from "react";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { anthropicMessages, isAnthropicConfigured } from "../utils/anthropicClient";
import { buildAiRamsSystemPrompt } from "../../shared/aiPromptTemplates.mjs";
import { pushAudit } from "../utils/auditLog";
import { getIndustryPackLabel } from "../utils/industryPackProfile";
import { getRamsStarterAiHint } from "../utils/ramsIndustryStarters";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";
import { getOrgMarketId } from "../utils/orgMarket";
import { getRamsShortLabel } from "../utils/marketLabels";

export { buildAiRamsSystemPrompt };

const ss = { ...ms, ta: { ...ms.inp, minHeight: 120, resize: "vertical" } };

export default function AIRamsGenerator() {
  const auth = useSupabaseAuth();
  const ownerRef = useRef(null);
  ownerRef.current = { userId: auth.user?.id, localOnly: !auth.supabase };
  const getScope = () => ramsDraftScope({ ...ownerRef.current, storageScope: ramsDocumentStorageScope() });
  const resultScopeRef = useRef(null);
  const marketId = getOrgMarketId();
  const documentLabel = getRamsShortLabel(marketId);
  const [activity, setActivity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");

  const run = async () => {
    if (!activity.trim()) {
      setError("Describe the work first, then generate.");
      return;
    }
    const requestScope = getScope();
    if (!requestScope) return;
    setError("");
    setLoading(true);
    setRaw("");
    try {
      const text = await anthropicMessages({
        promptId: "rams_draft",
        marketId,
        system: buildAiRamsSystemPrompt(marketId),
        messages: [
          {
            role: "user",
            content: `${getRamsStarterAiHint()}\nWorkspace profile: ${getIndustryPackLabel()}.\n\nActivity / scope:\n${activity.trim()}`,
          },
        ],
        maxTokens: 8192,
      });
      if (getScope() !== requestScope) return;
      resultScopeRef.current = requestScope;
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
      if (resultScopeRef.current !== getScope()) throw new Error("Workspace changed. Generate a new draft in this workspace.");
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("no json");
      const json = JSON.parse(raw.slice(start, end + 1));
      writeAiRamsPrefill(resultScopeRef.current, json);
      alert('Go to RAMS tab → "+ Build new RAMS" — AI draft will load into the builder.');
    } catch (error) {
      setError(error.message || "Could not parse JSON. Copy the response and fix manually.");
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
        <button type="button" style={{ ...ss.btnP, marginTop: 10 }} disabled={loading || !hasKey || !activity.trim()} onClick={run}>
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
