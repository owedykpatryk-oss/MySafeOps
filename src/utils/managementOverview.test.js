import { describe, expect, it } from "vitest";
import {
  buildPlannerWeeks,
  consolidateManagementStates,
  jobTone,
  mergeManagementStates,
  monthCapacity,
  normaliseManagementState,
  plannerPosition,
  readinessForJob,
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
});
