import {
  assessMission,
  recordFingerprint,
  matchesApprovedSnapshot,
  applicableChecklist,
} from "../src/modules/droneOperations/droneMission.js";
import {
  manualSections,
  regionOf,
  kindOf,
  regionalSources,
  ruleVersion,
} from "../src/modules/droneOperations/droneRegions.js";
import { validateFieldJournal } from "../src/modules/droneOperations/fieldSession.js";
import { manualReview } from "../src/modules/droneOperations/companyManual.js";

export const DRONE_NAMESPACES = new Set(["drone_missions", "drone_manuals", "drone_setups", "drone_library"]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function validateDroneWrite(namespace, previous, next, actorSub, context = {}, now = Date.now()) {
  if (!DRONE_NAMESPACES.has(namespace)) return null;
  if (
    !Array.isArray(next) ||
    next.length > 1000 ||
    next.some((r) => !r || typeof r.id !== "string" || !r.id) ||
    new Set(next.map((r) => r.id)).size !== next.length
  )
    return "invalid_drone_rows";
  const before = Array.isArray(previous) ? previous : [];
  if (namespace === "drone_library") {
    for (const old of before)
      if (
        !same(
          old,
          next.find((r) => r.id === old.id)
        )
      )
        return "library_version_is_immutable";
    for (const row of next)
      if (!before.some((r) => r.id === row.id) && row.approvedUserId !== actorSub) return "invalid_approval_actor";
  }
  if (namespace === "drone_manuals") {
    if (
      next.some(
        (m) =>
          !["uk", "au"].includes(regionOf(m)) ||
          !["drone", "helicopter"].includes(kindOf(m)) ||
          (regionOf(m) === "uk" && kindOf(m) === "helicopter")
      )
    )
      return "invalid_manual_scope";
    for (const old of before)
      if (
        old.approvedAt &&
        !same(
          old,
          next.find((r) => r.id === old.id)
        )
      )
        return "reviewed_manual_is_immutable";
    for (const row of next)
      if (row.approvedAt && !before.find((r) => r.id === row.id)?.approvedAt) {
        if (row.approvedUserId !== actorSub) return "invalid_approval_actor";
        if (row.format === "company-manual/1" && manualReview(row, new Date(now).toISOString()).issues.length)
          return "incomplete_manual_review";
        if (
          !row.scope?.trim() ||
          !row.version?.trim() ||
          !row.changeNote?.trim() ||
          manualSections(row).some((s) => !row.sections?.[s.id]?.trim())
        )
          return "incomplete_manual_review";
      }
  }
  if (namespace === "drone_missions") {
    for (const old of before) {
      const row = next.find((r) => r.id === old.id);
      if (!row && old.fieldJournal?.length) return "field_journal_is_append_only";
      for (const issue of old.issues || [])
        if (
          !same(
            issue,
            row?.issues?.find((i) => i.id === issue.id)
          )
        )
          return "issued_pack_is_immutable";
    }
    for (const row of next) {
      const old = before.find((r) => r.id === row.id);
      const journalError = validateFieldJournal(old?.fieldJournal, row.fieldJournal, actorSub, row.revision, now);
      if (journalError) return journalError;
      // The final row may bundle start -> cancellation -> close while offline.
      // Cancellation guards live actions in the client; it cannot invalidate earlier history.
      if (row.approval && !same(row.approval, old?.approval) && row.approval.userId !== actorSub)
        return "invalid_approval_actor";
      if (
        !Array.isArray(row.issues || []) ||
        new Set((row.issues || []).map((i) => i.id)).size !== (row.issues || []).length
      )
        return "invalid_drone_rows";
      const added = (row.issues || []).filter((i) => !old?.issues?.some((o) => o.id === i.id));
      if (row.approval && !same(row.approval, old?.approval) && !added.length) return "approval_requires_snapshot";
      if (
        row.approval &&
        !matchesApprovedSnapshot(row, row.issues?.find((i) => same(i.snapshot?.approval, row.approval))?.snapshot)
      )
        return "snapshot_does_not_match_mission";
      for (const issue of added) {
        const s = issue.snapshot;
        if (
          !s ||
          issue.kind !== "approved" ||
          s.approval?.userId !== actorSub ||
          !same(s.approval, row.approval) ||
          s.id !== row.id ||
          issue.revision !== row.revision
        )
          return "invalid_approval_actor";
        if (
          s.approval.recordFingerprint !== recordFingerprint(context, s) ||
          !same(s.records, JSON.parse(recordFingerprint(context, s)))
        )
          return "linked_registers_changed";
        if (
          !s.approval.onSiteConfirmed ||
          !["admin", "supervisor"].includes(s.approval.role) ||
          !Number.isFinite(Date.parse(s.approval.at)) ||
          Math.abs(Date.parse(s.approval.at) - now) > 10 * 60000
        )
          return "invalid_approval";
        if (!matchesApprovedSnapshot(row, s)) return "snapshot_does_not_match_mission";
        const issueJournal = s.fieldJournal || [],
          currentJournal = row.fieldJournal || [];
        // The issue freezes the prefix recorded at approval; later session events may sync in this same write.
        if (
          !Array.isArray(issueJournal) ||
          issueJournal.length > currentJournal.length ||
          (currentJournal[issueJournal.length] &&
            Date.parse(currentJournal[issueJournal.length].at) < Date.parse(s.approval.at)) ||
          issueJournal.some(
            (event, i) => !same(event, currentJournal[i]) || Date.parse(event.at) > Date.parse(s.approval.at)
          )
        )
          return "snapshot_journal_does_not_match_mission";
        const assessment = assessMission({ ...s, approval: null, recheckRequired: false }, context, now);
        if (s.cancelled || assessment.actions.length) return "mission_not_ready";
        if (
          !same(s.sources, regionalSources(s)) ||
          !same(s.checklistDefinitions, applicableChecklist(s, context)) ||
          s.ruleVersion !== ruleVersion(s) ||
          !same(
            s.catalogue,
            JSON.parse(
              JSON.stringify({
                profile: assessment.profile,
                payload: assessment.payload,
                template: assessment.template,
              })
            )
          )
        )
          return "invalid_snapshot_metadata";
      }
    }
  }
  return null;
}
