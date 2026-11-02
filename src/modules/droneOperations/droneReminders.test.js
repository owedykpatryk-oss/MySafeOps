import { it, expect } from "vitest";
import { missionReminders, actionSection } from "./droneReminders.js";
it("shows source-document expiry in the document workspace", () => {
  const rows = missionReminders(
    [{ id: "m", sourceFacts: [{ field: "operatorId", sourceName: "Certificate", expiresOn: "2026-10-30" }] }],
    Date.parse("2026-10-29T12:00:00Z")
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ section: "documents", kind: "source-document" });
});
it("lists expiring evidence and operator decisions once and ignores cancelled missions", () => {
  const now = Date.parse("2026-10-29T10:00:00Z");
  const m = {
    id: "m",
    title: "Perth survey",
    evidence: [
      { id: "a", kind: "insurance", validUntil: "2026-10-30T10:00:00Z" },
      { id: "b", kind: "airspace", validUntil: "2026-10-29T09:00:00Z" },
      { id: "c", kind: "manual", validUntil: "2027-01-01T00:00:00Z" },
    ],
    operatorRelease: { validUntil: "2026-10-29T12:00:00Z" },
  };
  const reminders = missionReminders([m, { ...m, id: "cancelled", cancelled: true }], now);
  expect(reminders).toHaveLength(3);
  expect(new Set(reminders.map((r) => r.id)).size).toBe(3);
  expect(reminders[0].expired).toBe(true);
  expect(reminders.find((r) => r.kind === "operator-release").section).toBe("review");
});
it("routes next actions to the relevant editor section", () => {
  expect(actionSection("template")).toBe("overview");
  expect(actionSection("checklist-heli-rotors")).toBe("checklist");
  expect(actionSection("operator-release")).toBe("review");
  expect(actionSection("time")).toBe("overview");
  expect(actionSection("insurance")).toBe("checks");
});
