import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import { pushAudit } from "../utils/auditLog";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import {
  applyIndustryPack,
  getAppliedIndustryPackId,
  INDUSTRY_PACKS,
  isValidIndustryPackId,
} from "../utils/orgIndustryPacks";
import {
  previewPackSwitch,
  getPackHighlights,
  getPackWorkflowHelp,
} from "../utils/industryPackProfile";
import {
  clearIndustryPackPreview,
  getIndustryPackPreviewId,
  INDUSTRY_PREVIEW_UPDATED_EVENT,
  isIndustryPackPreviewActive,
  setIndustryPackPreview,
} from "../utils/industryPackPreview";
import { SEED_MODULES_BY_PACK } from "../utils/industryPackSeeds";
import { getRamsStarterLabel } from "../utils/ramsIndustryStarters";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { resetOnboardingWizard } from "../utils/workspaceOnboarding";
import { openWorkspaceView } from "../utils/workspaceNavContext";
import { ms } from "../utils/moduleStyles";

const ss = ms;

/**
 * Workspace profile picker — same options as onboarding, with switch preview.
 */
export default function OrgWorkspaceProfile() {
  const { caps } = useApp();
  const { supabase } = useSupabaseAuth();
  const { pushToast } = useToast();
  const canManage = Boolean(caps?.orgSettings);

  const [appliedId, setAppliedId] = useState(() => getAppliedIndustryPackId() || "generalContractor");
  const [draftId, setDraftId] = useState(() => getAppliedIndustryPackId() || "generalContractor");
  const [seedTemplates, setSeedTemplates] = useState(true);
  const [previewActive, setPreviewActive] = useState(() => isIndustryPackPreviewActive());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const id = getAppliedIndustryPackId() || "generalContractor";
      setAppliedId(id);
      if (!isIndustryPackPreviewActive()) setDraftId(id);
      setPreviewActive(isIndustryPackPreviewActive());
    };
    window.addEventListener("mysafeops-hidden-modules-updated", refresh);
    window.addEventListener("mysafeops-org-settings-updated", refresh);
    window.addEventListener(INDUSTRY_PREVIEW_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("mysafeops-hidden-modules-updated", refresh);
      window.removeEventListener("mysafeops-org-settings-updated", refresh);
      window.removeEventListener(INDUSTRY_PREVIEW_UPDATED_EVENT, refresh);
    };
  }, []);

  const preview = useMemo(() => previewPackSwitch(appliedId, draftId), [appliedId, draftId]);
  const workflowHelp = useMemo(() => getPackWorkflowHelp(draftId), [draftId]);
  const seedPreview = SEED_MODULES_BY_PACK[draftId] || [];
  const dirty = draftId !== appliedId;
  const previewId = getIndustryPackPreviewId();

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

  const applyPack = async () => {
    if (!canManage || !dirty || !isValidIndustryPackId(draftId)) return;
    setBusy(true);
    try {
      const { seeded } = applyIndustryPack(draftId, { seedTemplates });
      setAppliedId(draftId);
      pushAudit({
        action: "org_industry_pack_apply",
        entity: "mysafeops_org_settings",
        detail: `${appliedId} → ${draftId}${seeded.length ? ` · seeded ${seeded.length} register(s)` : ""}`,
      });
      await syncCloud();
      const seedMsg = seeded.length ? ` · ${seeded.length} starter row(s) added` : "";
      pushToast(`Workspace profile set to ${INDUSTRY_PACKS[draftId]?.label || draftId}${seedMsg}`, "success");
      setPreviewActive(false);
    } finally {
      setBusy(false);
    }
  };

  const previewHub = () => {
    if (!isValidIndustryPackId(draftId)) return;
    setIndustryPackPreview(draftId);
    setPreviewActive(true);
    pushToast(`Previewing ${INDUSTRY_PACKS[draftId]?.label} in Project Hub (session only)`, "info");
    openWorkspaceView({ viewId: "projects" });
  };

  const exitPreview = () => {
    clearIndustryPackPreview();
    setPreviewActive(false);
    setDraftId(appliedId);
    pushToast("Profile preview cleared", "info");
  };

  const rerunOnboarding = () => {
    if (!canManage) return;
    resetOnboardingWizard();
    pushToast("Setup wizard will appear on next refresh", "info");
    window.location.reload();
  };

  return (
    <div className="app-org-profile">
      <p className="app-org-profile__lead">
        Choose a profile that matches your work — modules, Project Hub pipeline, playbooks, readiness gates, site pack PDFs, and RAMS hazard starters adjust automatically.
        Existing records are never deleted when you switch. Open <button type="button" className="app-org-profile__help-link" onClick={() => openWorkspaceView({ viewId: "help" })}>Help → Workspace profiles</button> for the full catalogue.
      </p>

      {previewActive && previewId ? (
        <div className="app-org-profile__preview-banner" role="status">
          <strong>Preview mode:</strong> Project Hub shows <em>{INDUSTRY_PACKS[previewId]?.label}</em> readiness and copy.
          Module layout updates when you click Apply.
          <button type="button" className="app-org-profile__preview-exit" onClick={exitPreview}>
            Exit preview
          </button>
        </div>
      ) : null}

      {!canManage ? (
        <p className="app-org-profile__note">Only organisation admins can change the workspace profile.</p>
      ) : null}

      <div className="app-onboarding-options app-org-profile__options">
        {Object.entries(INDUSTRY_PACKS).map(([key, pack]) => (
          <button
            key={key}
            type="button"
            className={`app-onboarding-option${draftId === key ? " app-onboarding-option--active" : ""}`}
            onClick={() => setDraftId(key)}
            disabled={!canManage}
          >
            <span className="app-onboarding-option__title">{pack.label}</span>
            <span className="app-onboarding-option__hint">{pack.hint}</span>
            {appliedId === key ? (
              <span className="app-org-profile__applied">Current profile</span>
            ) : null}
          </button>
        ))}
      </div>

      {dirty && preview.changes.length ? (
        <div className="app-org-profile__preview" role="status">
          <p className="app-org-profile__preview-title">If you apply {preview.label}</p>
          <ul className="app-org-profile__preview-list">
            {preview.changes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="app-org-profile__workflow">
        <p className="app-org-profile__workflow-title">Typical workflow</p>
        <p className="app-org-profile__workflow-summary">{workflowHelp.summary}</p>
        {INDUSTRY_PACKS[draftId]?.ramsStarterKey !== null ? (
          <p className="app-org-profile__workflow-summary" style={{ marginTop: 8 }}>
            RAMS builder starter: <strong>{getRamsStarterLabel(INDUSTRY_PACKS[draftId]?.ramsStarterKey || "general")}</strong>
          </p>
        ) : null}
        <ol className="app-org-profile__workflow-steps">
          {workflowHelp.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {!dirty && getPackHighlights(appliedId).length ? (
        <ul className="app-org-profile__highlights">
          {getPackHighlights(appliedId).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {canManage ? (
        <label className="app-org-profile__seed">
          <input
            type="checkbox"
            checked={seedTemplates}
            onChange={(e) => setSeedTemplates(e.target.checked)}
          />
          Seed empty registers with starter rows ({seedPreview.slice(0, 4).join(", ")}
          {seedPreview.length > 4 ? "…" : ""})
        </label>
      ) : null}

      <div className="app-org-profile__actions">
        <button
          type="button"
          style={ss.btnP}
          disabled={!canManage || !dirty || busy}
          onClick={() => void applyPack()}
        >
          {busy ? "Applying…" : dirty ? "Apply workspace profile" : "Profile up to date"}
        </button>
        <button type="button" style={ss.btn} disabled={!canManage} onClick={previewHub}>
          Preview in Project Hub
        </button>
        <button type="button" style={ss.btn} disabled={!canManage} onClick={rerunOnboarding}>
          Re-run setup wizard
        </button>
        <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "help" })}>
          Full guide in Help
        </button>
      </div>
    </div>
  );
}
