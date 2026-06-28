import { describe, expect, it } from "vitest";
import {
  buildProjectActivityFeed,
  collectProjectDashboard,
  filterByProject,
  sortByRecent,
} from "./projectDashboard";

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
    expect(dash.totals).toMatchObject({ documents: 0, openSnags: 0, activePermits: 0 });
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
