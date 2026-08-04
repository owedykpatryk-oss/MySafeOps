import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useToast } from "../context/ToastContext";
import { pushAudit } from "../utils/auditLog";
import { pushOrgBrandingToCloud } from "../utils/orgBrandingCloudSync";
import {
  applyIndustryPack,
  getAppliedIndustryPackId,
  getWorkspacePack,
  getWorkspacePackLabel,
  INDUSTRY_PACKS,
  isValidIndustryPackId,
} from "../utils/orgIndustryPacks";
import {
  createCustomWorkspaceProfile,
  deleteCustomWorkspaceProfile,
  duplicateCustomWorkspaceProfile,
  isCustomWorkspacePackId,
  listWorkspaceProfilesForOrg,
} from "../utils/customWorkspaceProfiles";
import CustomProfileEditor from "./CustomProfileEditor";
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
import { getSeedModulesPreviewForPack } from "../utils/industryPackSeeds";
import { getRamsStarterLabel } from "../utils/ramsIndustryStarters";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "../utils/orgSettingsStorage";
import { resetOnboardingWizard } from "../utils/workspaceOnboarding";
import { openWorkspaceView } from "../utils/workspaceNavContext";
import { getOrgMarketId } from "../utils/orgMarket";
import { getRamsShortLabel, localizeIndustryTerminology } from "../utils/marketLabels";
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
  const [customLabel, setCustomLabel] = useState("");
  const [customBasedOn, setCustomBasedOn] = useState("generalContractor");
  const [profileList, setProfileList] = useState(() => listWorkspaceProfilesForOrg());
  const marketId = getOrgMarketId();
  const ramsLabel = getRamsShortLabel(marketId);
  const loc = (text) => localizeIndustryTerminology(text, marketId);

  const refreshProfiles = () => setProfileList(listWorkspaceProfilesForOrg());

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
  const seedPreview = getSeedModulesPreviewForPack(draftId);
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
      pushToast(`Workspace profile set to ${getWorkspacePackLabel(draftId)}${seedMsg}`, "success");
      setPreviewActive(false);
    } finally {
      setBusy(false);
    }
  };

  const previewHub = () => {
    if (!isValidIndustryPackId(draftId)) return;
    setIndustryPackPreview(draftId);
    setPreviewActive(true);
    pushToast(`Previewing ${getWorkspacePackLabel(draftId)} in Project Hub (session only)`, "info");
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
        Choose a built-in profile or save your own — custom profiles stay private to your organisation and are never shared with other companies. Modules, Project Hub pipeline, playbooks, readiness gates, site pack PDFs, and RAMS hazard starters adjust automatically.
        Existing records are never deleted when you switch. Open <button type="button" className="app-org-profile__help-link" onClick={() => openWorkspaceView({ viewId: "help" })}>Help → Workspace profiles</button> for the full catalogue.
      </p>

      {previewActive && previewId ? (
        <div className="app-org-profile__preview-banner" role="status">
          <strong>Preview mode:</strong> Project Hub shows <em>{getWorkspacePackLabel(previewId)}</em> readiness and copy.
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
        {profileList.map((pack) => (
          <button
            key={pack.id}
            type="button"
            className={`app-onboarding-option${draftId === pack.id ? " app-onboarding-option--active" : ""}`}
            onClick={() => setDraftId(pack.id)}
            disabled={!canManage}
          >
            <span className="app-onboarding-option__title">
              {pack.label}
              {pack.custom ? <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>· Custom</span> : null}
            </span>
            <span className="app-onboarding-option__hint">{loc(pack.hint)}</span>
            {appliedId === pack.id ? (
              <span className="app-org-profile__applied">Current profile</span>
            ) : null}
            {canManage && pack.custom ? (
              <span style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize: 11, padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      const copy = duplicateCustomWorkspaceProfile(pack.id);
                      refreshProfiles();
                      setDraftId(copy.id);
                      void syncCloud();
                      pushToast(`Duplicated as "${copy.label}"`, "success");
                    } catch (err) {
                      pushToast(err?.message || "Could not duplicate", "error");
                    }
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  style={{ ...ss.btn, fontSize: 11, padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete custom profile "${pack.label}"?`)) {
                      deleteCustomWorkspaceProfile(pack.id);
                      refreshProfiles();
                      if (draftId === pack.id) setDraftId(appliedId);
                      void syncCloud();
                      pushToast("Custom profile deleted", "info");
                    }
                  }}
                >
                  Delete
                </button>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {dirty && preview.changes.length ? (
        <div className="app-org-profile__preview" role="status">
          <p className="app-org-profile__preview-title">If you apply {preview.label}</p>
          <ul className="app-org-profile__preview-list">
            {preview.changes.map((line) => (
              <li key={line}>{loc(line)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="app-org-profile__workflow">
        <p className="app-org-profile__workflow-title">Typical workflow</p>
        <p className="app-org-profile__workflow-summary">{loc(workflowHelp.summary)}</p>
        {getWorkspacePack(draftId)?.ramsStarterKey !== null ? (
          <p className="app-org-profile__workflow-summary" style={{ marginTop: 8 }}>
            {ramsLabel} builder starter: <strong>{getRamsStarterLabel(getWorkspacePack(draftId)?.ramsStarterKey || "general")}</strong>
          </p>
        ) : null}
        <ol className="app-org-profile__workflow-steps">
          {workflowHelp.steps.map((step) => (
            <li key={step}>{loc(step)}</li>
          ))}
        </ol>
      </div>

      {!dirty && getPackHighlights(appliedId).length ? (
        <ul className="app-org-profile__highlights">
          {getPackHighlights(appliedId).map((line) => (
            <li key={line}>{loc(line)}</li>
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

      {canManage && isCustomWorkspacePackId(draftId) ? (
        <CustomProfileEditor profileId={draftId} onSaved={refreshProfiles} onSyncCloud={syncCloud} />
      ) : null}

      {canManage ? (
        <div style={{ ...ss.card, marginTop: 20, padding: 16 }}>
          <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Save your own profile</p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Create a private workspace profile for your organisation. Other companies cannot see or use profiles you save here.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <label style={{ flex: "1 1 200px", fontSize: 13 }}>
              Profile name
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Our civils + survey mix"
                style={{ ...ss.inp, marginTop: 4, width: "100%" }}
              />
            </label>
            <label style={{ flex: "1 1 180px", fontSize: 13 }}>
              Based on
              <select
                value={customBasedOn}
                onChange={(e) => setCustomBasedOn(e.target.value)}
                style={{ ...ss.inp, marginTop: 4, width: "100%" }}
              >
                {Object.entries(INDUSTRY_PACKS).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              style={ss.btnP}
              disabled={!customLabel.trim()}
              onClick={() => {
                try {
                  const created = createCustomWorkspaceProfile({
                    label: customLabel.trim(),
                    basedOn: customBasedOn,
                  });
                  refreshProfiles();
                  setDraftId(created.id);
                  setCustomLabel("");
                  void syncCloud();
                  pushToast(`Custom profile "${created.label}" saved`, "success");
                } catch (e) {
                  pushToast(e?.message || "Could not save profile", "error");
                }
              }}
            >
              Save custom profile
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
