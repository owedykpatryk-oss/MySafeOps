import { describe, expect, it } from "vitest";
import { easterSunday, publicHolidays, publicHolidaysBetween } from "./publicHolidays";

const dates = (marketId, year) => publicHolidays(marketId, year).map((entry) => entry.date);
const named = (marketId, year, name) => publicHolidays(marketId, year).find((entry) => entry.name === name);

describe("public holidays", () => {
  it("computes Easter Sunday", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("derives the UK bank holidays including the nth-weekday rules", () => {
    const uk = dates("uk", 2026);
    expect(uk).toContain("2026-01-01");
    expect(uk).toContain("2026-04-03"); // Good Friday
    expect(uk).toContain("2026-04-06"); // Easter Monday
    expect(uk).toContain("2026-05-04"); // first Monday in May
    expect(uk).toContain("2026-05-25"); // last Monday in May
    expect(uk).toContain("2026-08-31"); // last Monday in August
    expect(uk).toHaveLength(8);
    expect(uk).toEqual([...uk].sort());
  });

  it("moves a weekend Christmas to the next working days", () => {
    // 2027: Christmas Day is a Saturday, Boxing Day a Sunday.
    const christmas = named("uk", 2027, "Christmas Day");
    const boxing = named("uk", 2027, "Boxing Day");
    expect(christmas).toMatchObject({ date: "2027-12-27", substitute: true });
    expect(boxing).toMatchObject({ date: "2027-12-28", substitute: true });
    // Never the same day twice.
    expect(new Set(dates("uk", 2027)).size).toBe(dates("uk", 2027).length);
  });

  it("keeps Anzac Day where it falls and substitutes Australia Day", () => {
    // 2027: Anzac Day is a Sunday; most states do not move it.
    expect(named("au", 2027, "Anzac Day").date).toBe("2027-04-25");
    // 2025: Australia Day is a Sunday, so it moves to the Monday.
    expect(named("au", 2025, "Australia Day")).toMatchObject({ date: "2025-01-27", substitute: true });
  });

  it("derives the Polish holidays including the Easter-based ones", () => {
    const pl = publicHolidays("pl", 2026);
    expect(pl).toHaveLength(13);
    expect(named("pl", 2026, "Boże Ciało").date).toBe("2026-06-04"); // Easter + 60
    expect(named("pl", 2026, "Zielone Świątki").date).toBe("2026-05-24"); // Easter + 49
    expect(named("pl", 2026, "Święto Konstytucji 3 Maja").date).toBe("2026-05-03");
    // Poland never moves a holiday off a weekend.
    expect(pl.some((entry) => entry.substitute)).toBe(false);
  });

  it("spans year boundaries and stays inside the requested range", () => {
    const span = publicHolidaysBetween("uk", "2026-12-20", "2027-01-05");
    expect(span.map((entry) => entry.date)).toEqual(["2026-12-25", "2026-12-28", "2027-01-01"]);
    expect(publicHolidaysBetween("uk", "2027-01-05", "2026-12-20")).toEqual([]);
    expect(publicHolidaysBetween("uk", "", "")).toEqual([]);
  });

  it("falls back to the UK calendar for an unknown market", () => {
    expect(dates("nz", 2026)).toEqual(dates("uk", 2026));
  });
});
