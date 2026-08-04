import { describe, expect, it } from "vitest";
import { marketsByRolloutStatus, roadmapEntryFor } from "./marketRoadmap";

describe("marketRoadmap", () => {
  it("lists Poland as beta with planned IE and NZ", () => {
    expect(roadmapEntryFor("pl")?.status).toBe("beta");
    expect(roadmapEntryFor("nz")?.status).toBe("planned");
    expect(roadmapEntryFor("ie")?.status).toBe("planned");
  });

  it("includes live markets", () => {
    const live = marketsByRolloutStatus("live").map((m) => m.id);
    expect(live).toContain("uk");
    expect(live).toContain("au");
  });
});
