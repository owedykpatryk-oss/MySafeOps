import { describe, expect, it } from "vitest";
import { geoPhotoLocationErrorMessage, geoPhotoLocationStatus } from "./geoPhotoLocationStatus.js";

describe("geoPhotoLocationStatus", () => {
  it("labels GPS source and signal quality", () => {
    expect(geoPhotoLocationStatus("device_gps", 4)).toEqual({ label: "Device GPS · High accuracy (±4 m)", tone: "ok" });
    expect(geoPhotoLocationStatus("device_gps", 12).tone).toBe("ok");
    expect(geoPhotoLocationStatus("device_gps", 45)).toEqual({ label: "Device GPS · Approximate (±45 m)", tone: "warn" });
    expect(geoPhotoLocationStatus("device_gps", null).label).toContain("accuracy unavailable");
  });

  it("explains non-live location sources and missing accuracy", () => {
    expect(geoPhotoLocationStatus("photo_exif").label).toContain("Photo location (EXIF)");
    expect(geoPhotoLocationStatus("manual_pin").label).toContain("Manual map pin");
    expect(geoPhotoLocationStatus("project_site").label).toContain("not a live GPS fix");
    expect(geoPhotoLocationStatus("device_gps").tone).toBe("warn");
  });

  it("gives a usable next step when location access is denied", () => {
    const message = geoPhotoLocationErrorMessage({ code: 1 });
    expect(message).toContain("Allow location");
    expect(message).toContain("drop a pin");
    expect(geoPhotoLocationErrorMessage({ code: 3 })).toContain("took too long");
  });
});
