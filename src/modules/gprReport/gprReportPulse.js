import { GPR_DELIVERABLES } from "./gprReportConstants";
import { gprReportQuality } from "./gprReportHelpers";

/** Deliverable checklist progress for scorecard UI. */
export function gprDeliverableProgress(deliverables = {}) {
  const items = GPR_DELIVERABLES.map((d) => ({
    key: d.key,
    label: d.label,
    done: Boolean(deliverables[d.key]),
  }));
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  return { items, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Evidence counts for hero chips and list rows. */
export function gprEvidenceStats(report) {
  const radargrams = report?.radargrams?.length || 0;
  const panels = report?.scanPanels?.length || 0;
  const chainage = report?.chainageSegments?.length || 0;
  const planFigures = report?.planFigures?.length || 0;
  const anomalies = report?.anomalies?.length || 0;
  const filtersApplied = (report?.processing?.filters || []).filter((f) => f.applied).length;
  return {
    radargrams,
    panels,
    chainage,
    planFigures,
    anomalies,
    filtersApplied,
    totalEvidence: radargrams + panels + chainage + planFigures,
  };
}

/** Section health breakdown for deliverable scorecard rings. */
export function gprSectionHealth(report) {
  const r = report || {};
  const q = gprReportQuality(r);
  const qaDone = Object.values(r.qaChecklist || {}).filter(Boolean).length;
  const qaTotal = Object.keys(r.qaChecklist || {}).length || 1;
  const del = gprDeliverableProgress(r.deliverables);

  return [
    {
      key: "quality",
      label: "Report quality",
      pct: q.score,
      tone: q.score >= 80 ? "ok" : q.score >= 50 ? "warn" : "risk",
    },
    {
      key: "deliverables",
      label: "Deliverables",
      pct: del.pct,
      tone: del.pct >= 75 ? "ok" : del.pct >= 40 ? "warn" : "risk",
    },
    {
      key: "evidence",
      label: "Field evidence",
      pct: Math.min(100, (gprEvidenceStats(r).totalEvidence / 5) * 100),
      tone: gprEvidenceStats(r).totalEvidence >= 3 ? "ok" : gprEvidenceStats(r).totalEvidence ? "warn" : "risk",
    },
    {
      key: "qa",
      label: "QA checks",
      pct: Math.round((qaDone / qaTotal) * 100),
      tone: qaDone >= qaTotal * 0.7 ? "ok" : qaDone ? "warn" : "risk",
    },
  ];
}
