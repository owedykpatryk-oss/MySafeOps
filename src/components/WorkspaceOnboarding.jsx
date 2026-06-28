import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Sparkles, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useOrgBranding } from "../hooks/useOrgBranding";
import { getModuleLabel } from "../utils/hiddenModules";
import {
  getBottomNavModuleId,
  getBottomNavShortcutOptions,
  setBottomNavModuleId,
} from "../utils/bottomNavShortcut";
import { applyIndustryPack, INDUSTRY_PACKS } from "../utils/orgIndustryPacks";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { markOnboardingComplete } from "../utils/workspaceOnboarding";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";

const STEPS = ["welcome", "profile", "shortcut", "done"];

/**
 * First-run wizard for any organisation — industry pack, bottom-bar shortcut, quick links.
 */
export default function WorkspaceOnboarding({ onComplete }) {
  const { caps } = useApp();
  const { supabase } = useSupabaseAuth();
  const branding = useOrgBranding();
  const [stepIndex, setStepIndex] = useState(0);
  const [packKey, setPackKey] = useState(() => {
    const id = loadOrgSettingsRaw().industryPackId;
    return id && INDUSTRY_PACKS[id] ? id : "generalContractor";
  });
  const [shortcutId, setShortcutId] = useState(() => getBottomNavModuleId() || "");
  const [busy, setBusy] = useState(false);

  const step = STEPS[stepIndex];
  const canManage = Boolean(caps?.orgSettings);
  const shortcutOptions = useMemo(() => getBottomNavShortcutOptions(), []);

  const syncCloud = async () => {
    if (!supabase || !canManage) return;
    try {
      const raw = loadOrgSettingsRaw();
      const cloudAt = await pushOrgBrandingToCloud(supabase, raw);
      if (cloudAt) saveOrgSettingsRaw(raw, undefined, cloudAt);
    } catch {
      /* local ok */
    }
  };

  const finish = async () => {
    setBusy(true);
    markOnboardingComplete();
    await syncCloud();
    setBusy(false);
    onComplete?.();
  };

  const applyPackAndNext = async () => {
    if (canManage && packKey) applyIndustryPack(packKey);
    await syncCloud();
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const saveShortcutAndNext = () => {
    if (canManage) setBottomNavModuleId(shortcutId || null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  return (
    <div className="app-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="app-onboarding-title">
      <div className="app-onboarding-panel app-panel-surface">
        <button
          type="button"
          className="app-onboarding-close"
          aria-label="Skip setup for now"
          onClick={() => void finish()}
        >
          <X size={18} />
        </button>

        {step === "welcome" ? (
          <>
            <div className="app-onboarding-icon" aria-hidden>
              <Sparkles size={28} strokeWidth={2} />
            </div>
            <h2 id="app-onboarding-title" className="app-onboarding-title">
              Welcome to MySafeOps
            </h2>
            <p className="app-onboarding-lead">
              Set up <strong>{branding.displayName}</strong> in under a minute — module layout, quick navigation, and your first tasks.
            </p>
            <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex(1)}>
              Get started
              <ChevronRight size={18} aria-hidden />
            </button>
          </>
        ) : null}

        {step === "profile" ? (
          <>
            <h2 className="app-onboarding-title">Choose your workspace profile</h2>
            <p className="app-onboarding-lead">
              Pick what matches your work — you can change modules anytime in Settings → Organisation → Modules.
            </p>
            {!canManage ? (
              <p className="app-onboarding-note">Ask an organisation admin to apply a profile, or continue with the default layout.</p>
            ) : null}
            <div className="app-onboarding-options">
              {Object.entries(INDUSTRY_PACKS).map(([key, pack]) => (
                <button
                  key={key}
                  type="button"
                  className={`app-onboarding-option${packKey === key ? " app-onboarding-option--active" : ""}`}
                  onClick={() => setPackKey(key)}
                  disabled={!canManage && key !== "showEverything"}
                >
                  <span className="app-onboarding-option__title">{pack.label}</span>
                  <span className="app-onboarding-option__hint">{pack.hint}</span>
                </button>
              ))}
            </div>
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(0)}>
                Back
              </button>
              <button type="button" className="app-onboarding-primary" onClick={() => void applyPackAndNext()} disabled={busy}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "shortcut" ? (
          <>
            <h2 className="app-onboarding-title">Pin a module to the bottom bar</h2>
            <p className="app-onboarding-lead">
              Replace the default <strong>Bin</strong> slot with your most-used register — one tap from any screen.
            </p>
            {canManage ? (
              <label className="app-onboarding-field">
                <span>Bottom bar shortcut</span>
                <select value={shortcutId} onChange={(e) => setShortcutId(e.target.value)}>
                  <option value="">Bin (default)</option>
                  {shortcutOptions.map((id) => (
                    <option key={id} value={id}>
                      {getModuleLabel(id)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="app-onboarding-note">Admins can set this in Settings → Organisation → Modules.</p>
            )}
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(1)}>
                Back
              </button>
              <button type="button" className="app-onboarding-primary" onClick={saveShortcutAndNext}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <div className="app-onboarding-icon app-onboarding-icon--success" aria-hidden>
              <CheckCircle2 size={32} strokeWidth={2} />
            </div>
            <h2 className="app-onboarding-title">You&apos;re ready</h2>
            <p className="app-onboarding-lead">Your workspace is tailored. Complete these when you have a moment:</p>
            <ul className="app-onboarding-checklist">
              <li>
                <button type="button" onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
                  Add logo & company details
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "people" })}>
                  Add people to your team
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "projects" })}>
                  Add your first project
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "rams" })}>
                  Create your first RAMS
                </button>
              </li>
            </ul>
            <button type="button" className="app-onboarding-primary" onClick={() => void finish()} disabled={busy}>
              Open dashboard
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
