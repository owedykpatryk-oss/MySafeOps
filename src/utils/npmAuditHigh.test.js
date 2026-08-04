import { describe, expect, it } from "vitest";
import { isReactRouterPatchedForGhsaQwww } from "../../scripts/npm-audit-high.mjs";

describe("isReactRouterPatchedForGhsaQwww", () => {
  it("treats upstream v7 patch floor as fixed", () => {
    expect(isReactRouterPatchedForGhsaQwww("7.18.2")).toBe(true);
    expect(isReactRouterPatchedForGhsaQwww("7.18.1")).toBe(false);
    expect(isReactRouterPatchedForGhsaQwww("7.11.0")).toBe(false);
    expect(isReactRouterPatchedForGhsaQwww("7.19.0")).toBe(true);
  });

  it("treats upstream v8 patch floor as fixed", () => {
    expect(isReactRouterPatchedForGhsaQwww("8.3.0")).toBe(true);
    expect(isReactRouterPatchedForGhsaQwww("8.2.0")).toBe(false);
    expect(isReactRouterPatchedForGhsaQwww("9.0.0")).toBe(true);
  });
});
