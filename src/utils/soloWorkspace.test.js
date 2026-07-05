import { describe, expect, it } from "vitest";
import {
  applySoloProjectRoles,
  buildStartupChecklist,
  deriveUserDisplayName,
  isSoloWorkspace,
  projectMissingItems,
  projectHealthScore,
} from "./soloWorkspace.js";

describe("soloWorkspace", () => {
  it("detects solo workspace", () => {
    expect(isSoloWorkspace([])).toBe(true);
    expect(isSoloWorkspace([{ id: "1" }])).toBe(true);
    expect(isSoloWorkspace([{ id: "1" }, { id: "2" }])).toBe(false);
  });

  it("derives display name from user metadata or email", () => {
    expect(deriveUserDisplayName({ email: "pat.owedyk@gmail.com", user_metadata: { full_name: "Pat O" } })).toBe("Pat O");
    expect(deriveUserDisplayName({ email: "solo.builder@example.com" })).toBe("solo builder");
  });

  it("relaxes go-live requirements in solo mode", () => {
    const form = {
      name: "Demo",
      site: "Client",
      address: "1 High St",
      soloLeadName: "Pat",
      timelineStart: "2026-07-01",
      timelineEnd: "2026-08-01",
      soloMode: true,
    };
    expect(projectMissingItems(form)).toEqual([]);
    expect(projectHealthScore(form)).toBeGreaterThanOrEqual(70);
  });

  it("builds solo-friendly startup checklist", () => {
    const items = buildStartupChecklist(
      { soloMode: true, industryStarter: "general" },
      { preset: { starterChecklist: ["Assign HSE lead and permit approver"] } }
    );
    expect(items.some((x) => /owner, HSE lead and permit approver/i.test(x.text))).toBe(true);
    expect(items.some((x) => /Assign HSE lead/i.test(x.text))).toBe(false);
    expect(items.some((x) => /emergency contacts/i.test(x.text))).toBe(true);
  });

  it("applySoloProjectRoles fills role fields", () => {
    const next = applySoloProjectRoles({ name: "Site A" }, "Alex Smith");
    expect(next.owner).toBe("Alex Smith");
    expect(next.hseLead).toBe("Alex Smith");
    expect(next.soloMode).toBe(true);
  });
});
