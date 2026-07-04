/**
 * Snapshot linked RAMS at permit issue time (immutable underpinning RA).
 */
import { loadOrgScoped as load } from "./orgStorage";

const RAMS_KEY = "rams_builder_docs";

/** @param {string} ramsId */
export function snapshotRamsForPermit(ramsId) {
  if (!ramsId) return null;
  const docs = load(RAMS_KEY, []);
  const doc = docs.find((d) => d.id === ramsId);
  if (!doc) return null;
  const rows = Array.isArray(doc.rows) ? doc.rows : doc.editedRows || [];
  return {
    ramsId: doc.id,
    ramsTitle: doc.title || "",
    documentNo: doc.documentNo || "",
    revision: doc.revision || "",
    snapshotAt: new Date().toISOString(),
    rowCount: rows.length,
    rows: rows.map((r) => ({
      id: r.id,
      activity: r.activity,
      hazard: r.hazard,
      initialRisk: r.initialRisk,
      revisedRisk: r.revisedRisk,
      controlMeasures: (r.controlMeasures || []).slice(0, 12),
      ppeRequired: (r.ppeRequired || []).slice(0, 8),
    })),
  };
}

/** @param {object} permit */
export function attachRamsSnapshotOnIssue(permit) {
  const ramsId = permit?.linkedRamsId || permit?.linkedRams || "";
  if (!ramsId) return permit;
  const snap = snapshotRamsForPermit(ramsId);
  if (!snap) return permit;
  return {
    ...permit,
    ramsSnapshotAtIssue: snap,
    issuedAt: permit.issuedAt || new Date().toISOString(),
  };
}
