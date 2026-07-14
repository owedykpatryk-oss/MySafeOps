import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PERMIT_GUIDE_STORAGE_KEY,
  isPermitGuideComplete,
  markPermitGuideComplete,
  resetPermitGuide,
} from "./permitGuideStorage";

vi.mock("./orgStorage", () => ({
  loadOrgScoped: vi.fn(() => null),
  saveOrgScoped: vi.fn(),
}));

import { loadOrgScoped, saveOrgScoped } from "./orgStorage";

describe("permitGuideStorage", () => {
  beforeEach(() => {
    vi.mocked(loadOrgScoped).mockReturnValue(null);
    vi.mocked(saveOrgScoped).mockClear();
  });

  it("reports incomplete when no saved state", () => {
    expect(isPermitGuideComplete()).toBe(false);
  });

  it("marks guide complete with role", () => {
    markPermitGuideComplete("admin");
    expect(saveOrgScoped).toHaveBeenCalledWith(
      PERMIT_GUIDE_STORAGE_KEY,
      expect.objectContaining({ completed: true, role: "admin" })
    );
  });

  it("reports complete when saved flag is set", () => {
    vi.mocked(loadOrgScoped).mockReturnValue({ completed: true });
    expect(isPermitGuideComplete()).toBe(true);
  });

  it("reset clears completion", () => {
    resetPermitGuide();
    expect(saveOrgScoped).toHaveBeenCalledWith(
      PERMIT_GUIDE_STORAGE_KEY,
      expect.objectContaining({ completed: false })
    );
  });
});
