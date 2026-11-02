/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorkspaceSearchHits } from "./workspaceSearch";

const mocks = vi.hoisted(() => ({ records: {}, hidden: [] }));
vi.mock("./orgStorage", () => ({ loadOrgScoped: (key, fallback) => mocks.records[key] ?? fallback }));
vi.mock("./hiddenModules", () => ({
  getHiddenModuleIds: () => mocks.hidden,
  isModuleVisible: (id, { hiddenModules }) => !hiddenModules.includes(id),
}));

beforeEach(() => { mocks.records = {}; mocks.hidden = []; });

describe("workspace search records", () => {
  it("keeps the specific record and navigation action for projects and documents", () => {
    mocks.records.mysafeops_projects = [{ id: "project-1", name: "Orchard site" }];
    mocks.records.rams_builder_docs = [{ id: "rams-1", title: "Orchard excavation", projectId: "project-1" }];
    const hits = buildWorkspaceSearchHits("orchard");
    expect(hits.find((row) => row.kind === "Project")).toMatchObject({ projectId: "project-1", action: "viewProjectDashboard" });
    expect(hits.find((row) => row.kind === "RAMS")).toMatchObject({ ramsId: "rams-1", projectId: "project-1", action: "edit" });
  });
  it("excludes deleted records and tolerates null rows or invalid stored arrays", () => {
    for (const key of ["mysafeops_workers", "mysafeops_projects", "rams_builder_docs", "permits_v2", "snags", "survey_reports", "geo_photos"]) {
      mocks.records[key] = [null, { id: "deleted", name: "Orchard", title: "Orchard", description: "Orchard", notes: "Orchard", deletedAt: "2026-10-05" }];
    }
    expect(buildWorkspaceSearchHits("orchard")).toEqual([]);
    mocks.records.mysafeops_workers = { unexpected: true };
    expect(buildWorkspaceSearchHits("orchard")).toEqual([]);
  });
  it("does not offer records from hidden modules", () => {
    mocks.records.snags = [{ id: "snag-1", title: "Orchard snag" }];
    mocks.hidden = ["snags"];
    expect(buildWorkspaceSearchHits("orchard")).toEqual([]);
  });
});
