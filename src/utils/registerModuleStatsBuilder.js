/**
 * Auto stats cards for RegisterModuleShell from live register rows.
 */
import { itemNeedsAttention } from "./moduleRegisterStats";

const monthPrefix = () => new Date().toISOString().slice(0, 7);

function countAttention(items) {
  return (items || []).filter((i) => itemNeedsAttention(i)).length;
}

function stat(label, value, tone = "neutral") {
  return { label, value, tone };
}

/** @param {string} moduleId @param {object[]} items */
export function buildRegisterModuleStats(moduleId, items = []) {
  const list = Array.isArray(items) ? items : [];
  const n = list.length;
  if (!n) return [];

  switch (moduleId) {
    case "coshh":
      return [
        stat("Substances", n),
        stat("High risk", list.filter((i) => i.riskLevel === "high").length, "warn"),
        stat("Missing SDS", list.filter((i) => !i.sdsUrl?.trim()).length, "warn"),
      ];
    case "fire":
      return [
        stat("Checks", n),
        stat("This month", list.filter((i) => String(i.checkDate || "").startsWith(monthPrefix())).length, "good"),
        stat("Action needed", list.filter((i) => i.satisfactory === false).length, "warn"),
      ];
    case "visitors":
      return [
        stat("Visits", n),
        stat("On site now", list.filter((i) => !i.timeOut && !i.signedOutAt).length, "warn"),
        stat("No induction", list.filter((i) => !i.inductionBriefed).length, "warn"),
      ];
    case "ppe":
      return [
        stat("Issues", n),
        stat("Active", list.filter((i) => i.status === "issued" || !i.status).length, "good"),
        stat("Attention", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
    case "plant":
      return [
        stat("Assets", n),
        stat("Out of service", list.filter((i) => /out|repair|quarantine/i.test(String(i.status || ""))).length, "warn"),
        stat("Due inspection", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
    case "vehicles": {
      const active = list.filter((i) => String(i.status || "active") !== "disposed");
      const dueSoon = active.filter((i) => {
        const dates = [i.motDue, i.insuranceExpiry, i.nextServiceDue, i.taxDue].filter(Boolean);
        return dates.some((d) => {
          const days = Math.ceil((new Date(d) - new Date()) / 86400000);
          return days <= 30;
        });
      }).length;
      return [
        stat("Vehicles", active.length),
        stat("Due ≤30 days", dueSoon, dueSoon ? "warn" : "good"),
        stat("Off road", list.filter((i) => i.status === "off_road").length, "warn"),
      ];
    }
    case "training":
      return [
        stat("Records", n),
        stat("Expiring soon", list.filter((i) => {
          const d = i.certExpiry || i.expiryDate;
          if (!d) return false;
          const days = Math.ceil((new Date(d) - new Date()) / 86400000);
          return days >= 0 && days <= 60;
        }).length, "warn"),
        stat("Expired", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
    case "first-aid":
      return [
        stat("First aiders", n),
        stat("Cert expiring", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
    case "incidents":
      return [
        stat("Records", n),
        stat("Open", list.filter((i) => !/closed|resolved/i.test(String(i.status || ""))).length, "warn"),
        stat("RIDDOR?", list.filter((i) => i.riddorReportable || i.severity === "major").length, "warn"),
      ];
    case "incident-actions":
      return [
        stat("Actions", n),
        stat("Open", list.filter((i) => !/closed|done|complete/i.test(String(i.status || ""))).length, "warn"),
        stat("Overdue", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
    case "hot-work":
      return [
        stat("Permits", n),
        stat("Active", list.filter((i) => /active|live|open/i.test(String(i.status || ""))).length, "neutral"),
        stat("Attention", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
    case "observations":
      return [
        stat("Observations", n),
        stat("Open", list.filter((i) => !/closed|resolved/i.test(String(i.status || ""))).length, "warn"),
        stat("Positive", list.filter((i) => /positive|good/i.test(String(i.type || ""))).length, "good"),
      ];
    case "lone-working":
      return [
        stat("Check-ins", n),
        stat("Active", list.filter((i) => /active|checked_in/i.test(String(i.status || ""))).length, "warn"),
      ];
    case "excavation":
      return [
        stat("Records", n),
        stat("Open", list.filter((i) => i.status === "open").length, list.filter((i) => i.status === "open").length ? "warn" : "good"),
        stat(
          "Utilities unchecked",
          list.filter((i) => !i.utilitiesConfirmed && i.status !== "backfilled").length,
          list.filter((i) => !i.utilitiesConfirmed && i.status !== "backfilled").length ? "warn" : "good"
        ),
      ];
    case "asbestos":
      return [
        stat("Locations", n),
        stat("High risk", list.filter((i) => /high|acm/i.test(String(i.condition || i.risk || ""))).length, "warn"),
      ];
    case "loto":
      return [
        stat("Locks", n),
        stat("Applied", list.filter((i) => /applied|active|locked/i.test(String(i.status || ""))).length, "warn"),
      ];
    case "waste":
      return [
        stat("Movements", n),
        stat("This month", list.filter((i) => String(i.disposedAt || i.date || "").startsWith(monthPrefix())).length, "good"),
      ];
    case "method-statement":
      return [
        stat("Statements", n),
        stat("Draft", list.filter((i) => /draft/i.test(String(i.status || ""))).length, "warn"),
        stat("Approved", list.filter((i) => /approved|issued/i.test(String(i.status || ""))).length, "good"),
      ];
    case "timesheets":
      return [
        stat("Entries", n),
        stat("Pending", list.filter((i) => i.status === "pending").length, "warn"),
      ];
    case "snags":
      return [
        stat("Open", list.filter((i) => i.status === "open").length, "warn"),
        stat("High priority", list.filter((i) => i.priority === "high" && i.status !== "closed").length, "warn"),
        stat("Total", n),
      ];
    case "inspections":
      return [
        stat("Overdue", list.filter((i) => i.nextInspectionDate && new Date(i.nextInspectionDate) < new Date()).length, "warn"),
        stat("Total", n),
      ];
    case "legislation":
      return [
        stat("Entries", n),
        stat("Applicable", list.filter((i) => i.applicable).length, "good"),
        stat("Review due", list.filter((i) => i.nextReview && new Date(i.nextReview) <= new Date()).length, "warn"),
      ];
    default:
      return [
        stat("Records", n),
        stat("Need attention", countAttention(list), countAttention(list) ? "warn" : "good"),
      ];
  }
}
