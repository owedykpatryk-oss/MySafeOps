import { useEffect, useMemo, useRef } from "react";
import { derivePermitStatus, permitEndIso } from "../permitRules";
import { PERMIT_TYPES } from "../permitTypes";
import "./../permitLiveWall.css";

function fmtTimeLeft(endIso, now) {
  if (!endIso) return "No expiry";
  const diff = new Date(endIso).getTime() - now.getTime();
  if (diff <= 0) return "EXPIRED";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function wallTone(status, kiosk) {
  if (status === "expired") return { bg: kiosk ? "#450a0a" : "#FCEBEB", color: kiosk ? "#fecaca" : "#791F1F" };
  if (status === "pending_review") return { bg: kiosk ? "#422006" : "#FAEEDA", color: kiosk ? "#fde68a" : "#633806" };
  if (status === "approved") return { bg: kiosk ? "#0c2d4a" : "#E6F1FB", color: kiosk ? "#7dd3fc" : "#0C447C" };
  if (status === "active") return { bg: kiosk ? "#14532d" : "#EAF3DE", color: kiosk ? "#86efac" : "#27500A" };
  if (status === "closed") return { bg: kiosk ? "#1e293b" : "var(--color-background-secondary,#f7f7f5)", color: kiosk ? "#94a3b8" : "var(--color-text-secondary)" };
  return { bg: kiosk ? "#1e293b" : "var(--color-background-secondary,#f7f7f5)", color: kiosk ? "#94a3b8" : "var(--color-text-secondary)" };
}

function isCriticalUrgent(permit, now) {
  const status = derivePermitStatus(permit, now);
  if (status === "expired") return true;
  if (status !== "active") return false;
  const endIso = permitEndIso(permit);
  return endIso ? new Date(endIso).getTime() - now.getTime() < 30 * 60 * 1000 : false;
}

export default function PermitLiveWall({
  permits,
  now,
  isNarrow,
  stats,
  simopsMap,
  commandCounts = {},
  onOpen,
  onPreview,
  onPrint,
  onToggleFullscreen,
  isFullscreen,
  soundEnabled = true,
  onToggleSound,
}) {
  const kiosk = Boolean(isFullscreen);
  const prevCriticalRef = useRef(0);

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
        .slice(0, kiosk ? 16 : 12),
    [permits, now, kiosk]
  );

  const simopsHotCount = useMemo(() => {
    let n = 0;
    permits.forEach((p) => {
      if ((simopsMap?.get(p.id) || []).length > 0) n += 1;
    });
    return n;
  }, [permits, simopsMap]);

  const criticalCount = urgent.filter((p) => isCriticalUrgent(p, now)).length;

  useEffect(() => {
    if (!kiosk || !soundEnabled || criticalCount <= prevCriticalRef.current) {
      prevCriticalRef.current = criticalCount;
      return;
    }
    prevCriticalRef.current = criticalCount;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // ignore audio policy errors
    }
  }, [criticalCount, kiosk, soundEnabled]);

  const statRows = [
    ["In review", stats.pendingReview, "pending_review", false],
    ["Approved", stats.approved, "approved", false],
    ["Active", stats.active, "active", false],
    ["Expiring", stats.expiringSoon, "active", stats.expiringSoon > 0],
    ["Expired", stats.expired, "expired", stats.expired > 0],
    ["Handover", commandCounts.handoverDue || 0, "pending_review", (commandCounts.handoverDue || 0) > 0],
  ];

  return (
    <div className={`permit-live-wall app-panel-surface${kiosk ? " permit-live-wall--kiosk" : ""}`} style={{ padding: isNarrow && !kiosk ? 10 : 14, borderRadius: 12 }}>
      <div className="permit-live-wall__header">
        <div>
          <div className="permit-live-wall__title">{kiosk ? "Site permit wall · LIVE" : "Live Permit Wall"}</div>
          {!kiosk ? (
            <div style={{ fontSize: 11, color: "var(--plw-muted)", marginTop: 2 }}>
              Site office display — open fullscreen on a tablet at the gate
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {kiosk ? (
            <span className="permit-live-wall__date">
              {now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
            </span>
          ) : null}
          <span className="permit-live-wall__clock">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          {kiosk && onToggleSound ? (
            <button type="button" className="permit-live-wall__btn" onClick={onToggleSound}>
              {soundEnabled ? "Sound on" : "Sound off"}
            </button>
          ) : null}
          <button type="button" className="permit-live-wall__btn" onClick={onToggleFullscreen}>
            {isFullscreen ? "Exit fullscreen" : "TV / Fullscreen"}
          </button>
        </div>
      </div>

      {simopsHotCount > 0 ? (
        <div className="permit-live-wall__simops-banner">
          SIMOPS overlap detected on {simopsHotCount} permit{simopsHotCount === 1 ? "" : "s"} — review conflicts before activation
        </div>
      ) : null}

      <div
        className="permit-live-wall__stats"
        style={isNarrow && !kiosk ? { gridTemplateColumns: "repeat(2,minmax(0,1fr))" } : undefined}
      >
        {statRows.map(([label, value, key, pulse]) => {
          const tone = wallTone(key, kiosk);
          return (
            <div
              key={label}
              className={`permit-live-wall__stat${pulse && kiosk ? " permit-live-wall__stat--pulse" : ""}`}
              style={{ background: tone.bg, color: tone.color }}
            >
              <div className="permit-live-wall__stat-label">{label}</div>
              <div className="permit-live-wall__stat-value">{value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: kiosk ? 14 : 12, fontWeight: 700, marginBottom: 8, color: kiosk ? "#e2e8f0" : undefined }}>
          Urgent now
          {criticalCount > 0 ? (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#ef4444", fontWeight: 800 }}>
              {criticalCount} critical
            </span>
          ) : null}
        </div>
        {urgent.length === 0 ? (
          <div style={{ fontSize: 12, color: kiosk ? "#64748b" : "var(--color-text-secondary)" }}>No urgent permits — site clear.</div>
        ) : (
          <div className="permit-live-wall__urgent-grid" style={isNarrow && !kiosk ? { gridTemplateColumns: "1fr" } : undefined}>
            {urgent.map((p) => {
              const status = derivePermitStatus(p, now);
              const endIso = permitEndIso(p);
              const simops = (simopsMap?.get(p.id) || []).length;
              const def = PERMIT_TYPES[p.type] || PERMIT_TYPES.general;
              const tone = wallTone(status, kiosk);
              const critical = isCriticalUrgent(p, now);
              return (
                <div
                  key={p.id}
                  className={`permit-live-wall__urgent-card${critical ? " permit-live-wall__urgent-card--critical" : ""}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: kiosk ? 13 : 11, fontWeight: 700, color: def.color }}>{def.label}</span>
                    <span className="permit-live-wall__badge" style={{ background: tone.bg, color: tone.color }}>
                      {status === "expired" ? "EXPIRED" : fmtTimeLeft(endIso, now)}
                    </span>
                  </div>
                  <div style={{ fontSize: kiosk ? 15 : 12, fontWeight: 600, color: kiosk ? "#f8fafc" : undefined }}>
                    {p.location || "Unknown location"}
                  </div>
                  <div style={{ fontSize: kiosk ? 12 : 11, color: kiosk ? "#94a3b8" : "var(--color-text-secondary)", marginTop: 2 }}>
                    {p.issuedTo || "Unassigned"}
                    {simops > 0 ? ` · SIMOPS ×${simops}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" className="permit-live-wall__btn" onClick={() => onOpen?.(p)}>
                      Open
                    </button>
                    <button type="button" className="permit-live-wall__btn" onClick={() => onPreview?.(p)}>
                      Preview
                    </button>
                    <button type="button" className="permit-live-wall__btn permit-live-wall__btn--accent" onClick={() => onPrint?.(p)}>
                      PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="permit-live-wall__columns"
        style={isNarrow && !kiosk ? { gridTemplateColumns: "1fr" } : undefined}
      >
        {[
          ["Active permits", byStatus.active],
          ["In review", byStatus.pending_review],
          ["Approved", byStatus.approved],
          ["Expired", byStatus.expired],
        ].map(([title, list]) => (
          <div key={title} className="permit-live-wall__column">
            <div style={{ fontSize: kiosk ? 13 : 12, fontWeight: 700, marginBottom: 8, color: kiosk ? "#e2e8f0" : undefined }}>
              {title}{" "}
              <span style={{ color: kiosk ? "#64748b" : "var(--color-text-secondary)" }}>({list.length})</span>
            </div>
            {list.length === 0 ? (
              <div style={{ fontSize: 11, color: kiosk ? "#64748b" : "var(--color-text-secondary)" }}>None</div>
            ) : (
              list.slice(0, kiosk ? 12 : 8).map((p) => (
                <div
                  key={p.id}
                  style={{
                    fontSize: kiosk ? 12 : 11,
                    padding: "5px 0",
                    borderTop: "1px solid var(--plw-border)",
                    color: kiosk ? "#cbd5e1" : undefined,
                    cursor: onOpen ? "pointer" : "default",
                  }}
                  onClick={() => onOpen?.(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen?.(p);
                  }}
                  role={onOpen ? "button" : undefined}
                  tabIndex={onOpen ? 0 : undefined}
                >
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
