import { normalizeWorkerCertifications } from "./certifications";
import { collectEquipmentInspectionDueItems } from "./equipmentInspectionDue";
import { collectVehicleDueItems } from "./vehicleComplianceDue";

function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / 86400000);
}

function severityForDays(days) {
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  return "warning";
}

/**
 * Unified due-date rows for certs, equipment registers, and training matrix (next N days + overdue).
 */
export function collectComplianceDueItems({
  workers = [],
  trainingRecords = [],
  horizonDays = 30,
  now = new Date(),
} = {}) {
  const items = [];
  const push = (row) => {
    if (row.days === null || row.days > horizonDays) return;
    items.push(row);
  };

  workers.forEach((w) => {
    normalizeWorkerCertifications(w).forEach((c) => {
      const dueIso = String(c.expiryDate || "").slice(0, 10);
      if (!dueIso) return;
      const days = daysUntil(dueIso, now);
      push({
        id: `cert_${w.id}_${c.certCode || c.certType}_${dueIso}`,
        kind: "cert",
        dueIso,
        days,
        label: c.certType || "Certificate",
        subject: w.name || "Worker",
        workerId: w.id,
        moduleId: "people",
        severity: severityForDays(days),
      });
    });
  });

  collectEquipmentInspectionDueItems().forEach((eq) => {
    const days = daysUntil(eq.nextDueIso, now);
    push({
      id: eq.id,
      kind: "equipment",
      dueIso: eq.nextDueIso,
      days,
      label: eq.name,
      subject:
        eq.moduleId === "inspections" ? "Inspections register" : eq.moduleId === "plant" ? "Plant register" : "PAT log",
      moduleId: eq.moduleId,
      severity: severityForDays(days),
    });
  });

  trainingRecords.forEach((r) => {
    const dueIso = String(r.expiryDate || "").slice(0, 10);
    if (!dueIso) return;
    const days = daysUntil(dueIso, now);
    push({
      id: `train_${r.id}`,
      kind: "training",
      dueIso,
      days,
      label: r.courseName || "Training",
      subject: r.workerName || "Worker",
      workerId: r.workerId,
      moduleId: "training",
      severity: severityForDays(days),
    });
  });

  collectVehicleDueItems().forEach((veh) => {
    const days = daysUntil(veh.nextDueIso, now);
    push({
      id: veh.id,
      kind: "vehicle",
      dueIso: veh.nextDueIso,
      days,
      label: veh.name,
      subject: veh.registration || "Fleet",
      vehicleId: veh.vehicleId,
      moduleId: "vehicles",
      severity: severityForDays(days),
    });
  });

  return items.sort((a, b) => a.days - b.days);
}

export function bucketComplianceDueItems(items = []) {
  return {
    overdue: items.filter((i) => i.days < 0),
    thisWeek: items.filter((i) => i.days >= 0 && i.days <= 7),
    later: items.filter((i) => i.days > 7),
  };
}

export function formatComplianceDueLabel(item) {
  if (!item) return "";
  if (item.days < 0) return `${Math.abs(item.days)} day(s) overdue`;
  if (item.days === 0) return "Due today";
  if (item.days === 1) return "Due tomorrow";
  return `Due in ${item.days} day(s)`;
}
