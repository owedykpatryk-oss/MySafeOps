/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { buildPortalSnapshot, genPortalToken } from "./clientPortalCloud";
import { saveOrgScoped as save } from "./orgStorage";

describe("clientPortalCloud", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("genPortalToken returns uuid-like token", () => {
    const t = genPortalToken();
    expect(t.length).toBeGreaterThanOrEqual(16);
  });

  it("buildPortalSnapshot scopes rows by projectId", () => {
    save("mysafeops_workers", [
      { id: "w1", name: "A", projectIds: ["p1"] },
      { id: "w2", name: "B", projectIds: ["p2"] },
    ]);
    save("rams_builder_docs", [
      { id: "r1", title: "RAMS 1", projectId: "p1" },
      { id: "r2", title: "RAMS 2", projectId: "p2" },
    ]);
    const snap = buildPortalSnapshot({ projectId: "p1" });
    expect(snap.workers).toHaveLength(1);
    expect(snap.rams).toHaveLength(1);
    expect(snap.publishedAt).toBeTruthy();
  });

  it("buildPortalSnapshot redacts worker contact fields", () => {
    save("mysafeops_workers", [
      {
        id: "w1",
        name: "A",
        projectIds: ["p1"],
        email: "a@example.com",
        phone: "07000",
        niNumber: "AB123",
      },
    ]);
    const snap = buildPortalSnapshot({ projectId: "p1" });
    expect(snap.workers[0].name).toBe("A");
    expect(snap.workers[0].email).toBeUndefined();
    expect(snap.workers[0].phone).toBeUndefined();
    expect(snap.workers[0].niNumber).toBeUndefined();
  });

  it("buildPortalSnapshot tolerates corrupted non-array registers", () => {
    localStorage.setItem("snags_test-org", JSON.stringify({ broken: true }));
    const snap = buildPortalSnapshot({ projectId: "p1" });
    expect(snap.snags).toEqual([]);
  });
});
