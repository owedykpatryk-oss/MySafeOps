import { useMemo } from "react";
import { PERMIT_TYPES } from "../permitTypes";
import { derivePermitStatus } from "../permitRules";
import { favoriteTypesForIssue } from "../permitOrgPrefs";
import { formatRecentPermitAge } from "../permitRecentHistory";

const STATUS_LABELS = {
  active: "Active",
  approved: "Approved",
  pending_review: "In review",
  draft: "Draft",
  closed: "Closed",
  expired: "Expired",
};

function statusTone(status) {
  if (status === "active") return { bg: "#ecfdf5", color: "#047857", border: "#6ee7b7" };
  if (status === "expired") return { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" };
  if (status === "pending_review") return { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" };
  if (status === "approved") return { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" };
  return { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
}

export default function PermitQuickIssueHub({
  issuePermitTypes = PERMIT_TYPES,
  favorites = { types: [], issuers: [], locations: [] },
  recentPermits = [],
  recentLocations = [],
  projects: _projects = [],
  now = new Date(),
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
    <div className="ptw-quick-hub app-panel-surface">
      <div className="ptw-quick-hub__head">
        <div>
          <div className="ptw-quick-hub__title">Quick issue</div>
          <div className="ptw-quick-hub__lead">
            {supervisorMode ? "Site supervisor mode — issue, list and TV wall only." : "Favourites, recent permits and locations — one tap to issue."}
          </div>
        </div>
        <div className="ptw-quick-hub__head-actions">
          {onOpenList ? (
            <button type="button" className="ptw-quick-hub__link-btn" onClick={onOpenList}>
              All permits
            </button>
          ) : null}
          {onOpenWall ? (
            <button type="button" className="ptw-quick-hub__link-btn" onClick={onOpenWall}>
              TV wall
            </button>
          ) : null}
        </div>
      </div>

      <div className="ptw-quick-hub__section">
        <div className="ptw-quick-hub__section-label">
          Permit types {favorites.types?.length ? "· favourites first" : ""}
        </div>
        <div className="ptw-quick-hub__type-row">
          {favoriteTypes.map((typeId) => {
            const def = issuePermitTypes[typeId] || PERMIT_TYPES[typeId];
            if (!def) return null;
            const pinned = (favorites.types || []).includes(typeId);
            return (
              <button
                key={typeId}
                type="button"
                className="ptw-quick-hub__type-btn"
                onClick={() => onIssueType?.(typeId)}
                title={def.description}
                style={{ borderColor: def.color, background: def.bg, color: def.color }}
              >
                {pinned ? "⭐ " : ""}
                {def.label}
              </button>
            );
          })}
        </div>
        {onToggleFavoriteType ? (
          <div className="ptw-quick-hub__tip">Tip: configure favourites in Settings → Modules → Permits</div>
        ) : null}
      </div>

      <div className="ptw-quick-hub__section">
        <div className="ptw-quick-hub__section-label">Recent permits</div>
        {recentPermits.length === 0 ? (
          <div className="ptw-quick-hub__empty">No recent permits — issue your first one above.</div>
        ) : (
          <div className="ptw-quick-hub__recent-list">
            {recentPermits.slice(0, 8).map((p) => {
              const def = issuePermitTypes[p.type] || PERMIT_TYPES[p.type] || PERMIT_TYPES.general;
              const age = formatRecentPermitAge(p.updatedAt || p.createdAt);
              const derived = derivePermitStatus(p, now);
              const tone = statusTone(derived);
              return (
                <div key={p.id} className="ptw-quick-hub__recent-row">
                  <div className="ptw-quick-hub__recent-main">
                    <div className="ptw-quick-hub__recent-title" style={{ color: def.color }}>
                      {def.label} · {p.location || "No location"}
                      <span
                        className="ptw-quick-hub__status"
                        style={{ background: tone.bg, color: tone.color, borderColor: tone.border }}
                      >
                        {STATUS_LABELS[derived] || derived}
                      </span>
                    </div>
                    <div className="ptw-quick-hub__recent-meta">
                      {p.issuedTo || "Unassigned"} · {age}
                    </div>
                  </div>
                  <div className="ptw-quick-hub__recent-actions">
                    <button type="button" className="ptw-quick-hub__mini-btn" onClick={() => onRepeatPermit?.(p)}>
                      Repeat
                    </button>
                    <button type="button" className="ptw-quick-hub__mini-btn" onClick={() => onRepeatSameTypeNewLocation?.(p)}>
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
        <div className="ptw-quick-hub__section">
          <div className="ptw-quick-hub__section-label">Locations</div>
          <div className="ptw-quick-hub__chip-row">
            {locationChips.map((loc) => (
              <button key={loc} type="button" className="ptw-quick-hub__chip" onClick={() => onLocationChip?.(loc)}>
                {loc}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {issuerChips.length > 0 ? (
        <div className="ptw-quick-hub__section">
          <div className="ptw-quick-hub__section-label">Favourite issuers / holders</div>
          <div className="ptw-quick-hub__chip-row">
            {issuerChips.map((name) => (
              <span key={name} className="ptw-quick-hub__issuer-chip">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
