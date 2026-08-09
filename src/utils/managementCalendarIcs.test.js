import { describe, expect, it } from "vitest";
import { buildManagementIcs, countIcsEvents, escapeIcsText, foldIcsLine, safeIcsUid } from "./managementCalendarIcs";

const NOW = new Date("2026-08-05T09:30:00Z");
const TEAMS = [{ id: "a", name: "North Team" }];
const JOBS = [
  {
    id: "job-1",
    name: "Manchester dig",
    client: "Acme",
    site: "M1 2AB",
    teamId: "a",
    start: "2026-08-10",
    end: "2026-08-12",
    status: "confirmed",
    readiness: { dates: true, team: true, rams: true, permits: true, survey: true, client: true },
  },
  {
    id: "job-2",
    name: "Leeds survey",
    client: "Prospect",
    site: "LS1",
    teamId: "a",
    start: "2026-09-01",
    end: "2026-09-02",
    status: "provisional",
    source: "opportunity",
    readiness: { dates: true, team: true, rams: false, permits: false, survey: false, client: false },
  },
  { id: "job-3", name: "Cancelled work", start: "2026-08-20", end: "2026-08-21", status: "cancelled" },
];

function eventBlocks(ics) {
  return ics.split("BEGIN:VEVENT").slice(1);
}

describe("management calendar ICS", () => {
  it("escapes text so a job name cannot inject its own property", () => {
    const escaped = escapeIcsText("Dig\r\nDESCRIPTION:stolen; really, yes");
    expect(escaped).toBe("Dig\\nDESCRIPTION:stolen\\; really\\, yes");
    expect(escaped.includes("\n")).toBe(false);
  });

  it("escapes backslashes before anything else", () => {
    expect(escapeIcsText("back\\slash")).toBe("back\\\\slash");
  });

  it("keeps uids opaque and folds long lines", () => {
    expect(safeIcsUid("../../etc/passwd\r\nX:1", "fallback")).toBe("....etcpasswdX1");
    expect(safeIcsUid("", "fallback")).toBe("fallback");
    const folded = foldIcsLine(`SUMMARY:${"x".repeat(200)}`);
    expect(folded.split("\r\n").every((line) => line.length <= 73)).toBe(true);
    expect(folded.split("\r\n").slice(1).every((line) => line.startsWith(" "))).toBe(true);
  });

  it("exports confirmed work and never exports cancelled work", () => {
    const ics = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: {}, now: NOW });
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTAMP:20260805T093000Z");
    expect(ics).toContain("SUMMARY:North Team · Manchester dig");
    expect(ics).not.toContain("Cancelled work");
    // Finish date is exclusive in an all-day VEVENT.
    expect(ics).toContain("DTEND;VALUE=DATE:20260813");
  });

  it("honours the provisional switch", () => {
    const withProvisional = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: { includeProvisional: true }, now: NOW });
    const withoutProvisional = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: { includeProvisional: false }, now: NOW });
    expect(withProvisional).toContain("Leeds survey");
    expect(withoutProvisional).not.toContain("Leeds survey");
  });

  it("honours the deadline and compliance switches", () => {
    const actions = [
      { id: "act-1", text: "Book traffic management", owner: "Sam", due: "2026-08-14", status: "Open" },
      { id: "act-2", text: "Closed already", due: "2026-08-14", status: "Done" },
    ];
    const all = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: {}, actions, now: NOW });
    expect(all).toContain("SUMMARY:Documents due: Leeds survey");
    expect(all).toContain("SUMMARY:Action due: Book traffic management");
    expect(all).not.toContain("Closed already");

    const off = buildManagementIcs({
      jobs: JOBS,
      teams: TEAMS,
      calendar: { includeDeadlines: false, includeCompliance: false },
      actions,
      now: NOW,
    });
    expect(off).not.toContain("Documents due");
    expect(off).not.toContain("Action due");
    expect(countIcsEvents(off)).toBe(2);
  });

  it("names the outstanding document the way the market does", () => {
    const uk = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: {}, now: NOW });
    expect(uk).toContain("Outstanding before mobilisation: RAMS");

    const au = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: {}, now: NOW, ramsLabel: "SWMS" });
    expect(au).toContain("Outstanding before mobilisation: SWMS");
    expect(au).not.toContain("RAMS");
  });

  it("drops the team prefix when separate team calendars are off", () => {
    const ics = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: { separateTeamCalendars: false }, now: NOW });
    expect(ics).toContain("SUMMARY:Manchester dig");
    expect(ics).not.toContain("SUMMARY:North Team · Manchester dig");
  });

  it("marks provisional work as tentative and gives every event a stamp", () => {
    const ics = buildManagementIcs({ jobs: JOBS, teams: TEAMS, calendar: {}, now: NOW });
    const blocks = eventBlocks(ics);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((block) => block.includes("DTSTAMP:"))).toBe(true);
    expect(blocks.every((block) => block.includes("UID:"))).toBe(true);
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("STATUS:TENTATIVE");
  });
});
