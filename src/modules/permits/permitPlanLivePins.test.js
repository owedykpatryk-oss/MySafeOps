import { describe, it, expect } from "vitest";
import { resolvePermitPlanPin, permitsForPlan, simopsPairsForPlan } from "./permitPlanLivePins";

describe("permitPlanLivePins", () => {
  const objects = [
    { id: "obj_a", projectId: "proj1", planId: "plan1", placement: "plan", x: 20, y: 30, label: "Zone A", type: "zone" },
    { id: "obj_b", projectId: "proj1", planId: "plan1", placement: "plan", x: 80, y: 70, label: "Zone B", type: "zone" },
  ];

  it("resolvePermitPlanPin returns coordinates from linked drawing object", () => {
    const pin = resolvePermitPlanPin({ locationObjectId: "obj_a" }, objects);
    expect(pin).toEqual({ planId: "plan1", x: 20, y: 30, objectId: "obj_a", label: "Zone A" });
  });

  it("permitsForPlan filters by plan and status", () => {
    const permits = [
      { id: "p1", locationObjectId: "obj_a", status: "active", type: "hot_work" },
      { id: "p2", locationObjectId: "obj_b", status: "closed", type: "general" },
    ];
    const rows = permitsForPlan(permits, "plan1", objects);
    expect(rows).toHaveLength(1);
    expect(rows[0].permit.id).toBe("p1");
  });

  it("simopsPairsForPlan links conflicting permits on the same plan", () => {
    const placements = [
      { permit: { id: "p1" }, pin: { x: 10, y: 10 }, status: "active" },
      { permit: { id: "p2" }, pin: { x: 90, y: 90 }, status: "active" },
    ];
    const simopsMap = new Map([["p1", [{ id: "p2" }]]]);
    const pairs = simopsPairsForPlan(placements, simopsMap);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.permit.id).toBe("p1");
    expect(pairs[0].b.permit.id).toBe("p2");
  });
});
