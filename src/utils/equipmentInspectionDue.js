import { loadOrgScoped } from "./orgStorage";

function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / 86400000);
}

/**
 * Normalised inspection due rows from plant, inspections, and PAT registers.
 */
export function collectEquipmentInspectionDueItems() {
  const out = [];

  const push = (row) => {
    const nextDueIso = String(row.nextDueIso || "").slice(0, 10);
    if (!nextDueIso) return;
    out.push({
      id: row.id,
      name: row.name || "Equipment",
      nextDueIso,
      moduleId: row.moduleId,
    });
  };

  (loadOrgScoped("inspection_records", []) || []).forEach((row) => {
    push({
      id: `insp_${row.id}`,
      name: row.assetRef || row.description || row.name || "Inspection item",
      nextDueIso: row.nextInspectionDate || row.nextInspection,
      moduleId: "inspections",
    });
  });

  (loadOrgScoped("plant_register", []) || []).forEach((row) => {
    push({
      id: `plant_${row.id}`,
      name: row.assetRef || row.description || "Plant item",
      nextDueIso: row.nextDue,
      moduleId: "plant",
    });
  });

  (loadOrgScoped("electrical_pat_log", []) || []).forEach((row) => {
    push({
      id: `pat_${row.id}`,
      name: row.assetTag || row.description || row.location || "PAT item",
      nextDueIso: row.nextTestDue || row.nextDue,
      moduleId: "electrical-pat",
    });
  });

  return out;
}

/** Due within 30 days (or overdue) for dashboards and next-steps. */
export function getEquipmentDueAlerts(now = new Date()) {
  return collectEquipmentInspectionDueItems()
    .map((item) => {
      const days = daysUntil(item.nextDueIso, now);
      if (days === null || days > 30) return null;
      let severity = "warning";
      if (days < 0) severity = "expired";
      else if (days <= 7) severity = "critical";
      return { ...item, days, severity };
    })
    .filter(Boolean)
    .sort((a, b) => a.days - b.days);
}
