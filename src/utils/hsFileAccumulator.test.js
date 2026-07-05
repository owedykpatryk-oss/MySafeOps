import { describe, expect, it } from "vitest";
import { buildHealthSafetyFileInventory } from "./hsFileAccumulator";

describe("hsFileAccumulator", () => {
  it("returns empty for missing project", () => {
    expect(buildHealthSafetyFileInventory("").total).toBe(0);
  });

  it("includes issued RAMS and active permits for project", () => {
    const inv = buildHealthSafetyFileInventory("p1", {
      rams: [
        { id: "r1", projectId: "p1", title: "Site RAMS", status: "issued", updatedAt: "2026-01-02" },
        { id: "r2", projectId: "p1", title: "Draft", status: "draft" },
        { id: "r3", projectId: "p2", title: "Other", status: "issued" },
      ],
      permits: [{ id: "pt1", projectId: "p1", type: "hot_work", status: "active", updatedAt: "2026-01-03" }],
    });
    expect(inv.total).toBe(2);
    expect(inv.counts.RAMS).toBe(1);
    expect(inv.counts.PTW).toBe(1);
    expect(inv.items[0].type).toBe("PTW");
  });
});
