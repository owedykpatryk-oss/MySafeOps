import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import {
  HIDE_PRESETS,
  HIDDEN_MODULES_UPDATED_EVENT,
  applyHidePreset,
  clearAllHidden,
  getHiddenFeatureIds,
  getHiddenModuleIds,
  getModuleCatalogSections,
  getModuleLabel,
  getFeatureLabel,
  hideFeature,
  hideModule,
  unhideFeature,
  unhideModule,
} from "../utils/hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { ms } from "../utils/moduleStyles";

const ss = ms;

export default function OrgModuleVisibility() {
  const { caps } = useApp();
  const { supabase } = useSupabaseAuth();
  const [hiddenModules, setHiddenModules] = useState(() => getHiddenModuleIds());
  const [hiddenFeatures, setHiddenFeatures] = useState(() => getHiddenFeatureIds());
  const [showHidden, setShowHidden] = useState(false);
  const [saved, setSaved] = useState(false);
  const canManage = Boolean(caps?.orgSettings);

  const refresh = () => {
    setHiddenModules(getHiddenModuleIds());
    setHiddenFeatures(getHiddenFeatureIds());
  };

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener(HIDDEN_MODULES_UPDATED_EVENT, onUpdate);
    window.addEventListener("mysafeops-org-settings-updated", onUpdate);
    return () => {
      window.removeEventListener(HIDDEN_MODULES_UPDATED_EVENT, onUpdate);
      window.removeEventListener("mysafeops-org-settings-updated", onUpdate);
    };
  }, []);

  const sections = useMemo(() => getModuleCatalogSections(), []);
  const hiddenCount = hiddenModules.length + hiddenFeatures.length;

  const syncCloud = async (nextRaw) => {
    if (!supabase || !canManage) return;
    try {
      const cloudAt = await pushOrgBrandingToCloud(supabase, nextRaw);
      if (cloudAt) saveOrgSettingsRaw(nextRaw, undefined, cloudAt);
    } catch {
      /* local hide still works */
    }
  };

  const toggleModule = async (moduleId, currentlyHidden) => {
    if (!canManage) return;
    if (currentlyHidden) unhideModule(moduleId);
    else hideModule(moduleId);
    refresh();
    await syncCloud(loadOrgSettingsRaw());
  };

  const toggleFeature = async (featureId, currentlyHidden) => {
    if (!canManage) return;
    if (currentlyHidden) unhideFeature(featureId);
    else hideFeature(featureId);
    refresh();
    await syncCloud(loadOrgSettingsRaw());
  };

  const runPreset = async (key) => {
    if (!canManage) return;
    applyHidePreset(key);
    refresh();
    await syncCloud(loadOrgSettingsRaw());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const restoreAll = async () => {
    if (!canManage) return;
    if (!window.confirm("Show all hidden modules and RAMS sections again?")) return;
    clearAllHidden();
    refresh();
    await syncCloud(loadOrgSettingsRaw());
  };

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 14, lineHeight: 1.55 }}>
        Hide modules you do not use — they stay in your organisation settings and can be restored anytime.
        Hidden items disappear from <strong>More</strong>, search, and the bottom bar (except Settings / Help).
      </p>

      {hiddenCount > 0 ? (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--color-background-secondary,#f8fafc)",
            border: "1px solid var(--color-border-tertiary,#e2e8f0)",
            fontSize: 13,
          }}
        >
          <strong>{hiddenCount}</strong> hidden item{hiddenCount > 1 ? "s" : ""}.
          {canManage ? (
            <>
              {" "}
              <button type="button" onClick={() => setShowHidden((v) => !v)} style={{ ...ss.btn, padding: "2px 8px", fontSize: 12, marginLeft: 4 }}>
                {showHidden ? "Hide list" : "Show hidden list"}
              </button>
              <button type="button" onClick={restoreAll} style={{ ...ss.btn, padding: "2px 8px", fontSize: 12, marginLeft: 4 }}>
                Unhide all
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {showHidden && hiddenCount > 0 ? (
        <div style={{ ...ss.card, marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Currently hidden</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {hiddenFeatures.map((id) => (
              <li key={id}>
                {getFeatureLabel(id)}{" "}
                {canManage ? (
                  <button type="button" style={{ ...ss.btn, padding: "0 6px", fontSize: 11 }} onClick={() => toggleFeature(id, true)}>
                    Unhide
                  </button>
                ) : null}
              </li>
            ))}
            {hiddenModules.map((id) => (
              <li key={id}>
                {getModuleLabel(id)}{" "}
                {canManage ? (
                  <button type="button" style={{ ...ss.btn, padding: "0 6px", fontSize: 11 }} onClick={() => toggleModule(id, true)}>
                    Unhide
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage ? (
        <div style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Quick presets
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(HIDE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => runPreset(key)}
                style={{
                  ...ss.btn,
                  textAlign: "left",
                  padding: "10px 12px",
                  alignItems: "flex-start",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{preset.label}</span>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{preset.hint}</span>
              </button>
            ))}
          </div>
          {saved ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "#27500A" }}>Preset applied — synced for this organisation.</div>
          ) : null}
        </div>
      ) : null}

      {sections.map((section) => (
        <div key={section.title} style={{ ...ss.card, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{section.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(section.features || []).map((f) => {
              const isHidden = hiddenFeatures.includes(f.id);
              if (isHidden && !showHidden) return null;
              return (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 0",
                    opacity: isHidden ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{f.label}</span>
                  {canManage ? (
                    <button
                      type="button"
                      style={{ ...ss.btn, padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                      onClick={() => toggleFeature(f.id, isHidden)}
                    >
                      {isHidden ? "Unhide" : "Hide"}
                    </button>
                  ) : null}
                </div>
              );
            })}
            {section.ids.map((moduleId) => {
              const isHidden = hiddenModules.includes(moduleId);
              if (isHidden && !showHidden) return null;
              return (
                <div
                  key={moduleId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 0",
                    opacity: isHidden ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{getModuleLabel(moduleId)}</span>
                  {canManage ? (
                    <button
                      type="button"
                      style={{ ...ss.btn, padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                      onClick={() => toggleModule(moduleId, isHidden)}
                    >
                      {isHidden ? "Unhide" : "Hide"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!canManage ? (
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Only organisation admins can change module visibility.</p>
      ) : null}
    </>
  );
}
