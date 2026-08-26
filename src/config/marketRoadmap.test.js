import { describe, expect, it } from "vitest";
import { marketsByRolloutStatus, roadmapEntryFor } from "./marketRoadmap";

describe("marketRoadmap", () => {
  it("lists Poland, Germany, Austria and Switzerland as beta with planned IE, NZ", () => {
    expect(roadmapEntryFor("pl")?.status).toBe("beta");
    expect(roadmapEntryFor("de")?.status).toBe("beta");
    expect(roadmapEntryFor("at")?.status).toBe("beta");
    expect(roadmapEntryFor("ch")?.status).toBe("beta");
    expect(roadmapEntryFor("nz")?.status).toBe("planned");
    expect(roadmapEntryFor("ie")?.status).toBe("planned");
  });

  it("includes live markets", () => {
    const live = marketsByRolloutStatus("live").map((m) => m.id);
    expect(live).toContain("uk");
    expect(live).toContain("au");
  });
});
