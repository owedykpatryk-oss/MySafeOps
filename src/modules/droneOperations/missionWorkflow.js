import { fieldSessionState, fieldJournalText } from "./fieldSession.js";
import { actionSection } from "./droneReminders.js";

const value = (v) => String(v ?? "").trim() || "Not recorded";
const namedCheck = (check, at) =>
  check?.status === "done" &&
  String(check.by || "").trim() &&
  Number.isFinite(Date.parse(check.at)) &&
  Date.parse(check.at) <= at;
const rowsText = (rows) => rows.map(([label, content]) => `${label}: ${value(content)}`).join("\n");
export const exportReviewKey = (issue) => JSON.stringify(issue.snapshot);

export function closeoutSummary(m, definitions = m.checklistDefinitions || [], at = Date.now()) {
  const journal = Array.isArray(m.fieldJournal) ? m.fieldJournal : [];
  let state = fieldSessionState(m.fieldJournal),
    last = 0,
    active = 0,
    paused = 0,
    previous = "idle";
  for (const event of journal) {
    if (!event || typeof event !== "object") {
      state = "invalid";
      break;
    }
    const time = Date.parse(event.at);
    if (!Number.isFinite(time) || time > at || time < last) {
      state = "invalid";
      break;
    }
    if (previous === "active") active += time - last;
    if (previous === "paused") paused += time - last;
    previous = { start: "active", resume: "active", pause: "paused", close: "closed" }[event.type];
    last = time;
  }
  if (state === "active") active += at - last;
  if (state === "paused") paused += at - last;
  const measured = journal.length > 0 && state !== "invalid";
  const post = definitions.filter((d) => d.phase === "post");
  const pendingPost = post.filter((d) => !namedCheck(m.checklist?.[d.id], at));
  return {
    state,
    startAt: measured ? journal[0]?.at : null,
    closedAt: state === "closed" ? journal.at(-1)?.at : null,
    closingNote: state === "closed" ? journal.at(-1)?.note : null,
    activeMinutes: measured ? Math.round(active / 60000) : null,
    pausedMinutes: measured ? Math.round(paused / 60000) : null,
    pauses: journal.filter((e) => e?.type === "pause"),
    postTotal: post.length,
    postRecorded: post.length - pendingPost.length,
    pendingPost,
  };
}
export function nextMissionStep(m, actions = [], definitions = [], at = Date.now()) {
  const summary = closeoutSummary(m, definitions, at);
  if (m.cancelled)
    return {
      phase: "cancelled",
      title: "Mission cancelled",
      detail: "Review the recorded session and capture any outstanding handover. Cancellation does not erase history.",
      label: "Open site records",
      section: "field",
    };
  if (summary.state === "invalid")
    return {
      phase: "review",
      title: "Review the session history",
      detail: "The recorded sequence or times need attention before they can be summarised.",
      label: "Open site records",
      section: "field",
    };
  if (summary.state === "paused")
    return {
      phase: "paused",
      title: "Review the pause before continuing",
      detail: summary.pauses.at(-1)?.note || "Confirm what changed with the team and record the reason for resuming.",
      label: "Review paused session",
      section: "field",
    };
  if (summary.state === "closed")
    return summary.pendingPost.length || !summary.postTotal
      ? {
          phase: "handover",
          title: "Finish the handover review",
          detail: summary.postTotal
            ? `${summary.pendingPost.length} post-operation check(s) still need an attributed review.`
            : "No post-operation checklist was supplied. Review the applicable checks.",
          label: "Review post-operation checks",
          section: "checklist",
        }
      : {
          phase: "handover",
          title: "Prepare the close-out record",
          detail: "Assemble the recorded session, handover checks and outstanding planning actions into a draft.",
          label: "Review close-out PDF",
          exportKind: "closeout",
        };
  if (summary.state === "active")
    return {
      phase: "site",
      title: "Keep the site record up to date",
      detail: "Record pauses and changed conditions. Close the session with a handover note when the team's work ends.",
      label: "Open active session",
      section: "field",
    };
  if (actions.length)
    return {
      phase: "prepare",
      title: "Prepare the next part of the plan",
      detail: actions[0].text,
      label: "Review next item",
      section: actionSection(String(actions[0].key || "")),
    };
  return {
    phase: "site",
    title: "Bring the plan to the site team",
    detail: "Open the field view for the briefing and site records. The operator's flight decision remains separate.",
    label: "Open field mode",
    section: "field",
  };
}

