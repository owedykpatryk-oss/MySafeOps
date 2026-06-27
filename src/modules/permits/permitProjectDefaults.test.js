import { describe, it, expect } from "vitest";
import {
  missingRequiredPermits,
  permitReadinessForProject,
  requiredPermitTypesForProject,
} from "./permitProjectDefaults";

describe("permitProjectDefaults", () => {
  const project = {
    id: "p1",
    permitDefaults: { requiredPermitTypes: ["hot_work", "excavation"] },
  };

  it("lists missing required types", () => {
    const permits = [{ projectId: "p1", type: "hot_work", status: "active", location: "Zone A" }];
    expect(missingRequiredPermits(project, permits)).toEqual(["excavation"]);
    expect(permitReadinessForProject(project, permits)).toMatchObject({ required: 2, issued: 1, complete: false });
  });

  it("returns empty when no defaults", () => {
    expect(requiredPermitTypesForProject({ id: "x" })).toEqual([]);
    expect(missingRequiredPermits({ id: "x" }, [])).toEqual([]);
  });
});
