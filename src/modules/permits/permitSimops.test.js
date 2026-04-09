import { describe, it, expect } from "vitest";
import { findSimopsConflicts, buildSimopsConflictMap } from "./permitSimops";

describe("findSimopsConflicts", () => {
  const existing = [
    {
      id: "p1",
      status: "active",
      location: "Warehouse 2",
      startDateTime: "2026-04-09T08:00:00.000Z",
      endDateTime: "2026-04-09T12:00:00.000Z",
    },
  ];

  it("returns empty when location empty", () => {
    expect(findSimopsConflicts({ location: "", startDateTime: "2026-04-09T09:00:00.000Z", endDateTime: "2026-04-09T11:00:00.000Z" }, existing).length).toBe(0);
  });

  it("detects overlapping window at same location", () => {
    const candidate = {
      id: "p2",
      type: "hot_work",
      location: "Warehouse 2",
      startDateTime: "2026-04-09T10:00:00.000Z",
      endDateTime: "2026-04-09T14:00:00.000Z",
      status: "active",
    };
    const hits = findSimopsConflicts(candidate, existing);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("p1");
  });

  it("ignores ignoreId", () => {
    const hits = findSimopsConflicts(
      { ...existing[0], startDateTime: "2026-04-09T09:00:00.000Z", endDateTime: "2026-04-09T11:00:00.000Z" },
      existing,
      { ignoreId: "p1" }
    );
    expect(hits).toHaveLength(0);
  });
});

describe("buildSimopsConflictMap", () => {
  it("maps each permit to overlapping peers at same location", () => {
    const permits = [
      {
        id: "a",
        status: "active",
        location: "Bay 1",
        startDateTime: "2026-04-09T08:00:00.000Z",
        endDateTime: "2026-04-09T12:00:00.000Z",
      },
      {
        id: "b",
        status: "active",
        location: "Bay 1",
        startDateTime: "2026-04-09T10:00:00.000Z",
        endDateTime: "2026-04-09T14:00:00.000Z",
      },
    ];
    const map = buildSimopsConflictMap(permits);
    expect(map.get("a")).toHaveLength(1);
    expect(map.get("a")[0].id).toBe("b");
    expect(map.get("b")).toHaveLength(1);
    expect(map.get("b")[0].id).toBe("a");
  });
});
