/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId, saveOrgScoped as save } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { syncFessMsFromRams, findMsLinkedToRams } from "./fessMsSync";

describe("fessMsSync", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("creates linked MS from RAMS method statement", () => {
    const rams = {
      id: "rams_1",
      projectId: "proj_1",
      title: "RAMS — DOLAV works",
      jobRef: "FP1-DOLAV-2026-100",
      scope: "DOLAV station M&E",
      surveyMethodStatement: "1. Isolate services.\n\n2. Install pipework.\n\n3. Test and validate.",
      permitControllerName: "Site permit controller",
    };
    const result = syncFessMsFromRams(rams, { createIfMissing: true });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.ms?.relatedRamsId).toBe("rams_1");
    expect(result.ms?.steps?.length).toBeGreaterThanOrEqual(3);
    expect(findMsLinkedToRams("rams_1")?.jobRef).toBe("FP1-DOLAV-2026-100");
  });

  it("updates existing MS when RAMS changes", () => {
    save("method_statements", [
      {
        id: "ms_1",
        projectId: "proj_1",
        relatedRamsId: "rams_1",
        steps: [{ id: "s1", seq: 1, title: "Old", description: "Old step" }],
      },
    ]);
    const rams = {
      id: "rams_1",
      projectId: "proj_1",
      title: "RAMS — test",
      surveyMethodStatement: "1. New step one.\n\n2. New step two.",
    };
    const result = syncFessMsFromRams(rams);
    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.ms?.steps?.length).toBe(2);
  });

  it("returns not_fess for other orgs", () => {
    setOrgId("acme");
    expect(syncFessMsFromRams({ id: "r1", projectId: "p1" }).reason).toBe("not_fess");
  });
});
