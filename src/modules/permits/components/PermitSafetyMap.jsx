import { useMemo, useState } from "react";
import { planDisplaySrc } from "../permitPlanOverlayRegistry";
import { permitsForPlan, simopsPairsForPlan } from "../permitPlanLivePins";
import { permitEndIso, derivePermitStatus } from "../permitRules";
import { PERMIT_TYPES } from "../permitTypes";

function fmtTimeLeft(endIso, now) {
  if (!endIso) return "";
  const diff = new Date(endIso).getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m left`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function statusColor(status) {
  if (status === "expired") return "#dc2626";
  if (status === "active") return "#16a34a";
  if (status === "pending_review") return "#d97706";
  if (status === "approved") return "#0284c7";
  return "#64748b";
}

export default function PermitSafetyMap({
  projects = [],
  plans = [],
  permits = [],
  drawingObjects = [],
  simopsMap,
  now = new Date(),
  permitTypes = PERMIT_TYPES,
  onOpenPermit,
  onPreviewPermit,
}) {
  const [projectId, setProjectId] = useState(() => projects[0]?.id || "");
  const [planId, setPlanId] = useState("");

  const plansForProject = useMemo(
    () => plans.filter((p) => !projectId || p.projectId === projectId),
    [plans, projectId]
  );

  const effectivePlanId = planId || plansForProject[0]?.id || "";
  const plan = plansForProject.find((p) => p.id === effectivePlanId) || null;
  const imageSrc = planDisplaySrc(plan);

  const placements = useMemo(
    () => (plan ? permitsForPlan(permits, plan.id, drawingObjects, now) : []),
    [permits, plan, drawingObjects, now]
  );

  const conflictPairs = useMemo(
    () => simopsPairsForPlan(placements, simopsMap),
    [placements, simopsMap]
  );

  const unplacedActive = useMemo(() => {
    const placedIds = new Set(placements.map((x) => x.permit.id));
    return permits.filter((p) => {
      const s = derivePermitStatus(p, now);
      if (!["active", "approved", "pending_review"].includes(s)) return false;
      if (projectId && p.projectId !== projectId) return false;
      return !placedIds.has(p.id);
    });
  }, [permits, placements, now, projectId]);

  return (
    <div className="app-panel-surface" style={{ padding: 14, borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.04em" }}>Live safety map</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Active permits on site plan — SIMOPS conflicts shown as red links
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setPlanId("");
            }}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary,#ccc)", minWidth: 180 }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={effectivePlanId}
            onChange={(e) => setPlanId(e.target.value)}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary,#ccc)", minWidth: 200 }}
          >
            <option value="">Select plan</option>
            {plansForProject.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!plan || !imageSrc ? (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: 24, textAlign: "center", border: "1px dashed var(--color-border-tertiary,#e5e5e5)", borderRadius: 10 }}>
          Upload a PNG/JPG site plan in Project settings, link permit locations to drawing objects, then pins appear here live.
        </div>
      ) : (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border-tertiary,#e5e5e5)", background: "#0f172a" }}>
          <img src={imageSrc} alt={plan.name} style={{ width: "100%", display: "block", maxHeight: 520, objectFit: "contain" }} />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {conflictPairs.map(({ a, b }) => (
              <line
                key={`${a.permit.id}:${b.permit.id}`}
                x1={a.pin.x}
                y1={a.pin.y}
                x2={b.pin.x}
                y2={b.pin.y}
                stroke="#ef4444"
                strokeWidth="0.35"
                strokeDasharray="1.2 0.8"
                opacity="0.85"
              />
            ))}
          </svg>
          {placements.map(({ permit, pin, status }) => {
            const def = permitTypes[permit.type] || permitTypes.general;
            const endIso = permitEndIso(permit);
            const expiring = status === "active" && endIso && new Date(endIso).getTime() - now.getTime() < 60 * 60 * 1000;
            const color = def.color || statusColor(status);
            return (
              <button
                key={permit.id}
                type="button"
                title={`${def.label} · ${permit.location || ""} · ${status}`}
                onClick={() => onOpenPermit?.(permit)}
                style={{
                  position: "absolute",
                  left: `${pin.x}%`,
                  top: `${pin.y}%`,
                  transform: "translate(-50%,-50%)",
                  width: expiring ? 22 : 18,
                  height: expiring ? 22 : 18,
                  borderRadius: "50%",
                  border: `2px solid ${expiring ? "#ef4444" : "#fff"}`,
                  background: color,
                  boxShadow: expiring ? "0 0 0 4px rgba(239,68,68,0.35)" : "0 2px 8px rgba(0,0,0,0.35)",
                  cursor: "pointer",
                  padding: 0,
                  animation: expiring ? "permitMapPulse 1.4s ease-in-out infinite" : undefined,
                  zIndex: 3,
                }}
              />
            );
          })}
          <style>{`@keyframes permitMapPulse{0%,100%{box-shadow:0 0 0 4px rgba(239,68,68,0.35)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0)}}`}</style>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
        <span>
          <strong style={{ color: "#16a34a" }}>{placements.filter((x) => x.status === "active").length}</strong> active on map
        </span>
        <span>
          <strong style={{ color: "#ef4444" }}>{conflictPairs.length}</strong> SIMOPS link{conflictPairs.length === 1 ? "" : "s"}
        </span>
        <span>
          <strong>{unplacedActive.length}</strong> active without plan pin
        </span>
      </div>

      {placements.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, marginTop: 12 }}>
          {placements.slice(0, 12).map(({ permit, status }) => {
            const def = permitTypes[permit.type] || permitTypes.general;
            const endIso = permitEndIso(permit);
            return (
              <div
                key={permit.id}
                style={{
                  border: "1px solid var(--color-border-tertiary,#e5e5e5)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 700, color: def.color }}>{def.label}</div>
                <div style={{ marginTop: 2 }}>{permit.location || "—"}</div>
                <div style={{ color: "var(--color-text-secondary)", marginTop: 2 }}>
                  {status}
                  {endIso ? ` · ${fmtTimeLeft(endIso, now)}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button type="button" onClick={() => onOpenPermit?.(permit)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
                    Open
                  </button>
                  {onPreviewPermit ? (
                    <button type="button" onClick={() => onPreviewPermit(permit)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
                      PDF
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
