import { useState, useRef } from "react";
import { anthropicVision, isAnthropicConfigured } from "../utils/anthropicClient";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";

const ss = ms;

export default function PhotoHazardAI() {
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const ref = useRef();

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
      if (!m) {
        setErr("Could not read image");
        return;
      }
      const mediaType = m[1];
      const base64 = m[2];
      setErr("");
      setOut("");
      setLoading(true);
      try {
        const text = await anthropicVision({
          base64,
          mediaType,
          prompt:
            "You are a UK construction safety observer. List visible hazards and practical controls (bullet list). Note limitations: photo may not show full context. British English.",
        });
        setOut(text);
        pushAudit({ action: "ai_photo_hazard", entity: "claude", detail: "ok" });
      } catch (er) {
        setErr(er.message || "Failed");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      <PageHero
        badgeText="PH"
        title="Photo hazard check"
        lead="Claude Vision — upload a site photo. Not a substitute for a formal risk assessment."
      />
      <div style={ss.card}>
        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={onPick} />
        <button type="button" style={ss.btnP} disabled={loading || !isAnthropicConfigured()} onClick={() => ref.current?.click()}>
          {loading ? "Analysing…" : "Choose photo"}
        </button>
      </div>
      {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
      {out && <div style={{ ...ss.card, marginTop: 16, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{out}</div>}
    </div>
  );
}
