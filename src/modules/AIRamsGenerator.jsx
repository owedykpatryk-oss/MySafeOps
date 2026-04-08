import { useState } from "react";
import { anthropicMessages, getAnthropicKey } from "../utils/anthropicClient";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";

const ss = { ...ms, ta: { ...ms.inp, minHeight: 120, resize: "vertical" } };

const SYSTEM = `You are a UK construction health & safety assistant for RAMS (Risk Assessment and Method Statement).
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
      "regs": ["string — UK regulations only, accurate names"]
    }
  ],
  "methodSteps": ["high-level safe sequence step 1", "step 2", ...]
}
Use British English. Risk factor RF = L * S. Be specific to the activity described. Include 6–15 hazards for a typical site job.`;

export default function AIRamsGenerator() {
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
        system: SYSTEM,
        messages: [{ role: "user", content: `Activity / scope:\n${activity.trim()}` }],
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

  const hasKey = !!getAnthropicKey();

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="AI"
        title="AI RAMS generator"
        lead={
          <>
            Uses Anthropic Claude (browser key — dev only). Set <code style={{ fontSize: 12 }}>VITE_ANTHROPIC_API_KEY</code> in <code style={{ fontSize: 12 }}>.env</code> and restart{" "}
            <code style={{ fontSize: 12 }}>npm run dev</code>.
          </>
        }
      />
      {!hasKey && (
        <div style={{ ...ss.card, background: "#FAEEDA", color: "#633806", marginBottom: 16 }}>No API key configured.</div>
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
