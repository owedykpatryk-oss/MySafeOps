/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { setOrgId, saveOrgScoped as save } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { buildFessWorkspacePulse } from "./fessPulse";
import { seedFessSitePortals } from "./fessPortalPreset";

describe("fessPulse", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", slug: "fess-group" });
  });

  it("returns empty for non-FESS org", () => {
    setOrgId("acme");
    saveOrgSettingsRaw({ name: "Acme Ltd" });
    expect(buildFessWorkspacePulse({ rams: [{ status: "draft" }] }).items).toEqual([]);
  });

  it("flags line clearance and client approval gaps", () => {
    seedFessSitePortals();
    const pulse = buildFessWorkspacePulse({
      projects: [{ id: "p1", fessSiteTemplateId: "fess_site_quorn" }],
      rams: [
        { id: "r1", status: "issued", projectId: "p1" },
        { id: "r2", status: "draft" },
      ],
      permits: [{ id: "pt1", status: "active", type: "line_clearance", projectId: "p1" }],
      methodStatements: [],
      workers: [
        {
          id: "w1",
          name: "Test",
          projectIds: ["p1"],
          certifications: [{ certCode: "cscs", expiryDate: "2026-07-12" }],
        },
      ],
    });
    expect(pulse.items.some((i) => i.key === "line_clearance")).toBe(true);
    expect(pulse.items.some((i) => i.key === "client_approval")).toBe(true);
    expect(pulse.items.some((i) => i.key === "missing_ms")).toBe(true);
    expect(pulse.items.some((i) => i.key === "draft_rams")).toBe(true);
    expect(pulse.items.some((i) => i.key === "rams_incomplete")).toBe(true);
    expect(pulse.items.some((i) => i.key === "portal_unpublished")).toBe(true);
    expect(pulse.items.some((i) => i.key === "cert_expiry")).toBe(true);
  });
});
