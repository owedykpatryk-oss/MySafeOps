import { useEffect, useRef, useState } from "react";
import { clampPercent, planDisplaySrc } from "../permitPlanOverlayRegistry";
import PermitDialogShell, { permitDialogStyles as ss } from "./PermitDialogShell";

const SEVERITIES = [
  { value: "near_miss", label: "Near miss" },
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "environmental", label: "Environmental" },
  { value: "utility_strike", label: "Utility strike" },
  { value: "confined_space", label: "Confined space" },
  { value: "property_damage", label: "Property damage" },
];

function clientToPercent(el, clientX, clientY) {
  if (!el) return { x: 50, y: 50 };
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 50, y: 50 };
  return {
    x: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export default function PermitIncidentReportDialog({ open, permit, projectPlans = [], onSubmit, onClose }) {
  const surfaceRef = useRef(null);
  const [title, setTitle] = useState("Site incident");
  const [severity, setSeverity] = useState("near_miss");
  const [summary, setSummary] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [planId, setPlanId] = useState("");
  const [pin, setPin] = useState(null);

  const plansForProject = projectPlans.filter((p) => p?.projectId === permit?.projectId);

  useEffect(() => {
    if (!open) return;
    setTitle("Site incident");
    setSeverity("near_miss");
    setSummary("");
    setMediaUrls("");
    setPin(null);
    const first = plansForProject[0];
    setPlanId(first?.id || "");
    setPinEnabled(Boolean(first && planDisplaySrc(first)));
  }, [open, permit?.id, projectPlans]);

  if (!open || !permit) return null;

  const selectedPlan = plansForProject.find((p) => p.id === planId) || plansForProject[0];
  const markSrc = selectedPlan ? planDisplaySrc(selectedPlan) : "";

  const handleSubmit = () => {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return;
    const media = String(mediaUrls || "")
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((url) => ({ type: "link", url }));
    let planPin = null;
    if (pinEnabled && selectedPlan && pin) {
      planPin = { planId: selectedPlan.id, x: pin.x, y: pin.y };
    }
    onSubmit?.({
      title: cleanTitle,
      severity,
      summary: String(summary || "").trim(),
      media,
      planPin,
    });
  };

  return (
    <PermitDialogShell
      title="Report incident"
      titleId="permit-incident-title"
      description={`Linked to permit ${permit.id}${permit.location ? ` · ${permit.location}` : ""}`}
      onClose={onClose}
      maxWidth={560}
      footer={
        <>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnO} onClick={handleSubmit}>
            Log incident
          </button>
        </>
      }
    >
      <label style={{ ...ss.lbl, display: "block", marginBottom: 4 }} htmlFor="permit-incident-report-dialog-title">Title</label>
      <input style={{ ...ss.inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }} value={title} onChange={(e) => setTitle(e.target.value)}  id="permit-incident-report-dialog-title" />

      <label style={{ ...ss.lbl, display: "block", marginBottom: 4 }} htmlFor="permit-incident-report-dialog-severity">Severity</label>
      <select style={{ ...ss.inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }} value={severity} onChange={(e) => setSeverity(e.target.value)} id="permit-incident-report-dialog-severity">
        {SEVERITIES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <label style={{ ...ss.lbl, display: "block", marginBottom: 4 }} htmlFor="permit-incident-report-dialog-summary">Summary</label>
      <textarea
        style={{ ...ss.inp, minHeight: 72, resize: "vertical", width: "100%", boxSizing: "border-box", marginBottom: 10 }}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What happened, immediate actions taken…"
       id="permit-incident-report-dialog-summary" />

      <label style={{ ...ss.lbl, display: "block", marginBottom: 4 }} htmlFor="permit-incident-report-dialog-media-links-optional">Media links (optional)</label>
      <textarea
        style={{ ...ss.inp, minHeight: 48, resize: "vertical", width: "100%", boxSizing: "border-box", marginBottom: 10, fontSize: 12 }}
        value={mediaUrls}
        onChange={(e) => setMediaUrls(e.target.value)}
        placeholder="One URL per line — photo, video, or voice note links"
       id="permit-incident-report-dialog-media-links-optional" />

      {plansForProject.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={pinEnabled} onChange={(e) => setPinEnabled(e.target.checked)} />
            Pin location on site plan
          </label>
          {pinEnabled ? (
            <>
              <select
                style={{ ...ss.inp, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setPin(null);
                }}
              >
                {plansForProject.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
              {markSrc ? (
                <div
                  ref={surfaceRef}
                  style={{
                    position: "relative",
                    border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "crosshair",
                    maxHeight: 280,
                  }}
                  onClick={(e) => {
                    const pt = clientToPercent(surfaceRef.current, e.clientX, e.clientY);
                    setPin(pt);
                  }}
                >
                  <img src={markSrc} alt={selectedPlan?.name || "Plan"} style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "contain" }} draggable={false} />
                  {pin ? (
                    <div
                      title="Incident pin"
                      style={{
                        position: "absolute",
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                        transform: "translate(-50%,-50%)",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#A32D2D",
                        border: "2px solid #fff",
                        boxShadow: "0 0 0 2px #A32D2D",
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                  This plan has no click preview — choose a JPG/PNG plan or pick another file.
                </p>
              )}
              <p style={{ fontSize: 11, color: "var(--color-text-tertiary,#94a3b8)", margin: "6px 0 0" }}>
                Click once on the plan to place the incident pin.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </PermitDialogShell>
  );
}
