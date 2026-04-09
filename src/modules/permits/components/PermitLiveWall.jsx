import { useMemo } from "react";
import { derivePermitStatus, permitEndIso } from "../permitRules";
import { PERMIT_TYPES } from "../permitTypes";

function fmtTimeLeft(endIso, now) {
  if (!endIso) return "No expiry";
  const diff = new Date(endIso).getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function wallTone(status) {
  if (status === "expired") return { bg: "#FCEBEB", color: "#791F1F" };
  if (status === "pending_review") return { bg: "#FAEEDA", color: "#633806" };
  if (status === "approved") return { bg: "#E6F1FB", color: "#0C447C" };
  if (status === "active") return { bg: "#EAF3DE", color: "#27500A" };
  if (status === "closed") return { bg: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-secondary)" };
  return { bg: "var(--color-background-secondary,#f7f7f5)", color: "var(--color-text-secondary)" };
}

export default function PermitLiveWall({
  permits,
  now,
  isNarrow,
  stats,
  simopsMap,
  onOpen,
  onPreview,
  onPrint,
  onToggleFullscreen,
  isFullscreen,
}) {
  const byStatus = useMemo(() => {
    const bucket = { active: [], expired: [], pending_review: [], approved: [], draft: [], closed: [] };
    permits.forEach((p) => {
      const s = derivePermitStatus(p, now);
      if (!bucket[s]) bucket[s] = [];
      bucket[s].push(p);
    });
    return bucket;
  }, [permits, now]);

  const urgent = useMemo(
    () =>
      permits
        .filter((p) => {
          const s = derivePermitStatus(p, now);
          if (s === "expired") return true;
          if (s !== "active") return false;
          const endIso = permitEndIso(p);
          return endIso ? new Date(endIso).getTime() - now.getTime() < 60 * 60 * 1000 : false;
        })
        .sort((a, b) => new Date(permitEndIso(a) || 0).getTime() - new Date(permitEndIso(b) || 0).getTime())
        .slice(0, 12),
    [permits, now]
  );

  return (
    <div className="app-panel-surface" style={{ padding: isNarrow ? 10 : 14, borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: isNarrow ? 12 : 13, fontWeight: 700 }}>Live Permit Wall</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <button type="button" onClick={onToggleFullscreen} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(2,minmax(0,1fr))" : "repeat(6,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
        {[
          ["In review", stats.pendingReview, "pending_review"],
          ["Approved", stats.approved, "approved"],
          ["Active", stats.active, "active"],
          ["Expiring", stats.expiringSoon, "active"],
          ["Expired", stats.expired, "expired"],
          ["Closed", stats.closed, "closed"],
        ].map(([label, value, key]) => {
          const tone = wallTone(key);
          return (
            <div key={label} style={{ background: tone.bg, color: tone.color, borderRadius: 8, padding: "8px 10px", minHeight: 62 }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Urgent now</div>
        {urgent.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>No urgent permits.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            {urgent.map((p) => {
              const status = derivePermitStatus(p, now);
              const endIso = permitEndIso(p);
              const simops = (simopsMap?.get(p.id) || []).length;
              const def = PERMIT_TYPES[p.type] || PERMIT_TYPES.general;
              const tone = wallTone(status);
              return (
                <div key={p.id} style={{ border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: def.color }}>{def.label}</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: tone.bg, color: tone.color, fontWeight: 700 }}>
                      {status === "expired" ? "EXPIRED" : fmtTimeLeft(endIso, now)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p.location || "Unknown location"}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {p.issuedTo || "Unassigned"}
                    {simops > 0 ? ` · SIMOPS x${simops}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => onOpen?.(p)} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                      Open
                    </button>
                    <button type="button" onClick={() => onPreview?.(p)} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                      Preview
                    </button>
                    <button type="button" onClick={() => onPrint?.(p)} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, border: "0.5px solid #c2410c", background: "#f97316", color: "#fff", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                      PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(4,minmax(0,1fr))", gap: 8 }}>
        {[
          ["Active permits", byStatus.active],
          ["In review", byStatus.pending_review],
          ["Approved", byStatus.approved],
          ["Expired", byStatus.expired],
        ].map(([title, list]) => (
          <div key={title} style={{ border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: 8, minHeight: 140 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              {title} <span style={{ color: "var(--color-text-secondary)" }}>({list.length})</span>
            </div>
            {list.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>None</div>
            ) : (
              list.slice(0, 8).map((p) => (
                <div key={p.id} style={{ fontSize: 11, padding: "4px 0", borderTop: "1px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <strong>{p.location || "Unknown"}</strong> · {(PERMIT_TYPES[p.type] || PERMIT_TYPES.general).label}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
