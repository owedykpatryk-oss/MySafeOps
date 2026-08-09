import { describe, expect, it } from "vitest";
import { buildManagementJobs, deriveReadiness } from "./managementJobs";

const PROJECTS = [
  { id: "p1", name: "Manchester dig", client: "Acme", site: "M1", timelineStart: "2026-08-10", timelineEnd: "2026-08-14" },
  { id: "p2", name: "", client: "", postcode: "LS1" },
];

describe("management jobs", () => {
  it("overlays management scheduling on the project register", () => {
    const jobs = buildManagementJobs(PROJECTS, [], {
      teams: [],
      jobs: { p1: { start: "2026-08-17", end: "2026-08-21", teamId: "a", status: "confirmed", value: 9000 } },
      opportunities: [{ id: "o1", name: "Leeds lead", client: "Prospect", site: "LS", start: "2026-09-01", end: "2026-09-03" }],
      meeting: { actions: [] },
    });

    expect(jobs).toHaveLength(3);
    // Management dates win over the project timeline.
    expect(jobs[0]).toMatchObject({ id: "p1", start: "2026-08-17", end: "2026-08-21", teamId: "a", value: 9000, source: "project" });
    // Missing project fields fall back to something printable.
    expect(jobs[1]).toMatchObject({ name: "Unnamed project", client: "Client not set", site: "LS1" });
    expect(jobs[2]).toMatchObject({ id: "o1", source: "opportunity", documentCounts: { rams: 0, permits: 0, surveys: 0 } });
  });

  it("falls back to the project timeline when management has not scheduled the job", () => {
    const jobs = buildManagementJobs(PROJECTS, [], { teams: [], jobs: {}, opportunities: [], meeting: { actions: [] } });
    expect(jobs[0]).toMatchObject({ start: "2026-08-10", end: "2026-08-14", status: "provisional", teamId: "" });
  });

  it("normalises a raw document rather than trusting it", () => {
    const jobs = buildManagementJobs(PROJECTS, [], {
      jobs: { p1: { status: "root", start: "2026-02-30", value: -100 } },
      opportunities: "nope",
    });
    expect(jobs[0].status).toBe("provisional");
    // An impossible date is discarded, so the project timeline is used instead.
    expect(jobs[0].start).toBe("2026-08-10");
    expect(jobs[0].value).toBe(0);
    expect(jobs).toHaveLength(2);
  });

  it("keeps a stored readiness answer and derives one otherwise", () => {
    const stored = { dates: true, team: true, rams: true, permits: true, survey: true, client: true };
    expect(deriveReadiness(PROJECTS[0], { rams: [], permitReady: { complete: false }, surveys: [] }, { readiness: stored })).toBe(stored);

    const derived = deriveReadiness(
      PROJECTS[0],
      { rams: [{ id: "r1" }], permitReady: { complete: true }, surveys: [] },
      { teamId: "a" },
    );
    expect(derived).toMatchObject({ dates: true, team: true, rams: true, permits: true, survey: false, client: true });
  });
});