export function documentQuality(
  m,
  { actions = m.nextActions, definitions = m.checklistDefinitions || [], at = Date.now() } = {}
) {
  const findings = [];
  const add = (id, title, detail, section) => findings.push({ id, title, detail, section });
  if (m.cancelled)
    add(
      "mission-cancelled",
      "Mission is cancelled",
      "The session history remains a record of site activity. It does not reverse cancellation or authorise further work.",
      "review"
    );
  for (const [index, event] of (Array.isArray(m.fieldJournal) ? m.fieldJournal : []).entries()) {
    if (!event || typeof event !== "object") continue;
    if (!String(event.by || "").trim())
      add(
        `journal-attribution:${index}`,
        "Session entry has no named recorder",
        `Entry ${index + 1}: verify who recorded this event before relying on it.`,
        "field"
      );
    if (event.type !== "start" && !String(event.note || "").trim())
      add(
        `journal-note:${index}`,
        "Session entry has no explanatory note",
        `Entry ${index + 1}: the ${value(event.type)} event needs a recorded note.`,
        "field"
      );
  }
  for (const key of ["title", "projectId", "location", "client"])
    if (!String(m[key] || "").trim())
      add(
        `missing:${key}`,
        `${{ title: "Mission name", projectId: "Project", location: "Site location", client: "Client" }[key]} not recorded`,
        "Complete the document's identifying information.",
        "overview"
      );
  if (!Array.isArray(actions))
    add(
      "assessment-missing",
      "Planning assessment not supplied",
      "This document cannot report the current planning actions.",
      "review"
    );
  else
    actions.forEach((a, i) =>
      add(
        `planning:${a.key}:${i}`,
        a.text,
        "Unresolved planning review item; a draft does not clear it.",
        actionSection(String(a.key || ""))
      )
    );
  for (const definition of definitions) {
    const check = m.checklist?.[definition.id];
    if (check?.status === "done" && !namedCheck(check, at))
      add(
        `check-attribution:${definition.id}`,
        `Review attribution: ${definition.stage || definition.id}`,
        "A completed check needs a named reviewer and a valid time that is not in the future.",
        "checklist"
      );
  }
  for (const [i, e] of (m.evidence || []).entries()) {
    const id = e.id || i,
      checked = Date.parse(e.checkedAt),
      until = Date.parse(e.validUntil);
    if (!Number.isFinite(checked) || !Number.isFinite(until) || until < checked || checked > at)
      add(
        `evidence-dates:${id}`,
        `Check evidence dates: ${e.kind || "evidence"}`,
        "Review time and validity must be recorded, ordered correctly and consistent with the export time.",
        "checks"
      );
    if (!String(e.source || "").trim())
      add(
        `evidence-source:${id}`,
        "Evidence source missing",
        "Add a source or reference that another reviewer can trace.",
        "checks"
      );
  }
  for (const [i, f] of (m.sourceFacts || []).entries()) {
    if (
      f.expiresOn &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(f.expiresOn) ||
        !Number.isFinite(Date.parse(f.expiresOn)) ||
        new Date(f.expiresOn).toISOString().slice(0, 10) !== f.expiresOn)
    )
      add(
        `source-expiry:${f.field}:${i}`,
        "Source expiry date is invalid",
        `${value(f.sourceName)}: verify the date against the source document.`,
        "documents"
      );
  }
  if (closeoutSummary(m, definitions, at).state === "invalid")
    add(
      "journal-invalid",
      "Session sequence or timestamps need review",
      "The close-out summary cannot calculate reliable session times from these records.",
      "field"
    );
  return findings;
}
export function qualityText(m, at) {
  const findings = documentQuality(m, { at });
  return (
    `Automated document review at ${Number.isFinite(at) ? new Date(at).toISOString() : "unrecorded export time"}. This checks recorded data; it is not an operational approval.\n\n` +
    (findings.length
      ? findings.map((f, i) => `${i + 1}. ${f.title}\n${f.detail}`).join("\n\n")
      : "No document inconsistencies detected by these checks. The responsible person's review is still required.")
  );
}
export function closeoutSections(issue) {
  const m = issue.snapshot,
    at = Date.parse(issue.issuedAt),
    summary = closeoutSummary(m, undefined, at);
  return [
    [
      "Document status",
      "DRAFT — site coordination close-out. This is a summary of recorded facts, not confirmation that the survey deliverables are complete or that an aircraft was released for flight.",
    ],
    [
      "Session at a glance",
      rowsText([
        ["Mission", m.title],
        ["Project", m.records?.project?.name || m.projectId],
        ["Client", m.client],
        ["Site location", m.location],
        ["Planning revision", m.revision],
        ["Mission status", m.cancelled ? "Cancelled" : "See planning review"],
        ["Site session state", summary.state],
        ["Session started (UTC)", summary.startAt],
        ["Session closed (UTC)", summary.closedAt],
        ["Active site-session minutes (not flight time)", summary.activeMinutes],
        ["Paused minutes", summary.pausedMinutes],
        ["Post-operation reviews recorded", `${summary.postRecorded} of ${summary.postTotal}`],
        ["Planned deliverables", m.deliverables],
      ]),
    ],
    [
      "Closing note and handover",
      summary.closingNote ||
        (summary.state === "closed"
          ? "Session closed; no closing note was recorded."
          : "No closing note recorded. The site session has not been closed."),
    ],
    [
      "Recorded pauses",
      summary.pauses.length
        ? summary.pauses.map((e) => `${e.at} | ${value(e.by)}\n${value(e.note)}`).join("\n\n")
        : "No pauses recorded. This does not confirm that there were no interruptions.",
    ],
    [
      "Post-operation checks to review",
      !summary.postTotal
        ? "No post-operation checklist supplied."
        : summary.pendingPost.length
          ? summary.pendingPost
              .map((d) => `${d.stage || d.id}: ${value(d.text)}\nResponsible role: ${value(d.role)}`)
              .join("\n\n")
          : "All supplied post-operation checks have an attributed review. Deliverable acceptance remains separate.",
    ],
    [
      "Evidence and handover references",
      (m.evidence || [])
        .map((e) => `${value(e.kind)}: ${value(e.source)}\nDocument reference: ${value(e.documentId)}`)
        .join("\n\n") ||
        "No evidence references recorded. Add the survey output and handover references to the source records where applicable.",
    ],
    ["Site session journal", fieldJournalText(m)],
    ["Document quality review", qualityText(m, at)],
  ];
}
