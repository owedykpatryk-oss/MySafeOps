import { describe, expect, it } from "vitest";
import {
  liveOrgArrayRows,
  mergeOrgArrays,
  replaceWithTombstone,
} from "./d1ArrayMerge.js";

describe("mergeOrgArrays", () => {
  it("keeps local-only rows when server is older", () => {
    const server = [{ id: "a", name: "Alpha", updatedAt: "2026-01-01T00:00:00.000Z" }];
    const local = [
      { id: "a", name: "Alpha", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", name: "New project", updatedAt: "2026-07-14T10:00:00.000Z" },
    ];
    const merged = mergeOrgArrays(local, server);
    expect(merged.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("prefers newer updatedAt when ids overlap", () => {
    const server = [{ id: "a", name: "Server", updatedAt: "2026-07-14T12:00:00.000Z" }];
    const local = [{ id: "a", name: "Local", updatedAt: "2026-07-14T09:00:00.000Z" }];
    const merged = mergeOrgArrays(local, server);
    expect(merged[0].name).toBe("Server");
  });

  it("prefers local when it is newer", () => {
    const server = [{ id: "a", name: "Server", updatedAt: "2026-07-14T09:00:00.000Z" }];
    const local = [{ id: "a", name: "Local", updatedAt: "2026-07-14T12:00:00.000Z" }];
    const merged = mergeOrgArrays(local, server);
    expect(merged[0].name).toBe("Local");
  });

  it("honours a newer tombstone so deletes do not resurrect", () => {
    const server = [
      {
        id: "permit-1",
        deletedAt: "2026-07-20T12:00:00.000Z",
        updatedAt: "2026-07-20T12:00:00.000Z",
      },
    ];
    const local = [
      {
        id: "permit-1",
        title: "Hot work",
        updatedAt: "2026-07-19T08:00:00.000Z",
      },
    ];
    const merged = mergeOrgArrays(local, server);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe("2026-07-20T12:00:00.000Z");
    expect(liveOrgArrayRows(merged)).toHaveLength(0);
  });

  it("keeps a live row when it is newer than an older tombstone", () => {
    const server = [
      {
        id: "permit-1",
        deletedAt: "2026-07-10T12:00:00.000Z",
        updatedAt: "2026-07-10T12:00:00.000Z",
      },
    ];
    const local = [
      {
        id: "permit-1",
        title: "Restored",
        updatedAt: "2026-07-20T08:00:00.000Z",
      },
    ];
    const merged = mergeOrgArrays(local, server);
    expect(merged[0].title).toBe("Restored");
    expect(merged[0].deletedAt).toBeUndefined();
    expect(liveOrgArrayRows(merged)).toHaveLength(1);
  });
});

describe("replaceWithTombstone", () => {
  it("removes the live row and appends a deletedAt tombstone", () => {
    const next = replaceWithTombstone(
      [
        { id: "a", name: "Keep" },
        { id: "b", name: "Gone" },
      ],
      "b",
      "2026-07-21T00:00:00.000Z"
    );
    expect(next.find((r) => r.id === "a")?.name).toBe("Keep");
    expect(next.find((r) => r.id === "b")).toEqual({
      id: "b",
      deletedAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    });
  });
});
