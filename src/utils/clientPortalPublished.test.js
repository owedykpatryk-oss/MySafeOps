/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { loadPublishedPortalTokens, markPortalPublished, unmarkPortalPublished } from "./clientPortalPublished";

describe("clientPortalPublished", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "org-a");
  });

  it("tracks published portal tokens per org", () => {
    expect(loadPublishedPortalTokens().size).toBe(0);
    markPortalPublished("token-1");
    expect(loadPublishedPortalTokens().has("token-1")).toBe(true);
    unmarkPortalPublished("token-1");
    expect(loadPublishedPortalTokens().has("token-1")).toBe(false);
  });
});
