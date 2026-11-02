import { expect, it } from "vitest";
import { formatPublicationDate } from "./ramsPublicationDate";
it("keeps calendar dates unchanged in western and eastern publisher timezones", () => {
  for (const timeZone of ["America/Los_Angeles", "Asia/Tokyo", "Europe/Warsaw"]) {
    expect(formatPublicationDate("2026-11-02", { locale: "en-GB", timeZone })).toBe("02 Nov 2026");
  }
});
it("renders timestamp evidence in the explicit publisher timezone", () => {
  expect(formatPublicationDate("2026-11-02T00:30:00Z", { locale: "en-GB", timeZone: "America/Los_Angeles" }, true)).toBe("01 Nov 2026, 16:30");
  expect(formatPublicationDate("2026-11-02T00:30:00Z", { locale: "en-GB", timeZone: "Asia/Tokyo" }, true)).toBe("02 Nov 2026, 09:30");
});
