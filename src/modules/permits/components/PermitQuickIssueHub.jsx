import { useMemo } from "react";
import { PERMIT_TYPES } from "../permitTypes";
import { favoriteTypesForIssue } from "../permitOrgPrefs";
import { formatRecentPermitAge } from "../permitRecentHistory";

export default function PermitQuickIssueHub({
  issuePermitTypes = PERMIT_TYPES,
  favorites = { types: [], issuers: [], locations: [] },
  recentPermits = [],
  recentLocations = [],
  projects = [],
  onIssueType,
  onRepeatPermit,
  onRepeatSameTypeNewLocation,
  onLocationChip,
  onOpenList,
  onOpenWall,
  onToggleFavoriteType,
  supervisorMode = false,
}) {
  const favoriteTypes = useMemo(
    () => favoriteTypesForIssue(issuePermitTypes, favorites, 6),
    [issuePermitTypes, favorites]
  );

  const locationChips = useMemo(() => {
    const chips = new Set();
    (favorites.locations || []).forEach((l) => chips.add(l));
    recentLocations.slice(0, 8).forEach((row) => {
      if (row.location) chips.add(row.location);
    });
    return [...chips].slice(0, 8);
  }, [favorites.locations, recentLocations]);

  const issuerChips = favorites.issuers || [];

  return (
    <div
      className="app-panel-surface"
      style={{
        padding: 16,
        borderRadius: 14,
        marginBottom: 16,
        background: "linear-gradient(135deg,#f8fafc 0%,#ecfeff 55%,#f0fdf4 100%)",
        border: "1px solid #cbd5e1",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Quick issue</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {supervisorMode ? "Site supervisor mode — issue, list and TV wall only." : "Favourites, recent permits and locations — one tap to issue."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onOpenList ? (
            <button type="button" onClick={onOpenList} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
              All permits
            </button>
          ) : null}
          {onOpenWall ? (
            <button type="button" onClick={onOpenWall} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
              TV wall
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
          Permit types {favorites.types?.length ? "· favourites first" : ""}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {favoriteTypes.map((typeId) => {
            const def = issuePermitTypes[typeId] || PERMIT_TYPES[typeId];
            if (!def) return null;
            const pinned = (favorites.types || []).includes(typeId);
            return (
              <button
                key={typeId}
                type="button"
                onClick={() => onIssueType?.(typeId)}
                title={def.description}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${def.color}`,
                  background: def.bg,
                  color: def.color,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                {pinned ? "⭐ " : ""}
                {def.label}
              </button>
            );
          })}
        </div>
        {onToggleFavoriteType ? (
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>Tip: configure favourites in Settings → Modules → Permits</div>
        ) : null}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
          Recent permits
        </div>
        {recentPermits.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>No recent permits — issue your first one above.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentPermits.slice(0, 8).map((p) => {
              const def = issuePermitTypes[p.type] || PERMIT_TYPES[p.type] || PERMIT_TYPES.general;
              const age = formatRecentPermitAge(p.updatedAt || p.createdAt);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: def.color }}>
                      {def.label} · {p.location || "No location"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {p.issuedTo || "Unassigned"} · {age}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => onRepeatPermit?.(p)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
                      Repeat
                    </button>
                    <button type="button" onClick={() => onRepeatSameTypeNewLocation?.(p)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
                      Same type
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {locationChips.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
            Locations
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {locationChips.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => onLocationChip?.(loc)}
                style={{ fontSize: 11, padding: "5px 10px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {issuerChips.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 8 }}>
            Favourite issuers / holders
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {issuerChips.map((name) => (
              <span key={name} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", color: "#475569" }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
