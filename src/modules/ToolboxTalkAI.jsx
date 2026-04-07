import { useState } from "react";
import { anthropicMessages, getAnthropicKey } from "../utils/anthropicClient";
import { pushAudit } from "../utils/auditLog";

const ss = {
  btnP: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#E1F5EE", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif" },
  ta: { width: "100%", padding: "10px", borderRadius: 6, border: "0.5px solid #ccc", fontSize: 13, fontFamily: "DM Sans,sans-serif", minHeight: 100, boxSizing: "border-box" },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

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
      <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>AI toolbox talk</h2>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
        Same API key as RAMS AI. Output is guidance only — supervisor must adapt to site.
      </p>
      <div style={ss.card}>
        <textarea style={ss.ta} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Working near forklift routes, manual handling of panels…" />
        <button type="button" style={{ ...ss.btnP, marginTop: 10 }} disabled={loading || !getAnthropicKey()} onClick={run}>
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
