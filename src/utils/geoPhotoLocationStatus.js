import { GPS_GOOD_ACCURACY_M } from "./geoPhotoUtils.js";

export function geoPhotoLocationStatus(source, accuracyMeters) {
  if (source === "manual_pin") {
    return { label: "Manual map pin · GPS accuracy unavailable", tone: "info" };
  }
  if (source === "photo_exif") {
    return { label: "Photo location (EXIF) · GPS accuracy unavailable", tone: "info" };
  }
  if (source === "project_site") {
    return { label: "Project site coordinates · not a live GPS fix", tone: "info" };
  }
  if (source === "device_gps") {
    const accuracy = Number(accuracyMeters);
    if (accuracyMeters == null || accuracyMeters === "" || !Number.isFinite(accuracy) || accuracy < 0) {
      return { label: "Device GPS · accuracy unavailable", tone: "warn" };
    }
    const quality = accuracy <= 5 ? "High accuracy" : accuracy <= GPS_GOOD_ACCURACY_M ? "Good accuracy" : "Approximate";
    return {
      label: `Device GPS · ${quality} (±${Math.round(accuracy)} m)`,
      tone: accuracy > GPS_GOOD_ACCURACY_M ? "warn" : "ok",
    };
  }
  return { label: "Waiting for a location", tone: "info" };
}

export function geoPhotoLocationErrorMessage(error) {
  const code = Number(error?.code);
  if (code === 1) {
    return "Location access was denied. Allow location for this site in your browser and device settings, then tap Refresh GPS. You can still drop a pin on the map or use photo coordinates.";
  }
  if (code === 2) {
    return "Your device could not determine a location. Check that Location Services are on, move somewhere with a clearer sky view, or drop a pin on the map.";
  }
  if (code === 3 || /timed? ?out|timeout/i.test(String(error?.message || ""))) {
    return "Getting GPS took too long. Try again outdoors, wait for a better fix, or drop a pin on the map.";
  }
  if (/not available|not supported|secure origin|https/i.test(String(error?.message || ""))) {
    return "Location is unavailable here. Open MySafeOps over HTTPS in a browser with Location Services enabled, or drop a pin on the map.";
  }
  return "Could not get your location. Check browser and device location permissions, then retry or drop a pin on the map.";
}
