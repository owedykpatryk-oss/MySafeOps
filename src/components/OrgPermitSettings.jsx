import { PERMIT_TYPES } from "../modules/permits/permitTypes";
import {
  allPermitTypeIds,
  normalizeEnabledPermitTypeIds,
  normalizePermitQuickFavorites,
  PACK_DEFAULT_PERMIT_TYPES,
} from "../modules/permits/permitOrgPrefs";
import { getAppliedIndustryPackId, getWorkspacePackLabel } from "../utils/orgIndustryPacks";
import { ms } from "../utils/moduleStyles";
import { PTW_REPLAY_GUIDE_EVENT, resetPermitGuide } from "../utils/permitGuideStorage";
import { PTW_RESET_TIPS_EVENT } from "../utils/permitContextTips";

const ss = ms;

export default function OrgPermitSettings({ form, set }) {
  const allIds = allPermitTypeIds();
  const enabled = normalizeEnabledPermitTypeIds(form.enabledPermitTypes);
  const favorites = normalizePermitQuickFavorites(form.permitQuickFavorites);
  const packId = getAppliedIndustryPackId() || form.industryPackId;
  const packDefaults = PACK_DEFAULT_PERMIT_TYPES[packId] || [];

  const toggleType = (typeId) => {
    const setIds = new Set(enabled.length ? enabled : allIds);
    if (setIds.has(typeId)) setIds.delete(typeId);
    else setIds.add(typeId);
    const next = [...setIds];
    if (next.length < 3) return;
    set("enabledPermitTypes", next);
  };

  const applyPackDefaults = () => {
    if (!packDefaults.length) {
      set("enabledPermitTypes", []);
      return;
    }
    set("enabledPermitTypes", [...packDefaults]);
  };

  const toggleFavoriteType = (typeId) => {
    const setIds = new Set(favorites.types);
    if (setIds.has(typeId)) setIds.delete(typeId);
    else setIds.add(typeId);
    set("permitQuickFavorites", { ...favorites, types: [...setIds].slice(0, 5) });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        Choose which permit types your team sees in <strong>Quick issue</strong>. Hidden types stay available to org admins via full list.
        Profile <strong>{getWorkspacePackLabel(packId)}</strong>
        {packDefaults.length ? ` suggests ${packDefaults.length} types.` : " shows all types."}
      </div>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={form.permitSupervisorMode === true}
          onChange={(e) => set("permitSupervisorMode", e.target.checked)}
        />
        Site supervisor mode (simple UI)
      </label>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: -8 }}>
        Hides war room, SLA digest, audit export, matrix/workflow editors and integration panels. Shows Quick issue, list and TV wall.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={applyPackDefaults} style={{ ...ss.btn, fontSize: 12 }}>
          Apply profile defaults
        </button>
        <button type="button" onClick={() => set("enabledPermitTypes", [])} style={{ ...ss.btn, fontSize: 12 }}>
          Show all types
        </button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
        Our permit types ({enabled.length || allIds.length} selected)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
        {allIds.map((typeId) => {
          const def = PERMIT_TYPES[typeId];
          const on = enabled.length ? enabled.includes(typeId) : true;
          const starred = favorites.types.includes(typeId);
          return (
            <label
              key={typeId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${on ? def.color : "var(--color-border-tertiary,#e5e5e5)"}`,
                background: on ? def.bg : "var(--color-background-secondary,#f7f7f5)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={on} onChange={() => toggleType(typeId)} />
              <span style={{ flex: 1, color: def.color, fontWeight: 600 }}>{def.label}</span>
              <button
                type="button"
                title="Quick issue favourite"
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavoriteType(typeId);
                }}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}
              >
                {starred ? "⭐" : "☆"}
              </button>
            </label>
          );
        })}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Favourite locations (one per line, max 8)</div>
        <textarea
          rows={4}
          value={(favorites.locations || []).join("\n")}
          onChange={(e) =>
            set("permitQuickFavorites", {
              ...favorites,
              locations: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
          placeholder="Bay 3&#10;Plant room&#10;Yard"
          style={{ ...ss.ta, minHeight: 80 }}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Favourite issuers / holders (one per line, max 5)</div>
        <textarea
          rows={3}
          value={(favorites.issuers || []).join("\n")}
          onChange={(e) =>
            set("permitQuickFavorites", {
              ...favorites,
              issuers: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 5),
            })
          }
          placeholder="Site manager name&#10;Subcontractor lead"
          style={{ ...ss.ta, minHeight: 64 }}
        />
      </div>

      <div style={{ borderTop: "1px solid var(--color-border, #e5e7eb)", paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", marginBottom: 8 }}>
          Team guidance
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
          Replay the PTW tour for new supervisors or reset in-app tips after training.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...ss.btn, fontSize: 12 }}
            onClick={() => window.dispatchEvent(new CustomEvent(PTW_REPLAY_GUIDE_EVENT))}
          >
            Replay PTW guide
          </button>
          <button
            type="button"
            style={{ ...ss.btn, fontSize: 12 }}
            onClick={() => window.dispatchEvent(new CustomEvent(PTW_RESET_TIPS_EVENT))}
          >
            Reset PTW tips
          </button>
          <button
            type="button"
            style={{ ...ss.btn, fontSize: 12 }}
            onClick={() => {
              resetPermitGuide();
              window.dispatchEvent(new CustomEvent(PTW_REPLAY_GUIDE_EVENT));
            }}
          >
            Reset guide (this browser)
          </button>
        </div>
      </div>
    </div>
  );
}
