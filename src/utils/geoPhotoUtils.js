/** Bearing / map helpers for geo-photos. */

const EARTH_RADIUS_M = 6371000;
/** Visible length of a view-direction arrow on site-scale maps. */
export const DIRECTION_LENGTH_M = 25;

export function normalizeBearing(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return null;
  const n = Number(deg) % 360;
  return n < 0 ? n + 360 : n;
}

/**
 * Point `distanceM` from a position along a bearing. Longitude is scaled by latitude, so the
 * drawn angle matches the compass bearing instead of leaning east–west.
 * @returns {[number, number] | null} [lat, lng]
 */
export function destinationPoint(lat, lng, bearingDeg, distanceM = DIRECTION_LENGTH_M) {
  const b = normalizeBearing(bearingDeg);
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const la = Number(lat);
  const ln = Number(lng);
  const d = Number(distanceM);
  if (b == null || !Number.isFinite(la) || !Number.isFinite(ln) || !Number.isFinite(d)) return null;
  const rad = (b * Math.PI) / 180;
  const dLat = ((d * Math.cos(rad)) / EARTH_RADIUS_M) * (180 / Math.PI);
  const cosLat = Math.max(Math.cos((la * Math.PI) / 180), 1e-6);
  const dLng = ((d * Math.sin(rad)) / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
  return [la + dLat, ln + dLng];
}

/** End point for direction arrow polyline. */
export function bearingToEnd(lat, lng, bearingDeg, distanceM = DIRECTION_LENGTH_M) {
  return destinationPoint(lat, lng, bearingDeg, distanceM);
}

/**
 * Triangle for the head of a view-direction arrow, so the map shows which way the camera
 * faced rather than an ambiguous line.
 * @returns {{ tip: [number, number], left: [number, number], right: [number, number] } | null}
 */
export function bearingArrowHead(lat, lng, bearingDeg, { lengthM = DIRECTION_LENGTH_M, headM = 9, spreadDeg = 26 } = {}) {
  const b = normalizeBearing(bearingDeg);
  if (b == null) return null;
  const tip = destinationPoint(lat, lng, b, lengthM);
  if (!tip) return null;
  // Barbs run back from the tip, splayed either side of the centre line.
  const barb = (side) => destinationPoint(tip[0], tip[1], normalizeBearing(b + 180 + side * spreadDeg), headM);
  const left = barb(1);
  const right = barb(-1);
  if (!left || !right) return null;
  return { tip, left, right };
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

/** Resize image file to JPEG data URL for local storage (PWA camera-safe). */
export function compressImageFile(file, { maxWidth = 1280, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No photo file"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      fn(value);
    };

    const drawToJpeg = (source, width, height) => {
      const scale = Math.min(1, maxWidth / Math.max(1, width));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, w, h);
      try {
        return canvas.toDataURL("image/jpeg", quality);
      } catch {
        return null;
      }
    };

    img.onload = () => {
      const jpeg = drawToJpeg(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
      if (jpeg) {
        finish(resolve, jpeg);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => finish(resolve, String(reader.result || ""));
      reader.onerror = () => finish(reject, new Error("Could not read photo"));
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || "");
        if (raw.startsWith("data:image")) finish(resolve, raw);
        else finish(reject, new Error("Could not read photo from camera"));
      };
      reader.onerror = () => finish(reject, new Error("Could not read photo from camera"));
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
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
          altitude: Number.isFinite(pos.coords.altitude) ? pos.coords.altitude : null,
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

/** Survey-grade fix on a phone; above this the location is only indicative. */
export const GPS_GOOD_ACCURACY_M = 15;
/** Stop waiting early once the fix is this tight. */
export const GPS_TARGET_ACCURACY_M = 10;

export function isCoarseGpsAccuracy(accuracyMeters) {
  const n = Number(accuracyMeters);
  return Number.isFinite(n) && n > GPS_GOOD_ACCURACY_M;
}

/** Cameras write coordinates either as decimals or as raw [deg, min, sec] triples. */
function exifCoordToDecimal(value, ref) {
  const dms = Array.isArray(value)
    ? Number(value[0] || 0) + Number(value[1] || 0) / 60 + Number(value[2] || 0) / 3600
    : Number(value);
  if (!Number.isFinite(dms)) return NaN;
  const hemisphere = String(ref || "").trim().toUpperCase();
  return hemisphere === "S" || hemisphere === "W" ? -Math.abs(dms) : dms;
}

export function normalisePhotoExifLocation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number.isFinite(Number(raw.latitude))
    ? Number(raw.latitude)
    : exifCoordToDecimal(raw.GPSLatitude, raw.GPSLatitudeRef);
  const lng = Number.isFinite(Number(raw.longitude))
    ? Number(raw.longitude)
    : exifCoordToDecimal(raw.GPSLongitude, raw.GPSLongitudeRef);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // Cameras with no fix commonly write a literal 0,0.
  if (lat === 0 && lng === 0) return null;
  const alt = Number(raw.GPSAltitude ?? raw.altitude);
  return {
    latitude: Math.round(lat * 1e6) / 1e6,
    longitude: Math.round(lng * 1e6) / 1e6,
    altitude: Number.isFinite(alt) ? Math.round(alt * 10) / 10 : null,
  };
}

/**
 * Read the location the camera embedded in the photo. Matters for images picked from
 * the gallery, where the device has no live fix for where the shot was taken.
 * @param {File|Blob} file
 */
export async function readPhotoExifLocation(file) {
  if (!file) return null;
  try {
    const exifr = await import("exifr");
    const parse = exifr.parse || exifr.default?.parse;
    if (typeof parse !== "function") return null;
    return normalisePhotoExifLocation(await parse(file, { gps: true }));
  } catch {
    return null;
  }
}

/**
 * Keep sampling until the fix is good enough (or time runs out), reporting each improvement.
 * @param {{ targetAccuracyM?: number, timeoutMs?: number, onUpdate?: (fix: object) => void }} [opts]
 */
export function watchBetterLocation({
  targetAccuracyM = GPS_TARGET_ACCURACY_M,
  timeoutMs = 30000,
  onUpdate,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available on this device."));
      return;
    }
    let best = null;
    let watchId = null;
    let timer = null;

    const settle = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (timer != null) window.clearTimeout(timer);
      watchId = null;
      timer = null;
      if (best) resolve(best);
      else reject(new Error("Could not get a better GPS fix"));
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: Number.isFinite(pos.coords.altitude) ? pos.coords.altitude : null,
        };
        const better = !best || !Number.isFinite(best.accuracy) || fix.accuracy < best.accuracy;
        if (better) {
          best = fix;
          onUpdate?.(fix);
        }
        if (Number.isFinite(fix.accuracy) && fix.accuracy <= targetAccuracyM) settle();
      },
      (err) => {
        if (best) settle();
        else {
          if (watchId != null) navigator.geolocation.clearWatch(watchId);
          if (timer != null) window.clearTimeout(timer);
          reject(new Error(err?.message || "Could not get GPS position"));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );

    timer = window.setTimeout(settle, timeoutMs);
  });
}

export function newGeoPhotoId() {
  return `gp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function blankGeoPhoto(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: newGeoPhotoId(),
    projectId: "",
    projectName: "",
    type: "general_site_condition",
    latitude: null,
    longitude: null,
    gpsAccuracyMeters: null,
    altitudeMeters: null,
    locationSource: "",
    bearing: null,
    notes: "",
    locationId: "",
    depthM: null,
    sampleRef: "",
    capturePhase: "",
    details: {},
    area: null,
    actionResolvedAt: null,
    actionResolvedBy: "",
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
