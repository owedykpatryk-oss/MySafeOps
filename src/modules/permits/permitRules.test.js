import { describe, it, expect } from "vitest";
import { derivePermitStatus, permitEndIso, buildPermitWarRoomStats, permitsHeatmap } from "./permitRules";
import { PERMIT_TYPES } from "./permitTypes";

describe("permitRules", () => {
  const now = new Date("2026-04-09T12:00:00.000Z");

  it("permitEndIso prefers endDateTime", () => {
    expect(permitEndIso({ endDateTime: "2026-04-10T00:00:00.000Z", expiryDate: "2026-04-11T00:00:00.000Z" })).toBe("2026-04-10T00:00:00.000Z");
  });

  it("derivePermitStatus returns expired for past active permit", () => {
    const p = { status: "active", endDateTime: "2026-04-08T00:00:00.000Z" };
    expect(derivePermitStatus(p, now)).toBe("expired");
  });

  it("buildPermitWarRoomStats counts buckets", () => {
    const permits = [
      { status: "active", endDateTime: "2026-04-09T14:00:00.000Z" },
      { status: "active", endDateTime: "2026-04-08T00:00:00.000Z" },
      { status: "draft" },
      { status: "closed" },
    ];
    const s = buildPermitWarRoomStats(permits, now);
    expect(s.active).toBe(1);
    expect(s.expired).toBe(1);
    expect(s.draft).toBe(1);
    expect(s.closed).toBe(1);
  });

  it("permitsHeatmap aligns with types", () => {
    const permits = [{ type: "hot_work", status: "draft" }];
    const rows = permitsHeatmap(permits, PERMIT_TYPES);
    const hw = rows.find((r) => r.type === "hot_work");
    expect(hw?.draft).toBe(1);
  });
});
