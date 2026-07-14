import { describe, expect, it } from "vitest";
import { mergeOrgArrays } from "./d1ArrayMerge.js";

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
});
