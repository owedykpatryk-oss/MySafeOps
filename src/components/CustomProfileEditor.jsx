import { useEffect, useMemo, useState } from "react";
import { ms } from "../utils/moduleStyles";
import { MORE_SECTIONS, getMoreTabsForSection } from "../navigation/appModules";
import {
  getCustomWorkspaceProfile,
  ramsStarterOptionsForEditor,
  updateCustomWorkspaceProfile,
  visibleModulesForProfile,
} from "../utils/customWorkspaceProfiles";

const ss = ms;

/**
 * Edit a saved custom workspace profile — modules, survey workflow, RAMS starter.
 * @param {{ profileId: string, onSaved?: () => void, onSyncCloud?: () => Promise<void> }} props
 */
export default function CustomProfileEditor({ profileId, onSaved, onSyncCloud }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const profile = getCustomWorkspaceProfile(profileId);

  const [label, setLabel] = useState(profile?.label || "");
  const [hint, setHint] = useState(profile?.hint || "");
  const [surveyWorkflow, setSurveyWorkflow] = useState(!!profile?.surveyWorkflow);
  const [ramsStarterKey, setRamsStarterKey] = useState(profile?.ramsStarterKey ?? "general");
  const [visibleModules, setVisibleModules] = useState(() =>
    profile ? visibleModulesForProfile(profile) : []
  );

  useEffect(() => {
    const p = getCustomWorkspaceProfile(profileId);
    if (!p) return;
    setLabel(p.label);
    setHint(p.hint);
    setSurveyWorkflow(!!p.surveyWorkflow);
    setRamsStarterKey(p.ramsStarterKey ?? "general");
    setVisibleModules(visibleModulesForProfile(p));
  }, [profileId]);

  const starterOptions = useMemo(() => ramsStarterOptionsForEditor(), []);

  if (!profile) return null;

  const toggleModule = (id) => {
    setVisibleModules((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      updateCustomWorkspaceProfile(profileId, {
        label: label.trim(),
        hint: hint.trim(),
        surveyWorkflow,
        ramsStarterKey,
        visibleModuleIds: visibleModules,
      });
      if (onSyncCloud) await onSyncCloud();
      setMessage("Profile saved and synced to your organisation.");
      onSaved?.();
    } catch (e) {
      setMessage(e?.message || "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...ss.card, marginTop: 16, padding: 16 }}>
      <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Edit custom profile</p>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>
        Based on {profile.basedOn} · only visible in your organisation
      </p>
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <label style={{ fontSize: 13 }}>
          Name
          <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...ss.inp, marginTop: 4, width: "100%" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Short description
          <input value={hint} onChange={(e) => setHint(e.target.value)} style={{ ...ss.inp, marginTop: 4, width: "100%" }} />
        </label>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={surveyWorkflow} onChange={(e) => setSurveyWorkflow(e.target.checked)} />
          Survey deliverable workflow (Project Hub ends with Survey report)
        </label>
        <label style={{ fontSize: 13 }}>
          RAMS builder starter
          <select value={ramsStarterKey || "general"} onChange={(e) => setRamsStarterKey(e.target.value)} style={{ ...ss.inp, marginTop: 4, width: "100%" }}>
            {starterOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 8px" }}>Visible modules in More</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
        {MORE_SECTIONS.map((section) => (
          <div key={section.title}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>{section.title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {getMoreTabsForSection(section).map((tab) => (
                <label
                  key={tab.id}
                  style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                    background: visibleModules.includes(tab.id) ? "#EAF3DE" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleModules.includes(tab.id)}
                    onChange={() => toggleModule(tab.id)}
                    style={{ marginRight: 4 }}
                  />
                  {tab.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" style={ss.btnP} disabled={busy || !label.trim()} onClick={() => void save()}>
        {busy ? "Saving…" : "Save profile changes"}
      </button>
      {message ? <div style={{ marginTop: 8, fontSize: 13, color: message.includes("Could not") ? "#A32D2D" : "#27500A" }}>{message}</div> : null}
    </div>
  );
}
