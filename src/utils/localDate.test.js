import { describe, expect, it } from "vitest";
import { localDateISO, localMonthISO, parseLocalDateISO, todayLocalISO } from "./localDate.js";

describe("localDate", () => {
  it("formats a known local calendar day as YYYY-MM-DD", () => {
    const d = new Date(2026, 6, 26, 0, 30, 0); // 26 Jul 2026 00:30 local
    expect(localDateISO(d)).toBe("2026-07-26");
  });

  it("does not shift to the previous day near local midnight (UTC-skew case)", () => {
    // 00:30 local on the 26th must stay the 26th even when UTC is still the 25th in positive offsets
    const d = new Date(2026, 6, 26, 0, 30, 0);
    const utcSlice = d.toISOString().slice(0, 10);
    const local = localDateISO(d);
    expect(local).toBe("2026-07-26");
    // In timezones east of UTC, utcSlice may be 2026-07-25 — that is exactly the bug we avoid.
    if (d.getTimezoneOffset() < 0) {
      expect(utcSlice).not.toBe(local);
    }
  });

  it("parses YYYY-MM-DD as local midnight", () => {
    const d = parseLocalDateISO("2026-07-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(20);
  });

  it("todayLocalISO matches localDateISO(new Date())", () => {
    expect(todayLocalISO()).toBe(localDateISO(new Date()));
  });

  it("localMonthISO is YYYY-MM", () => {
    expect(localMonthISO(new Date(2026, 0, 5))).toBe("2026-01");
  });
});
