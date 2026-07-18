/**
 * FESS Group — one-tap "Today on site" mobilisation flow (org-exclusive).
 */
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { ensureFessSiteProject, getFessClientSiteTemplate } from "./fessClientSites";
import { seedFessSiteMobilisation } from "./fessSiteMobilisation";
import { seedFessSiteBriefing } from "./fessBriefingRecord";
import { openWorkspaceView, setWorkspaceNavTarget } from "./workspaceNavContext";
import { openFessSiteLineClearance } from "./fessClientHub";

/**
 * Mobilise registers + today's briefing, then jump to the most useful next screen.
 * @param {string} siteTemplateId
 * @param {{ openPhotos?: boolean }} [opts]
 */
export function runFessTodayOnSite(siteTemplateId, opts = {}) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "Today on site is only available for FESS Group workspace." };
  }
  const template = getFessClientSiteTemplate(siteTemplateId);
  if (!template) {
    return { ok: false, message: "Unknown FESS site template." };
  }

  const mobilise = seedFessSiteMobilisation(siteTemplateId);
  const briefing = seedFessSiteBriefing(siteTemplateId);
  const project = ensureFessSiteProject(siteTemplateId);
  const siteLabel = template.location || template.site || "site";

  if (opts.openPhotos) {
    setWorkspaceNavTarget({ viewId: "geo-photos", projectId: project?.id });
    openWorkspaceView({ viewId: "geo-photos" });
    return {
      ok: true,
      siteTemplateId,
      projectId: project?.id,
      message: `${siteLabel}: mobilised + briefing ready. Capture entrance / zone photos for induction or site instructions.`,
      opened: "geo-photos",
      mobilise,
      briefing,
    };
  }

  if (briefing.ok && briefing.briefing?.id) {
    setWorkspaceNavTarget({
      viewId: "daily-briefing",
      projectId: project?.id,
      briefingId: briefing.briefing.id,
    });
    openWorkspaceView({ viewId: "daily-briefing" });
    return {
      ok: true,
      siteTemplateId,
      projectId: project?.id,
      message: `${siteLabel}: today ready — G&HP/LOTO/contacts + briefing. Use Photos for site routes if needed.`,
      opened: "daily-briefing",
      mobilise,
      briefing,
    };
  }

  openFessSiteLineClearance(siteTemplateId);
  return {
    ok: Boolean(mobilise?.ok || briefing?.ok),
    siteTemplateId,
    projectId: project?.id,
    message: mobilise?.message || briefing?.message || `${siteLabel}: today on site started.`,
    opened: "permits",
    mobilise,
    briefing,
  };
}
