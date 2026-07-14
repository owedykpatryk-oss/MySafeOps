/**
 * Role-agnostic next steps for People / compliance hub.
 */
import { evaluateWorkerPermitEligibility } from "./certifications.js";

function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / 86400000);
}

export function buildPeopleNextSteps({
  workers = [],
  certAlerts = [],
  equipmentAlerts = [],
  vehicleAlerts = [],
  trainingRecords = [],
  projects = [],
  ptwPermitType = "hot_work",
} = {}) {
  const steps = [];
  const criticalCerts = certAlerts.filter((a) => a.severity === "expired" || a.severity === "critical");
  const warnCerts = certAlerts.filter((a) => a.severity === "warning");
  const equipOverdue = equipmentAlerts.filter((a) => a.severity === "expired");
  const equipCritical = equipmentAlerts.filter((a) => a.severity === "critical");
  const vehicleOverdue = vehicleAlerts.filter((a) => a.severity === "expired");
  const vehicleCritical = vehicleAlerts.filter((a) => a.severity === "critical");
  const unassigned = workers.filter((w) => !Array.isArray(w.projectIds) || w.projectIds.length === 0);
  const trainingOverdue = trainingRecords.filter((r) => r.expiryDate && daysUntil(r.expiryDate) < 0);
  const trainingDueSoon = trainingRecords.filter((r) => {
    const d = daysUntil(r.expiryDate);
    return r.expiryDate && d >= 0 && d <= 30;
  });
  const ptwBlocked = workers.filter((w) => !evaluateWorkerPermitEligibility(w, ptwPermitType).eligible);

  if (workers.length === 0) {
    steps.push({
      id: "add_worker",
      title: "Add your first operative",
      detail: "Capture name, role, and certifications before work starts on site.",
      action: "add_worker",
      tone: "accent",
    });
  }

  if (criticalCerts.length > 0) {
    steps.push({
      id: "certs_critical",
      title: `${criticalCerts.length} certificate${criticalCerts.length === 1 ? "" : "s"} expired or due within 7 days`,
      detail: "Update expiry dates or remove operatives from high-risk permits until renewed.",
      action: "scroll_certs",
      tone: "critical",
    });
  } else if (warnCerts.length > 0) {
    steps.push({
      id: "certs_warn",
      title: `${warnCerts.length} certificate${warnCerts.length === 1 ? "" : "s"} expiring within 30 days`,
      detail: "Book refresher training before CSCS/IPAF and similar tickets lapse.",
      action: "scroll_certs",
      tone: "warn",
    });
  }

  if (equipOverdue.length > 0) {
    steps.push({
      id: "equip_overdue",
      title: `${equipOverdue.length} equipment inspection${equipOverdue.length === 1 ? "" : "s"} overdue`,
      detail: "LOLER, PAT, or plant checks are past due — open Inspections or Plant register.",
      action: "open_inspections",
      tone: "critical",
    });
  } else if (equipCritical.length > 0) {
    steps.push({
      id: "equip_due",
      title: `${equipCritical.length} inspection${equipCritical.length === 1 ? "" : "s"} due within 7 days`,
      detail: "Schedule LOLER/PAT/plant checks before equipment is used on site.",
      action: "open_plant",
      tone: "warn",
    });
  }

  if (vehicleOverdue.length > 0) {
    steps.push({
      id: "vehicle_overdue",
      title: `${vehicleOverdue.length} fleet compliance date${vehicleOverdue.length === 1 ? "" : "s"} overdue`,
      detail: "MOT, insurance or service is past due — open Fleet & vehicles before deploying.",
      action: "open_vehicles",
      tone: "critical",
    });
  } else if (vehicleCritical.length > 0) {
    steps.push({
      id: "vehicle_due",
      title: `${vehicleCritical.length} fleet date${vehicleCritical.length === 1 ? "" : "s"} due within 7 days`,
      detail: "Renew MOT, insurance or schedule service before the vehicle is used on site.",
      action: "open_vehicles",
      tone: "warn",
    });
  }

  if (trainingOverdue.length > 0) {
    steps.push({
      id: "training_overdue",
      title: `${trainingOverdue.length} training record${trainingOverdue.length === 1 ? "" : "s"} overdue`,
      detail: "Refresh competence records or update worker certificates in People.",
      action: "open_training",
      tone: "critical",
    });
  } else if (trainingDueSoon.length > 0) {
    steps.push({
      id: "training_due",
      title: `${trainingDueSoon.length} training refresh${trainingDueSoon.length === 1 ? "" : "es"} due within 30 days`,
      detail: "Book refresher courses before tickets lapse on the training matrix.",
      action: "open_training",
      tone: "warn",
    });
  }

  if (workers.length > 0 && ptwBlocked.length > 0) {
    steps.push({
      id: "ptw_blocked",
      title: `${ptwBlocked.length} operative${ptwBlocked.length === 1 ? "" : "s"} blocked from hot work PTW`,
      detail: "Update CSCS, fire watch, or other required tickets before issuing permits.",
      action: "scroll_people",
      tone: "warn",
    });
  }

  if (workers.length > 0 && projects.length > 0 && unassigned.length > 0) {
    steps.push({
      id: "assign_projects",
      title: `${unassigned.length} operative${unassigned.length === 1 ? "" : "s"} not assigned to a project`,
      detail: "Link people to sites so RAMS, PTW, and client portal show the right team.",
      action: "scroll_people",
      tone: "accent",
    });
  }

  if (workers.length > 0 && steps.length < 3) {
    steps.push({
      id: "review_certs",
      title: "Review certification matrix",
      detail: "Open a person to tick CSCS, IPAF, confined space, and other tickets with expiry dates.",
      action: "scroll_people",
      tone: "ok",
    });
  }

  const seen = new Set();
  return steps
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, 3);
}
