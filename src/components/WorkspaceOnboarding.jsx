import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Sparkles, X } from "lucide-react";
import ConfettiCelebration from "./ConfettiCelebration";import { useApp } from "../context/AppContext";
import { useOrgBranding } from "../hooks/useOrgBranding";
import { getModuleLabel } from "../utils/hiddenModules";
import {
  getBottomNavModuleId,
  getBottomNavShortcutOptions,
  setBottomNavModuleId,
} from "../utils/bottomNavShortcut";
import { applyIndustryPack } from "../utils/orgIndustryPacks";
import { listWorkspaceProfilesForOrg } from "../utils/customWorkspaceProfiles";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { markOnboardingComplete } from "../utils/workspaceOnboarding";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { getOrgMarketId } from "../utils/orgMarket";
import { getOnboardingCopy } from "../data/appUiCopy";
import { getRamsShortLabel, localizeIndustryTerminology } from "../utils/marketLabels";

const STEPS = ["welcome", "profile", "shortcut", "done"];

/**
 * First-run wizard for any organisation — industry pack, bottom-bar shortcut, quick links.
 */
export default function WorkspaceOnboarding({ onComplete }) {
  const { caps, trialStatus } = useApp();
  const { supabase } = useSupabaseAuth();
  const branding = useOrgBranding();
  const [stepIndex, setStepIndex] = useState(0);
  const [packKey, setPackKey] = useState(() => {
    const id = loadOrgSettingsRaw().industryPackId;
    const profiles = listWorkspaceProfilesForOrg();
    if (id && profiles.some((p) => p.id === id)) return id;
    return trialStatus?.isActive ? "showEverything" : "generalContractor";
  });
  const [shortcutId, setShortcutId] = useState(() => getBottomNavModuleId() || "");
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const step = STEPS[stepIndex];
  const canManage = Boolean(caps?.orgSettings);
  const shortcutOptions = useMemo(() => getBottomNavShortcutOptions(), []);
  const marketId = getOrgMarketId();
  const ramsLabel = getRamsShortLabel(marketId);
  const t = (key, ...args) => getOnboardingCopy(key, marketId, ...args);
  const loc = (text) => localizeIndustryTerminology(text, marketId);

  useEffect(() => {
    if (step === "done") setCelebrate(true);
  }, [step]);

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
    if (canManage && packKey) applyIndustryPack(packKey, { seedTemplates: true });
    await syncCloud();
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const saveShortcutAndNext = () => {
    if (canManage) setBottomNavModuleId(shortcutId || null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  return (
    <div className="app-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="app-onboarding-title">
      <ConfettiCelebration active={celebrate} label="Workspace ready" onDone={() => setCelebrate(false)} />
      <div className="app-onboarding-panel app-panel-surface">
        <div className="app-onboarding-progress" aria-hidden>
          {STEPS.map((id, i) => (
            <span
              key={id}
              className={`app-onboarding-progress__dot${i <= stepIndex ? " app-onboarding-progress__dot--done" : ""}${i === stepIndex ? " app-onboarding-progress__dot--active" : ""}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="app-onboarding-close"
          aria-label={t("skipAria") || "Skip setup for now"}
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
              {t("welcomeTitle") || "Welcome to MySafeOps"}
            </h2>
            <p className="app-onboarding-lead" dangerouslySetInnerHTML={{ __html: t("welcomeLead", branding.displayName) || `Set up <strong>${branding.displayName}</strong> in under a minute. Your workspace profile controls which modules appear, how Project Hub scores readiness, and which RAMS hazard starter is suggested — you can change it anytime in Settings.` }} />
            <button type="button" className="app-onboarding-primary" onClick={() => setStepIndex(1)}>
              {t("getStarted") || "Get started"}
              <ChevronRight size={18} aria-hidden />
            </button>
          </>
        ) : null}

        {step === "profile" ? (
          <>
            <h2 className="app-onboarding-title">{t("profileTitle") || "Choose your workspace profile"}</h2>
            <p className="app-onboarding-lead">
              {t("profileLead") || "Pick the option closest to your trade. This shows relevant registers in More, sets Project Hub gates, and suggests a RAMS starter — nothing is deleted if you switch later."}
            </p>
            <p className="app-onboarding-note">
              {t("profileNote") || "Starter rows can be added to empty registers on continue. Full guide: Help (<kbd>?</kbd>) → Workspace profiles."}
            </p>
            {!canManage ? (
              <p className="app-onboarding-note">{t("profileAdminNote") || "Ask an organisation admin to apply a profile, or continue with the default layout."}</p>
            ) : null}
            <div className="app-onboarding-options">
              {listWorkspaceProfilesForOrg().map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={`app-onboarding-option${packKey === pack.id ? " app-onboarding-option--active" : ""}`}
                  onClick={() => setPackKey(pack.id)}
                  disabled={!canManage && pack.id !== "showEverything"}
                >
                  <span className="app-onboarding-option__title">{pack.label}</span>
                  <span className="app-onboarding-option__hint">{loc(pack.hint)}</span>
                </button>
              ))}
            </div>
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(0)}>
                {t("back") || "Back"}
              </button>
              <button type="button" className="app-onboarding-primary" onClick={() => void applyPackAndNext()} disabled={busy}>
                {t("continue") || "Continue"}
              </button>
            </div>
          </>
        ) : null}

        {step === "shortcut" ? (
          <>
            <h2 className="app-onboarding-title">{t("shortcutTitle") || "Pin a module to the bottom bar"}</h2>
            <p className="app-onboarding-lead" dangerouslySetInnerHTML={{ __html: t("shortcutLead") || "Replace the default <strong>Bin</strong> slot with your most-used register — one tap from any screen." }} />
            {canManage ? (
              <label className="app-onboarding-field">
                <span>{t("shortcutLabel") || "Bottom bar shortcut"}</span>
                <select value={shortcutId} onChange={(e) => setShortcutId(e.target.value)}>
                  <option value="">{t("shortcutDefault") || "Bin (default)"}</option>
                  {shortcutOptions.map((id) => (
                    <option key={id} value={id}>
                      {getModuleLabel(id)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="app-onboarding-note">{t("shortcutAdminNote") || "Admins can set this in Settings → Organisation → Modules."}</p>
            )}
            <div className="app-onboarding-footer">
              <button type="button" className="app-onboarding-secondary" onClick={() => setStepIndex(1)}>
                {t("back") || "Back"}
              </button>
              <button type="button" className="app-onboarding-primary" onClick={saveShortcutAndNext}>
                {t("continue") || "Continue"}
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <div className="app-onboarding-icon app-onboarding-icon--success" aria-hidden>
              <CheckCircle2 size={32} strokeWidth={2} />
            </div>
            <h2 className="app-onboarding-title">{t("doneTitle") || "You're ready"}</h2>
            <p className="app-onboarding-lead">{t("doneLead") || "Your workspace is tailored. Complete these when you have a moment:"}</p>
            <ul className="app-onboarding-checklist">
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "help" })}>
                  {t("checklistHelp") || "Read the workspace profile guide (Help)"}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
                  {t("checklistBranding") || "Add logo & company details"}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "people" })}>
                  {t("checklistPeople") || "Add people to your team"}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "projects" })}>
                  {t("checklistProject") || "Add your first project"}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWorkspaceView({ viewId: "rams" })}>
                  {(t("checklistRams") || "Create your first RAMS").replace("RAMS", ramsLabel)}
                </button>
              </li>
            </ul>
            <button type="button" className="app-onboarding-primary" onClick={() => void finish()} disabled={busy}>
              {t("openDashboard") || "Open dashboard"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
