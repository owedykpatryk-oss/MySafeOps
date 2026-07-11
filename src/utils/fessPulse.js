/**
 * FESS Group — live workspace pulse for food factory M&E ops (org-exclusive).
 */
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { getFessSiteCertAlerts } from "./fessBriefingRecord";
import { computeFessRamsCompleteness } from "./fessRamsCompleteness";
import { getFessPortalPublishStatus } from "./fessPortalPublish";

const ACTIVE_PERMIT = new Set(["active", "issued", "open"]);

function isActivePermit(p) {
  return ACTIVE_PERMIT.has(String(p?.status || "").toLowerCase());
}

function isIssuedRams(r) {
  const s = String(r?.status || "").toLowerCase();
  return s && s !== "draft";
}

/**
 * @param {object} [ctx]
 * @param {object[]} [ctx.projects]
 * @param {object[]} [ctx.rams]
 * @param {object[]} [ctx.permits]
 * @param {object[]} [ctx.methodStatements]
 * @param {object[]} [ctx.projects]
 */
export function buildFessWorkspacePulse(ctx = {}) {
  if (!canUseFessExclusiveFeatures()) {
    return { items: [], counts: {} };
  }

  const projects = Array.isArray(ctx.projects) ? ctx.projects : [];
  const rams = Array.isArray(ctx.rams) ? ctx.rams : [];
  const permits = Array.isArray(ctx.permits) ? ctx.permits : [];
  const methodStatements = Array.isArray(ctx.methodStatements) ? ctx.methodStatements : [];

  const draftRams = rams.filter((r) => String(r.status || "draft").toLowerCase() === "draft");
  const incompleteDraftRams = draftRams.filter((r) => {
    const result = computeFessRamsCompleteness(r, r.rows || []);
    return result && result.score < 85;
  });
  const issuedRams = rams.filter(isIssuedRams);
  const awaitingClientApproval = issuedRams.filter((r) => !r.clientApproval?.at);
  const missingPermitController = issuedRams.filter(
    (r) => !String(r.permitControllerName || "").trim()
  );
  const ramsWithoutMs = issuedRams.filter((r) => {
    if (!r.projectId) return false;
    return !methodStatements.some(
      (ms) => ms.projectId === r.projectId && (ms.relatedRamsId === r.id || !ms.relatedRamsId)
    );
  });

  const activePermits = permits.filter(isActivePermit);
  const lineClearanceOpen = activePermits.filter(
    (p) => p.permitType === "line_clearance" || p.type === "line_clearance"
  );
  const draftPermits = permits.filter((p) => String(p.status || "").toLowerCase() === "draft");
  const portalPublish = getFessPortalPublishStatus();
  const certAlerts = getFessSiteCertAlerts(ctx.workers || [], projects);

  /** @type {Array<{ key: string, label: string, detail?: string, severity: 'urgent'|'warn'|'info', viewId: string, projectId?: string }>} */
  const items = [];

  if (lineClearanceOpen.length) {
    items.push({
      key: "line_clearance",
      label: `${lineClearanceOpen.length} line clearance PTW open`,
      detail: "Confirm production isolation before intrusive work.",
      severity: "urgent",
      viewId: "permits",
    });
  }

  if (awaitingClientApproval.length) {
    items.push({
      key: "client_approval",
      label: `${awaitingClientApproval.length} RAMS awaiting site approval`,
      detail: "Share client portal link or collect permit controller sign-off.",
      severity: "warn",
      viewId: "client-portal",
    });
  }

  if (missingPermitController.length) {
    items.push({
      key: "permit_controller",
      label: `${missingPermitController.length} issued RAMS without permit controller`,
      detail: "Add site permit controller before handover.",
      severity: "warn",
      viewId: "rams",
    });
  }

  if (portalPublish.unpublished > 0) {
    items.push({
      key: "portal_unpublished",
      label: `${portalPublish.unpublished} site portal(s) not on cloud`,
      detail: "Publish so permit controllers can open RAMS approval links on any device.",
      severity: "warn",
      viewId: "client-portal",
    });
  }

  if (incompleteDraftRams.length) {
    items.push({
      key: "rams_incomplete",
      label: `${incompleteDraftRams.length} RAMS below completeness target`,
      detail: "Add missing baseline/job hazards before issue (target ≥85%).",
      severity: "warn",
      viewId: "rams",
    });
  }

  if (draftRams.length) {
    items.push({
      key: "draft_rams",
      label: `${draftRams.length} RAMS draft(s) on site`,
      detail: "Complete baseline rows and issue before work starts.",
      severity: "info",
      viewId: "rams",
    });
  }

  if (ramsWithoutMs.length) {
    items.push({
      key: "missing_ms",
      label: `${ramsWithoutMs.length} RAMS without method statement`,
      detail: "Link or create 5-page FESS method statement.",
      severity: "info",
      viewId: "method-statement",
    });
  }

  if (certAlerts.length) {
    const urgent = certAlerts.filter((a) => a.days < 0 || a.severity === "critical").length;
    items.push({
      key: "cert_expiry",
      label: `${certAlerts.length} operative cert(s) expiring on FESS sites`,
      detail: urgent
        ? `${urgent} expired or due within 7 days — check before line clearance.`
        : "Review food hygiene and trade certs before site mobilisation.",
      severity: urgent ? "urgent" : "warn",
      viewId: "people",
    });
  }

  if (draftPermits.length) {
    items.push({
      key: "draft_ptw",
      label: `${draftPermits.length} PTW draft(s) to issue`,
      severity: "info",
      viewId: "permits",
    });
  }

  return {
    items: items.slice(0, 8),
    counts: {
      incompleteDraftRams: incompleteDraftRams.length,
      unpublishedPortals: portalPublish.unpublished,
      draftRams: draftRams.length,
      awaitingClientApproval: awaitingClientApproval.length,
      lineClearanceOpen: lineClearanceOpen.length,
      activePermits: activePermits.length,
      missingPermitController: missingPermitController.length,
      certAlerts: certAlerts.length,
    },
  };
}
