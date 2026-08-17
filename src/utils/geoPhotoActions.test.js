import { describe, expect, it } from "vitest";
import {
  buildGeoPhotoActionsBlock,
  countOutstandingGeoPhotoActions,
  GEO_PHOTO_ACTIONS_MARKER,
  geoPhotoActionLine,
  geoPhotoActionOutstanding,
  geoPhotoRaisesAction,
  outstandingActionCountsByProject,
  outstandingGeoPhotoActions,
  setGeoPhotoActionResolved,
} from "./geoPhotoActions.js";

const hazard = (over = {}) => ({
  id: "h1",
  projectId: "p1",
  type: "hazard",
  notes: "Trip hazard",
  timestampUtc: "2026-06-01T10:00:00Z",
  details: { severity: "High", actionRequired: true },
  ...over,
});

describe("geoPhotoActions", () => {
  describe("what counts as an open action", () => {
    it("is raised only when the field ticked action required", () => {
      expect(geoPhotoRaisesAction(hazard())).toBe(true);
      expect(geoPhotoRaisesAction(hazard({ details: { severity: "High" } }))).toBe(false);
      expect(geoPhotoRaisesAction({ type: "hazard" })).toBe(false);
      expect(geoPhotoRaisesAction(null)).toBe(false);
    });

    it("stops being outstanding once closed off, and returns when reopened", () => {
      const open = hazard();
      expect(geoPhotoActionOutstanding(open)).toBe(true);

      const closed = setGeoPhotoActionResolved(open, true, { by: "Alex" });
      expect(closed.actionResolvedAt).toBeTruthy();
      expect(closed.actionResolvedBy).toBe("Alex");
      expect(geoPhotoActionOutstanding(closed)).toBe(false);
      expect(geoPhotoRaisesAction(closed)).toBe(true);

      const reopened = setGeoPhotoActionResolved(closed, false);
      expect(reopened.actionResolvedAt).toBeNull();
      expect(geoPhotoActionOutstanding(reopened)).toBe(true);
    });

    it("ignores a tick that does not belong to the photo's type", () => {
      // "actionRequired" is universal, but "severity" is not asked on a wide shot.
      const wide = hazard({ type: "orientation_wide_shot", details: { severity: "High", actionRequired: true } });
      expect(geoPhotoActionOutstanding(wide)).toBe(true);
      expect(geoPhotoActionLine(wide)).not.toContain("High");
    });
  });

  describe("working through them", () => {
    const photos = [
      hazard({ id: "low", details: { severity: "Low", actionRequired: true }, timestampUtc: "2026-06-01T09:00:00Z" }),
      hazard({ id: "high_new", timestampUtc: "2026-06-03T09:00:00Z" }),
      hazard({ id: "high_old", timestampUtc: "2026-06-02T09:00:00Z" }),
      hazard({ id: "medium", details: { severity: "Medium", actionRequired: true } }),
      hazard({ id: "done", actionResolvedAt: "2026-06-02T12:00:00Z" }),
      hazard({ id: "no_action", details: { severity: "High" } }),
      hazard({ id: "binned", deletedAt: "2026-06-02T12:00:00Z" }),
      hazard({ id: "other_project", projectId: "p2" }),
    ];

    it("puts the worst first, then the oldest, and leaves out closed, binned and unflagged photos", () => {
      expect(outstandingGeoPhotoActions(photos, "p1").map((p) => p.id)).toEqual([
        "high_old",
        "high_new",
        "medium",
        "low",
      ]);
    });

    it("counts across all projects when no project is given", () => {
      expect(countOutstandingGeoPhotoActions(photos)).toBe(5);
      expect(countOutstandingGeoPhotoActions(photos, "p1")).toBe(4);
      expect(countOutstandingGeoPhotoActions(photos, "p2")).toBe(1);
      expect(countOutstandingGeoPhotoActions([])).toBe(0);
    });

    it("counts per project for badges", () => {
      expect(outstandingActionCountsByProject(photos)).toEqual({ p1: 4, p2: 1 });
    });
  });

  describe("the list that reaches the report", () => {
    it("reads as severity, what it was, and where", () => {
      const line = geoPhotoActionLine(hazard(), { index: 1, gridRef: "TQ 30125 80447" });
      expect(line).toBe("1. High — Hazard: Trip hazard (TQ 30125 80447)");
    });

    it("keeps the other observations but does not repeat the severity or the flag", () => {
      const line = geoPhotoActionLine(
        hazard({ details: { severity: "High", hazardCategory: "Excavation", controlInPlace: true, actionRequired: true } })
      );
      expect(line).toBe("High — Hazard: Trip hazard [Excavation · Control in place]");
    });

    it("builds a marker block in worked-through order", () => {
      const block = buildGeoPhotoActionsBlock([
        hazard({ id: "a", details: { severity: "Low", actionRequired: true }, notes: "Loose kerb" }),
        hazard({ id: "b", notes: "Open chamber" }),
      ]);
      expect(block.startsWith(GEO_PHOTO_ACTIONS_MARKER)).toBe(true);
      const lines = block.split("\n");
      expect(lines[1]).toContain("Open chamber");
      expect(lines[2]).toContain("Loose kerb");
    });

    it("adds grid references when it is given a way to work them out", () => {
      const block = buildGeoPhotoActionsBlock([hazard()], { gridRefFor: () => "TQ 30125 80447" });
      expect(block).toContain("TQ 30125 80447");
    });

    it("says nothing when there is nothing outstanding", () => {
      expect(buildGeoPhotoActionsBlock([hazard({ actionResolvedAt: "2026-06-02T12:00:00Z" })])).toBe("");
      expect(buildGeoPhotoActionsBlock([])).toBe("");
    });
  });
});
