/**
 * FESS Group — briefing record with operative certifications (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { ensureFessSiteProject } from "./fessClientSites";
import { getFessJobStarter } from "./fessJobStarters";
import { normalizeWorkerCertifications, getWorkerCertAlerts, certLabel } from "./certifications";

const genId = () => `brief_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

export const FESS_FOOD_FACTORY_BRIEFING_TOPICS = [
  "Line clearance / production isolation confirmed with site permit controller",
  "RAMS and method statement reviewed — job ref and scope understood",
  "Hygiene, foreign-body and G&HP controls for production zones",
  "LOTO and permit conditions before intrusive work on live plant",
  "Emergency arrangements, muster point and nearest A&E confirmed",
  "COSHH substances on site — SDS available before use",
  "PPE for food factory M&E (hard hat, safety footwear, hi-vis, task PPE)",
  "Stop-work authority — report hazards to FESS supervisor immediately",
];

/**
 * @param {object} form MS or briefing context
 * @param {object[]} [workers]
 * @returns {Array<{ name: string, certs: string, certExpiry: string, certAlert: string }>}
 */
export function buildFessBriefingOperativeRows(form, workers = []) {
  if (!canUseFessExclusiveFeatures()) return [];

  const list = Array.isArray(workers) ? workers : [];
  const ids = Array.isArray(form?.operativeIds) ? form.operativeIds : [];
  const projectId = String(form?.projectId || "").trim();

  const selected = ids.length
    ? list.filter((w) => ids.includes(w.id))
    : projectId
      ? list.filter((w) => (w.projectIds || []).includes(projectId))
      : list;

  const source = selected.length ? selected : list.slice(0, 12);

  return source.map((w) => {
    const certs = normalizeWorkerCertifications(w);
    const keyCerts =
      certs
        .slice(0, 4)
        .map((c) => c.certType)
        .join(" · ") || String(w.certs || "").trim() || "—";
    const withExpiry = certs.filter((c) => c.expiryDate);
    const nearest = withExpiry.sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)))[0];
    const alerts = getWorkerCertAlerts(w);
    const topAlert = alerts[0];
    let certAlert = "";
    if (topAlert) {
      certAlert =
        topAlert.days < 0
          ? `${topAlert.cert.certType} expired`
          : `${topAlert.cert.certType} ${topAlert.days}d`;
    }
    return {
      name: w.name || "—",
      certs: keyCerts,
      certExpiry: nearest?.expiryDate || "—",
      certAlert,
    };
  });
}

/**
 * Seed today's mobilisation briefing for a FESS site (idempotent per site/day).
 * @param {string} siteTemplateId
 */
export function seedFessSiteBriefing(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, message: "FESS briefings are only available for FESS Group workspace." };
  }

  const project = ensureFessSiteProject(siteTemplateId);
  if (!project) return { ok: false, message: "Site project not found." };

  const today = todayIso();
  const briefings = Array.isArray(load("daily_briefings", [])) ? [...load("daily_briefings", [])] : [];
  const existing = briefings.find(
    (b) => b.projectId === project.id && String(b.date || "").slice(0, 10) === today && b.fessSiteTemplateId === siteTemplateId
  );
  if (existing) {
    return { ok: true, created: false, briefing: existing, message: "Today's FESS site briefing already exists." };
  }

  const workers = load("mysafeops_workers", []);
  const projectWorkers = workers.filter((w) => (w.projectIds || []).includes(project.id));
  const starter = getFessJobStarter(project.fessSuggestedJobStarterKey);
  const jobLabel = starter?.label || "Food factory M&E works";

  const briefing = {
    id: genId(),
    date: today,
    time: new Date().toISOString(),
    projectId: project.id,
    projectName: project.name,
    site: project.site || project.location || "",
    weather: "",
    scope: `FESS mobilisation — ${jobLabel} at ${project.client || project.name}`,
    topics: [...FESS_FOOD_FACTORY_BRIEFING_TOPICS],
    hazards: ["Production line proximity", "Hygiene / foreign-body", "Live services isolation"],
    notes: "Pre-start briefing — RAMS, method statement and permit sign-off confirmed with site permit controller.",
    attendees: (projectWorkers.length ? projectWorkers : workers.slice(0, 6)).map((w) => ({
      id: w.id,
      name: w.name || "",
      role: w.role || "",
      present: false,
      sig: null,
    })),
    fessSiteTemplateId: siteTemplateId,
    fessBriefingPreset: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  briefings.unshift(briefing);
  save("daily_briefings", briefings);

  return {
    ok: true,
    created: true,
    briefing,
    message: `Today's briefing created for ${project.name} — collect attendance on site.`,
  };
}

/** Expiring certs for workers on FESS site projects. */
export function getFessSiteCertAlerts(workers = [], projects = []) {
  if (!canUseFessExclusiveFeatures()) return [];
  const fessProjectIds = new Set(
    (Array.isArray(projects) ? projects : [])
      .filter((p) => p.fessSiteTemplateId)
      .map((p) => p.id)
  );
  if (!fessProjectIds.size) return [];

  const alerts = [];
  for (const w of Array.isArray(workers) ? workers : []) {
    if (!(w.projectIds || []).some((id) => fessProjectIds.has(id))) continue;
    for (const a of getWorkerCertAlerts(w)) {
      if (a.days > 30) continue;
      alerts.push({
        workerName: w.name,
        certType: a.cert.certType || certLabel(a.cert.certCode),
        days: a.days,
        severity: a.severity,
        projectId: (w.projectIds || []).find((id) => fessProjectIds.has(id)),
      });
    }
  }
  return alerts.sort((a, b) => a.days - b.days).slice(0, 8);
}
