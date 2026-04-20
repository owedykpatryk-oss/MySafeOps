import { useState } from "react";
import { anthropicMessages, isAnthropicConfigured } from "../utils/anthropicClient";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";

const ss = { ...ms, ta: { ...ms.inp, minHeight: 100, resize: "vertical" } };

export default function ToolboxTalkAI() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");

  const run = async () => {
    if (!topic.trim()) return;
    setErr("");
    setLoading(true);
    setOut("");
    try {
      const text = await anthropicMessages({
        system:
          "You write short UK site toolbox talks (5–7 bullet points, plain English, no jargon). Include one UK regulation reference where relevant. No JSON.",
        messages: [{ role: "user", content: `Toolbox talk topic: ${topic.trim()}` }],
        maxTokens: 1024,
      });
      setOut(text);
      pushAudit({ action: "ai_toolbox_talk", entity: "claude", detail: "ok" });
    } catch (e) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="TB"
        title="AI toolbox talk"
        lead="Same API key as RAMS AI. Output is guidance only — supervisor must adapt to site."
      />
      <div style={ss.card}>
        <textarea style={ss.ta} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Working near forklift routes, manual handling of panels…" />
        <button type="button" style={{ ...ss.btnP, marginTop: 10 }} disabled={loading || !isAnthropicConfigured()} onClick={run}>
          {loading ? "…" : "Generate talk"}
        </button>
      </div>
      {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
      {out && (
        <div style={{ ...ss.card, marginTop: 16, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {out}
        </div>
      )}
    </div>
  );
}
