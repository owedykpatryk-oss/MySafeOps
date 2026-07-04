/** Bearing / map helpers for geo-photos. */

const DIRECTION_LENGTH_DEG = 0.0002;

export function normalizeBearing(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return null;
  const n = Number(deg) % 360;
  return n < 0 ? n + 360 : n;
}

/** End point for direction arrow polyline (~30 m at mid-latitudes). */
export function bearingToEnd(lat, lng, bearingDeg) {
  const b = normalizeBearing(bearingDeg);
  if (b == null || lat == null || lng == null) return null;
  const rad = (b * Math.PI) / 180;
  return [lat + DIRECTION_LENGTH_DEG * Math.cos(rad), lng + DIRECTION_LENGTH_DEG * Math.sin(rad)];
}

/** Compass alpha (device) → bearing clockwise from north. */
export function orientationAlphaToBearing(alpha) {
  if (alpha == null || Number.isNaN(Number(alpha))) return null;
  return normalizeBearing(360 - Number(alpha));
}

export function flipBearing180(bearing) {
  const b = normalizeBearing(bearing);
  return b == null ? null : normalizeBearing(b + 180);
}

/** Resize image file to JPEG data URL for local storage. */
export function compressImageFile(file, { maxWidth = 1280, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result || ""));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function requestDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Could not get GPS position")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  });
}

/** Attach DeviceOrientation listener; returns cleanup. */
export async function requestCompassPermission() {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return false;
  if (typeof DeviceOrientationEvent.requestPermission !== "function") return true;
  try {
    const state = await DeviceOrientationEvent.requestPermission();
    return state === "granted";
  } catch {
    return false;
  }
}

export function compassNeedsUserGesture() {
  return (
    typeof window !== "undefined" &&
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  );
}

/** Attach DeviceOrientation listener; returns cleanup. */
export function watchCompassBearing(onBearing, { autoRequestPermission = true } = {}) {
  if (typeof window === "undefined") return () => {};

  const handler = (e) => {
    const b = orientationAlphaToBearing(e.alpha);
    if (b != null) onBearing(b);
  };

  const attach = () => window.addEventListener("deviceorientation", handler, true);

  if (compassNeedsUserGesture()) {
    if (!autoRequestPermission) {
      return () => window.removeEventListener("deviceorientation", handler, true);
    }
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === "granted") attach();
      })
      .catch(() => {});
    return () => window.removeEventListener("deviceorientation", handler, true);
  }

  attach();
  return () => window.removeEventListener("deviceorientation", handler, true);
}

export function blankGeoPhoto(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId: "",
    projectName: "",
    type: "general_site_condition",
    latitude: null,
    longitude: null,
    gpsAccuracyMeters: null,
    bearing: null,
    notes: "",
    locationId: "",
    depthM: null,
    sampleRef: "",
    capturePhase: "",
    linkedPermitId: "",
    includeInReport: true,
    reportOrder: null,
    photoDataUrl: "",
    capturedBy: "",
    timestampUtc: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
