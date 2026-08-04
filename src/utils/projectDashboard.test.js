import { describe, expect, it } from "vitest";
import {
  buildProjectActivityFeed,
  collectProjectDashboard,
  filterByProject,
  sortByRecent,
  summarizeTimesheetsForProject,
} from "./projectDashboard";

import { localDateISO } from "./localDate";
describe("projectDashboard", () => {
  it("filters and sorts by recent timestamp", () => {
    const rows = [
      { id: "a", projectId: "p1", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", projectId: "p2", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "c", projectId: "p1", createdAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(filterByProject("p1", rows).map((r) => r.id)).toEqual(["a", "c"]);
    expect(sortByRecent(filterByProject("p1", rows)).map((r) => r.id)).toEqual(["c", "a"]);
  });

  it("aggregates linked documents for a project", () => {
    const project = { id: "p1", name: "Alpha", defaultPermitFlow: [] };
    const dash = collectProjectDashboard(project, [
      { id: "w1", name: "Bob", projectIds: ["p1"] },
    ]);
    expect(dash.team).toHaveLength(1);
    expect(dash.totals).toMatchObject({
      documents: 0,
      openSnags: 0,
      activePermits: 0,
      briefingToday: false,
    });
    expect(dash.dailyBriefings).toEqual([]);
    expect(dash.cdmPacks).toEqual([]);
  });

  it("summarises timesheet hours for the current week", () => {
    const weekKey = new Date();
    const day = weekKey.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekKey.setDate(weekKey.getDate() + diff);
    weekKey.setHours(0, 0, 0, 0);
    const summary = summarizeTimesheetsForProject(
      [
        { id: "t1", projectId: "p1", weekKey: localDateISO(weekKey), days: { Mon: 4, Tue: 4 } },
        { id: "t2", projectId: "p2", weekKey: localDateISO(weekKey), days: { Mon: 8 } },
      ],
      "p1"
    );
    expect(summary.hoursThisWeek).toBe(8);
    expect(summary.all).toHaveLength(1);
  });

  it("builds activity feed from document types", () => {
    const feed = buildProjectActivityFeed("p1", {
      rams: [{ id: "r1", projectId: "p1", title: "Roof works", updatedAt: "2026-06-01T00:00:00.000Z" }],
      permits: [{ id: "pt1", projectId: "p1", type: "hot_work", location: "Zone A", createdAt: "2026-05-01T00:00:00.000Z" }],
    });
    expect(feed.length).toBe(2);
    expect(feed[0].text).toContain("RAMS");
  });
});
