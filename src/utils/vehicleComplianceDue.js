import { loadOrgScoped } from "./orgStorage";

function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / 86400000);
}

const VEHICLE_DUE_FIELDS = [
  { field: "motDue", label: "MOT", dueKind: "mot" },
  { field: "insuranceExpiry", label: "Insurance", dueKind: "insurance" },
  { field: "nextServiceDue", label: "Service", dueKind: "service" },
  { field: "taxDue", label: "Road tax", dueKind: "tax" },
];

/**
 * Flatten vehicle register rows into due-date items (MOT, insurance, service, tax).
 */
export function collectVehicleDueItems() {
  const out = [];
  (loadOrgScoped("vehicle_register", []) || []).forEach((row) => {
    if (String(row.status || "").toLowerCase() === "disposed") return;
    const reg = row.registration || row.assetRef || "Vehicle";

    VEHICLE_DUE_FIELDS.forEach(({ field, label, dueKind }) => {
      const nextDueIso = String(row[field] || "").slice(0, 10);
      if (!nextDueIso) return;
      out.push({
        id: `veh_${row.id}_${dueKind}`,
        vehicleId: row.id,
        name: `${reg} — ${label}`,
        registration: reg,
        dueKind,
        nextDueIso,
        moduleId: "vehicles",
      });
    });
  });
  return out;
}

/** Due within 30 days (or overdue) for dashboards and reminders. */
export function getVehicleDueAlerts(now = new Date()) {
  return collectVehicleDueItems()
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
