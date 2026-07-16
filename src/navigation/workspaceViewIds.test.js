import { describe, expect, it } from "vitest";
import { WORKSPACE_VIEW_IDS, WORKSPACE_VIEW_ID_SET } from "./workspaceViewIds.js";
import { workspaceViewLoaders } from "./workspaceViews.js";

describe("workspaceViewIds", () => {
  it("matches workspaceViewLoaders keys (no drift)", () => {
    const loaderKeys = Object.keys(workspaceViewLoaders).sort();
    const idKeys = [...WORKSPACE_VIEW_IDS].sort();
    expect(idKeys).toEqual(loaderKeys);
    expect(WORKSPACE_VIEW_ID_SET.size).toBe(loaderKeys.length);
  });
});
