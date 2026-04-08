import { useState, useRef } from "react";
import { getAnthropicKey, getAnthropicModel } from "../utils/anthropicClient";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import PageHero from "../components/PageHero";

const ss = ms;

async function anthropicVision({ prompt, base64, mediaType }) {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("Missing VITE_ANTHROPIC_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getAnthropicModel(),
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || res.statusText);
  return json?.content?.find((c) => c.type === "text")?.text || "";
}

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
        <button type="button" style={ss.btnP} disabled={loading || !getAnthropicKey()} onClick={() => ref.current?.click()}>
          {loading ? "Analysing…" : "Choose photo"}
        </button>
      </div>
      {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
      {out && <div style={{ ...ss.card, marginTop: 16, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{out}</div>}
    </div>
  );
}
