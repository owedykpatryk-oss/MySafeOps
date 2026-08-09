import { describe, expect, it } from "vitest";
import {
  buildManagementDiary,
  buildMobilisationWatch,
  buildPlannerWeeks,
  clampPlannerShift,
  cleanIsoDate,
  cleanMoney,
  cleanText,
  conflictJobIds,
  consolidateManagementStates,
  daysBetween,
  diffJobChanges,
  findScheduleConflicts,
  jobSchedulePhase,
  jobTone,
  mergeManagementStates,
  monthCapacity,
  normaliseManagementState,
  plannerDaysFromDelta,
  plannerPosition,
  plannerTodayOffset,
  readinessForJob,
  shiftJobDates,
  sumJobValue,
  workingDaysBetween,
} from "./managementOverview";

describe("management overview", () => {
  it("builds a Monday-based 13-week planning window", () => {
    const weeks = buildPlannerWeeks(new Date("2026-08-04T12:00:00"));
    expect(weeks).toHaveLength(13);
    expect(weeks[0].iso).toBe("2026-08-03");
  });

  it("calculates readiness and traffic-light tone", () => {
    const ready = { status: "confirmed", readiness: { dates: 1, team: 1, rams: 1, permits: 1, survey: 1, client: 1 } };
    expect(readinessForJob(ready)).toBe(100);
    expect(jobTone(ready)).toBe("green");
    expect(jobTone({ ...ready, status: "delayed" })).toBe("red");
  });

  it("positions work inside the planning window", () => {
    const weeks = buildPlannerWeeks(new Date("2026-08-04T12:00:00"), 2);
    expect(plannerPosition("2026-08-03", "2026-08-09", weeks)).toEqual({ left: 0, width: 50 });
  });

  it("counts working days and monthly team capacity", () => {
    expect(workingDaysBetween("2026-08-03", "2026-08-09")).toBe(5);
    const result = monthCapacity(
      [{ teamId: "a", start: "2026-08-03", end: "2026-08-07", status: "confirmed" }],
      { id: "a", capacity: 1 },
      new Date("2026-08-01T12:00:00")
    );
    expect(result.booked).toBe(5);
    expect(result.percentage).toBeGreaterThan(0);
  });

  it("builds diary roll-up for scheduled, completed and capacity gaps", () => {
    const diary = buildManagementDiary(
      [
        { id: "j1", name: "North dig", teamId: "a", start: "2026-08-10", end: "2026-08-14", status: "confirmed" },
        { id: "j2", name: "Done job", teamId: "a", start: "2026-07-20", end: "2026-07-24", status: "completed" },
        { id: "j3", name: "Cancelled", teamId: "a", start: "2026-08-12", end: "2026-08-13", status: "cancelled" },
      ],
      [{ id: "a", name: "Alpha", capacity: 5 }],
      new Date("2026-08-05T12:00:00")
    );
    expect(diary.summary.scheduledCount).toBe(1);
    expect(diary.scheduled[0].id).toBe("j1");
    expect(diary.summary.completedCount).toBe(1);
    expect(diary.completed[0].id).toBe("j2");
    expect(diary.gapCount).toBeGreaterThan(0);
    expect(diary.gaps[0].teamName).toBe("Alpha");
  });

  it("restores editable default teams for invalid state", () => {
    const state = normaliseManagementState({ teams: [], jobs: [] });
    expect(state.teams).toHaveLength(3);
    expect(state.jobs).toEqual({});
    expect(state.calendar.groupName).toBe("MySafeOps");
    expect(state.meeting.title).toBe("Weekly management meeting");
  });

  it("preserves remote rows while applying concurrent local management edits", () => {
    const merged = mergeManagementStates(
      {
        teams: [{ id: "north", name: "North", capacity: 5 }, { id: "south", name: "South", capacity: 5 }],
        opportunities: [{ id: "remote", name: "Remote lead" }],
        meeting: { actions: [{ id: "remote-action", text: "Remote action" }] },
      },
      {
        teams: [{ id: "north", name: "North delivery", capacity: 4 }],
        opportunities: [{ id: "local", name: "Local lead" }],
        meeting: { actions: [{ id: "local-action", text: "Local action" }] },
      }
    );

    expect(merged.teams.map((team) => team.id)).toEqual(["north", "south"]);
    expect(merged.teams[0].name).toBe("North delivery");
    expect(merged.opportunities.map((item) => item.id)).toEqual(["remote", "local"]);
    expect(merged.meeting.actions.map((item) => item.id)).toEqual(["remote-action", "local-action"]);
  });

  it("consolidates countries without letting their ids collide", () => {
    const rollup = consolidateManagementStates([
      {
        workspaceId: "ws-uk",
        countryName: "United Kingdom",
        marketId: "uk",
        state: {
          teams: [{ id: "north", name: "North", capacity: 5 }],
          opportunities: [{ id: "lead", name: "UK lead" }],
          meeting: { actions: [{ id: "a1", text: "Open" }, { id: "a2", text: "Done", status: "Done" }] },
        },
      },
      {
        workspaceId: "ws-pl",
        countryName: "Poland",
        marketId: "pl",
        state: {
          teams: [{ id: "north", name: "Polnoc", capacity: 3 }],
          opportunities: [{ id: "lead", name: "PL lead" }],
          meeting: { actions: [{ id: "a1", text: "Otwarte" }] },
        },
      },
    ]);

    // Both countries name a team "north"; namespacing by workspace keeps them distinct.
    expect(rollup.teams.map((team) => team.id)).toEqual(["ws-uk:north", "ws-pl:north"]);
    expect(rollup.teams.map((team) => team.countryName)).toEqual(["United Kingdom", "Poland"]);
    expect(rollup.opportunities.map((item) => item.id)).toEqual(["ws-uk:lead", "ws-pl:lead"]);
    expect(rollup.totals).toMatchObject({ countries: 2, teams: 2, opportunities: 2, openActions: 2, capacity: 8 });
  });

  it("ignores entries without a country workspace", () => {
    const rollup = consolidateManagementStates([{ countryName: "Nowhere", state: {} }, null]);
    expect(rollup.totals.countries).toBe(0);
    expect(rollup.teams).toEqual([]);
  });

  it("separates work running now from work that has run past its finish date", () => {
    const diary = buildManagementDiary(
      [
        { id: "running", teamId: "a", start: "2026-08-03", end: "2026-08-12", status: "confirmed" },
        { id: "late", teamId: "a", start: "2026-07-20", end: "2026-07-31", status: "confirmed" },
        { id: "future", teamId: "a", start: "2026-08-20", end: "2026-08-24", status: "confirmed" },
        { id: "closed", teamId: "a", start: "2026-07-20", end: "2026-07-24", status: "completed" },
      ],
      [{ id: "a", name: "Alpha", capacity: 5 }],
      new Date("2026-08-05T12:00:00")
    );

    expect(diary.inProgress.map((job) => job.id)).toEqual(["running"]);
    expect(diary.overdue.map((job) => job.id)).toEqual(["late"]);
    expect(diary.scheduled.map((job) => job.id)).toEqual(["future"]);
    expect(diary.summary).toMatchObject({ inProgressCount: 1, overdueCount: 1, scheduledCount: 1, completedCount: 1 });
  });

  it("classifies a job against today", () => {
    const today = "2026-08-05";
    expect(jobSchedulePhase({ start: "2026-08-01", end: "2026-08-10" }, today)).toBe("active");
    expect(jobSchedulePhase({ start: "2026-08-01", end: "2026-08-03" }, today)).toBe("overdue");
    expect(jobSchedulePhase({ start: "2026-08-09", end: "2026-08-10" }, today)).toBe("upcoming");
    expect(jobSchedulePhase({ start: "", end: "" }, today)).toBe("unscheduled");
    expect(jobSchedulePhase({ start: "2026-08-01", end: "2026-08-03", status: "completed" }, today)).toBe("done");
    expect(jobSchedulePhase({ start: "2026-08-01", end: "2026-08-03", status: "cancelled" }, today)).toBe("cancelled");
  });

  it("finds double bookings on the live programme and ignores closed work", () => {
    const jobs = [
      { id: "j1", name: "Dig one", teamId: "a", start: "2026-08-03", end: "2026-08-07", status: "confirmed" },
      { id: "j2", name: "Dig two", teamId: "a", start: "2026-08-06", end: "2026-08-11", status: "provisional" },
      { id: "j3", name: "Clear", teamId: "a", start: "2026-08-20", end: "2026-08-21", status: "confirmed" },
      { id: "j4", name: "Cancelled clash", teamId: "a", start: "2026-08-04", end: "2026-08-05", status: "cancelled" },
      { id: "j5", name: "Other team", teamId: "b", start: "2026-08-04", end: "2026-08-09", status: "confirmed" },
    ];
    const conflicts = findScheduleConflicts(jobs, [{ id: "a", name: "Alpha" }, { id: "b", name: "Bravo" }]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ teamName: "Alpha", from: "2026-08-06", to: "2026-08-07" });
    expect(conflicts[0].jobs.map((job) => job.id)).toEqual(["j1", "j2"]);
    expect([...conflictJobIds(conflicts)]).toEqual(["j1", "j2"]);
  });

  it("places the today marker inside the planner window", () => {
    const weeks = buildPlannerWeeks(new Date("2026-08-05T12:00:00"), 2);
    expect(plannerTodayOffset(weeks, "2026-08-03")).toBeCloseTo((0.5 / 14) * 100, 5);
    expect(plannerTodayOffset(weeks, "2026-09-30")).toBeNull();
    expect(daysBetween("2026-08-03", "2026-08-10")).toBe(7);
  });

  it("rejects hostile or malformed values from the shared document", () => {
    const state = normaliseManagementState({
      teams: [{ id: "t1", name: "North\r\nDESCRIPTION:injected", colour: "javascript:alert(1)", capacity: 99 }],
      jobs: { good: { start: "2026-08-03", end: "2026-08-04", status: "confirmed" }, bad: { status: "root" }, "": {} },
      opportunities: [{ id: "o1", name: "Lead", start: "2026-02-30", end: "not-a-date", status: "superuser" }],
      meeting: { actions: [{ id: "a1", text: "Do it", status: "Escalated" }, { id: "a2", text: "   " }] },
    });

    expect(state.teams[0].name).toBe("North DESCRIPTION:injected");
    expect(state.teams[0].colour).toBe("#0f766e");
    expect(state.teams[0].capacity).toBe(7);
    expect(Object.keys(state.jobs)).toEqual(["good", "bad"]);
    expect(state.jobs.bad.status).toBe("provisional");
    expect(state.opportunities[0]).toMatchObject({ start: "", end: "", status: "provisional" });
    expect(state.meeting.actions).toHaveLength(1);
    expect(state.meeting.actions[0].status).toBe("Open");
  });

  it("records only the job fields worth a history entry", () => {
    const job = { start: "2026-08-10", end: "2026-08-14", teamId: "a", status: "provisional", value: 5000, readiness: { rams: false } };

    expect(diffJobChanges(job, { start: "2026-08-17" })).toEqual([{ field: "start", from: "2026-08-10", to: "2026-08-17" }]);
    expect(diffJobChanges(job, { teamId: "b", status: "confirmed" })).toEqual([
      { field: "teamId", from: "a", to: "b" },
      { field: "status", from: "provisional", to: "confirmed" },
    ]);
    // Ticking a readiness box is not a scheduling decision.
    expect(diffJobChanges(job, { readiness: { rams: true } })).toEqual([]);
    // Setting a field to what it already was is not a change.
    expect(diffJobChanges(job, { start: "2026-08-10", value: "5000" })).toEqual([]);
    expect(diffJobChanges(null, { start: "2026-08-17" })).toEqual([]);
  });

  it("validates and merges the change log from both devices, newest first", () => {
    const state = normaliseManagementState({
      history: [
        { id: "h1", jobId: "j1", jobName: "Dig", field: "start", from: "2026-08-10", to: "2026-08-17", at: "2026-08-05T09:00:00.000Z", by: "Jo" },
        { id: "h2", jobId: "j1", field: "readiness", at: "nonsense" },
        { id: "h3", field: "start", at: "2026-08-05T09:00:00.000Z" },
      ],
    });
    // Untracked field and missing job id are dropped.
    expect(state.history.map((entry) => entry.id)).toEqual(["h1"]);

    const merged = mergeManagementStates(
      { history: [{ id: "h1", jobId: "j1", field: "start", at: "2026-08-01T09:00:00.000Z" }] },
      { history: [{ id: "h2", jobId: "j1", field: "status", at: "2026-08-06T09:00:00.000Z" }] }
    );
    expect(merged.history.map((entry) => entry.id)).toEqual(["h2", "h1"]);
  });

  it("moves a job while keeping its duration", () => {
    const job = { start: "2026-08-10", end: "2026-08-14" };
    expect(shiftJobDates(job, 7)).toEqual({ start: "2026-08-17", end: "2026-08-21" });
    expect(shiftJobDates(job, -3)).toEqual({ start: "2026-08-07", end: "2026-08-11" });
    // A single-day job stays a single-day job.
    expect(shiftJobDates({ start: "2026-08-10" }, 1)).toEqual({ start: "2026-08-11", end: "2026-08-11" });
    // Nothing to write back.
    expect(shiftJobDates(job, 0)).toBeNull();
    expect(shiftJobDates({ start: "" }, 5)).toBeNull();
  });

  it("converts a drag distance into whole days and keeps the bar in the window", () => {
    const weeks = buildPlannerWeeks(new Date("2026-08-05T12:00:00"), 2); // 3 Aug - 16 Aug
    // 14 days across a 700px track: 50px per day.
    expect(plannerDaysFromDelta(150, 700, 2)).toBe(3);
    expect(plannerDaysFromDelta(-120, 700, 2)).toBe(-2);
    expect(plannerDaysFromDelta(20, 700, 2)).toBe(0);
    expect(plannerDaysFromDelta(100, 0, 2)).toBe(0);

    const job = { start: "2026-08-10", end: "2026-08-12" };
    expect(clampPlannerShift(job, 2, weeks)).toBe(2);
    // Dragged far right: the start is pinned to the last day still on screen.
    expect(clampPlannerShift(job, 99, weeks)).toBe(6);
    // Dragged far left: pinned to the first day of the window.
    expect(clampPlannerShift(job, -99, weeks)).toBe(-7);
  });

  it("takes leave and shutdowns off a team's available days", () => {
    const august = new Date("2026-08-01T12:00:00");
    const team = { id: "a", capacity: 5 };
    const jobs = [{ teamId: "a", start: "2026-08-03", end: "2026-08-07", status: "confirmed" }];

    const before = monthCapacity(jobs, team, august);
    const after = monthCapacity(jobs, { ...team, daysOff: [{ id: "off1", from: "2026-08-17", to: "2026-08-21", label: "Shutdown" }] }, august);

    expect(after.lostDays).toBe(5);
    expect(after.total).toBe(before.total - 5);
    // Same booked days over fewer available days means a higher utilisation figure.
    expect(after.percentage).toBeGreaterThan(before.percentage);

    // Leave outside the month changes nothing.
    expect(monthCapacity(jobs, { ...team, daysOff: [{ id: "off2", from: "2026-10-05", to: "2026-10-09" }] }, august).total).toBe(before.total);
  });

  it("takes public holidays off capacity without double-counting booked leave", () => {
    const december = new Date("2026-12-01T12:00:00");
    const team = { id: "a", capacity: 5 };
    const jobs = [];
    // 25 Dec 2026 is a Friday, 28 Dec the substitute Monday for Boxing Day.
    const holidays = ["2026-12-25", "2026-12-28"];

    const plain = monthCapacity(jobs, team, december);
    const withHolidays = monthCapacity(jobs, team, december, holidays);
    expect(withHolidays.lostDays).toBe(2);
    expect(withHolidays.total).toBe(plain.total - 2);

    // A shutdown covering both holidays must not subtract them twice.
    const shutdown = { ...team, daysOff: [{ id: "o1", from: "2026-12-24", to: "2026-12-31" }] };
    const overlapping = monthCapacity(jobs, shutdown, december, holidays);
    expect(overlapping.lostDays).toBe(6); // 24, 25, 28, 29, 30, 31 — weekdays only, counted once
    expect(monthCapacity(jobs, shutdown, december).lostDays).toBe(6);

    // A crew that works bank holidays keeps them.
    expect(monthCapacity(jobs, { ...team, worksPublicHolidays: true }, december, holidays).lostDays).toBe(0);
  });

  it("feeds the same holidays into gap detection as into the forecast", () => {
    const teams = [{ id: "a", name: "Alpha", capacity: 5 }];
    const anchor = new Date("2026-12-01T12:00:00");
    const withHolidays = buildManagementDiary([], teams, anchor, ["2026-12-25", "2026-12-28"]);
    const without = buildManagementDiary([], teams, anchor);
    const december = (diary) => diary.gaps.find((gap) => gap.monthKey === "2026-12");
    expect(december(withHolidays).total).toBe(december(without).total - 2);
  });

  it("keeps days off inside the document schema", () => {
    const state = normaliseManagementState({
      teams: [{ id: "a", name: "North", daysOff: [{ id: "o1", label: "Shutdown", from: "2026-08-21", to: "2026-08-17" }, { from: "" }] }],
    });
    // A reversed range is clamped rather than silently inverting the maths.
    expect(state.teams[0].daysOff).toEqual([{ id: "o1", label: "Shutdown", from: "2026-08-21", to: "2026-08-21" }]);
  });

  it("lists what is mobilising and what would stop it", () => {
    const jobs = [
      { id: "soon", name: "Salford dig", teamId: "a", start: "2026-08-07", end: "2026-08-11", status: "confirmed", readiness: { dates: true, team: true, rams: false, permits: false, survey: true, client: true } },
      { id: "ready", name: "Derby pull", teamId: "b", start: "2026-08-12", end: "2026-08-14", status: "confirmed", readiness: { dates: true, team: true, rams: true, permits: true, survey: true, client: true } },
      { id: "far", name: "Later work", teamId: "a", start: "2026-09-20", end: "2026-09-24", status: "confirmed", readiness: {} },
      { id: "done", name: "Closed", teamId: "a", start: "2026-08-06", end: "2026-08-07", status: "completed", readiness: {} },
    ];
    const crewByTeam = new Map([["a", { count: 2 }], ["b", { count: 0 }]]);
    const watch = buildMobilisationWatch(jobs, { today: "2026-08-05", crewByTeam });

    expect(watch.map((row) => row.job.id)).toEqual(["soon", "ready"]);
    expect(watch[0]).toMatchObject({ daysToStart: 2, severity: "critical" });
    expect(watch[0].missing).toEqual(["RAMS", "Permits"]);
    // Derby's team is named but nobody is rostered to it.
    expect(watch[1]).toMatchObject({ crewMissing: true, severity: "warning" });
    expect(watch[1].issues).toEqual(["Crew"]);
  });

  it("names the method statement the way the market does", () => {
    const jobs = [{ id: "j1", name: "Dig", teamId: "a", start: "2026-08-07", end: "2026-08-11", status: "confirmed", readiness: { dates: true, team: true, rams: false, permits: true, survey: true, client: true } }];
    const options = { today: "2026-08-05" };

    expect(buildMobilisationWatch(jobs, options)[0].missing).toEqual(["RAMS"]);
    expect(buildMobilisationWatch(jobs, { ...options, ramsLabel: "SWMS" })[0].missing).toEqual(["SWMS"]);
    expect(buildMobilisationWatch(jobs, { ...options, ramsLabel: "IOR" })[0].issues).toEqual(["IOR"]);
  });

  it("totals contract value and rejects nonsense amounts", () => {
    // 2500.555 is stored as 2500.5549…, so rounding to the penny gives .55 — not a bug, a double.
    expect(sumJobValue([{ value: 1000 }, { value: "2500.555" }, { value: -5 }, { value: "abc" }, {}])).toBe(3500.55);
    expect(cleanMoney(1e12)).toBe(1_000_000_000);
    expect(cleanMoney(Infinity)).toBe(0);
  });

  it("archives meetings and carries the history through validation", () => {
    const state = normaliseManagementState({
      meetings: [
        { id: "m1", title: "Weekly", closedOn: "2026-08-01", notes: "Long note", actions: [{ id: "a1", text: "Chase permit", status: "Open" }] },
        { id: "m2", title: "", closedOn: "nope", actions: "not-an-array" },
      ],
    });

    expect(state.meetings).toHaveLength(2);
    expect(state.meetings[0]).toMatchObject({ id: "m1", title: "Weekly", closedOn: "2026-08-01" });
    expect(state.meetings[0].actions[0].text).toBe("Chase permit");
    expect(state.meetings[1]).toMatchObject({ title: "Management meeting", closedOn: "", actions: [] });
  });

  it("merges archived meetings from both sides without duplicating them", () => {
    const merged = mergeManagementStates(
      { meetings: [{ id: "m1", title: "Remote minutes" }] },
      { meetings: [{ id: "m1", title: "Local edit" }, { id: "m2", title: "Local minutes" }] }
    );
    expect(merged.meetings.map((meeting) => meeting.id)).toEqual(["m1", "m2"]);
    expect(merged.meetings[0].title).toBe("Local edit");
  });

  it("cleans text and dates", () => {
    expect(cleanText("  spaced   out  ", 50)).toBe("spaced out");
    expect(cleanText("x".repeat(80), 10)).toHaveLength(10);
    expect(cleanIsoDate("2026-08-03")).toBe("2026-08-03");
    expect(cleanIsoDate("2026-13-01")).toBe("");
    expect(cleanIsoDate("2026-02-30")).toBe("");
    expect(cleanIsoDate("")).toBe("");
  });
});
