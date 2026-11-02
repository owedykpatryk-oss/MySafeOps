import { loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";
import { pushRecycleBinItem } from "../../utils/recycleBin";
import { replaceWithTombstone } from "../../utils/d1ArrayMerge";
import { getGprEditorScope } from "./gprEditorSession";

export function persistGprReports(scope, update) {
  if (scope !== getGprEditorScope()) return null;
  const current = loadOrgScoped("gpr_reports", []);
  const next = typeof update === "function" ? update(current) : update;
  // An older open editor must not undo a deletion from another tab/device.
  // Explicit recovery goes through the recycle bin, not the editor save path.
  const deletedIds = new Set(current.filter(row => row.deletedAt).map(row => row.id));
  if (next.some(row => deletedIds.has(row.id) && !row.deletedAt)) return null;
  return saveOrgScoped("gpr_reports", next) === true ? next : null;
}

export function deleteGprReport(scope, report) {
  if (scope !== getGprEditorScope() || !report?.id) return null;
  const current = loadOrgScoped("gpr_reports", []);
  const live = current.find(row => row.id === report.id && !row.deletedAt);
  if (!live) return null;
  const recovery = pushRecycleBinItem({
    moduleId: "gpr-report", moduleLabel: "GPR reports", itemType: "gpr_report",
    itemLabel: live.ref || live.title, sourceKey: "gpr_reports", payload: live,
  });
  if (!recovery) return null;
  // Keep the recovery copy even when the register write fails.
  return persistGprReports(scope, rows => replaceWithTombstone(rows, live.id));
}
