import { describe, expect, it } from "vitest";
import { assessCdmF10Notification, f10StatusLabel, f10StatusTone } from "./cdmF10Assessment";

describe("cdmF10Assessment", () => {
  it("is not notifiable below all thresholds", () => {
    const a = assessCdmF10Notification({ estimatedPersonDays: 400, estimatedWorkers: 15, calendarPhaseDays: 25 });
    expect(a.notifiable).toBe(false);
    expect(a.f10Required).toBe(false);
  });

  it("is notifiable when person-days exceed 500", () => {
    const a = assessCdmF10Notification({ estimatedPersonDays: 501, estimatedWorkers: 5, calendarPhaseDays: 10 });
    expect(a.notifiable).toBe(true);
    expect(a.reasons[0]).toContain("501");
  });

  it("is notifiable when >30 working days AND >20 workers", () => {
    const a = assessCdmF10Notification({ estimatedPersonDays: 100, estimatedWorkers: 21, calendarPhaseDays: 31 });
    expect(a.notifiable).toBe(true);
  });

  it("is not notifiable with only high workers or only long duration", () => {
    expect(assessCdmF10Notification({ estimatedWorkers: 25, calendarPhaseDays: 20 }).notifiable).toBe(false);
    expect(assessCdmF10Notification({ estimatedWorkers: 10, calendarPhaseDays: 45 }).notifiable).toBe(false);
  });

  it("status label reflects F10 submission", () => {
    expect(f10StatusLabel(assessCdmF10Notification({ estimatedPersonDays: 600 }))).toBe("F10 required — not submitted");
    expect(
      f10StatusLabel(assessCdmF10Notification({ estimatedPersonDays: 600, f10Submitted: true }))
    ).toBe("F10 submitted");
    expect(f10StatusTone(assessCdmF10Notification({ estimatedPersonDays: 600 }))).toBe("bad");
  });
});
