/**
 * WGS84 → OSGB36 British National Grid (EPSG:27700) eastings, northings and grid references.
 *
 * UK surveyors, utilities and CAD deliverables work in National Grid, not lat/long, so exports
 * carry both. The datum shift uses the standard Helmert transformation, which is accurate to
 * roughly ±5 m — fine for locating field evidence, not a substitute for OSTN15 on precision work.
 * Formulae follow Ordnance Survey "A guide to coordinate systems in Great Britain".
 */

const AIRY_1830 = { a: 6377563.396, b: 6356256.909 };
const WGS84 = { a: 6378137.0, b: 6356752.3142 };

/** OSGB National Grid true origin and scale. */
const GRID = {
  scale: 0.9996012717,
  originLat: (49 * Math.PI) / 180,
  originLng: (-2 * Math.PI) / 180,
  originEasting: 400000,
  originNorthing: -100000,
};

/** WGS84 → OSGB36, from the OS guide (metres, parts per million, seconds of arc). */
const HELMERT_WGS84_TO_OSGB36 = {
  tx: -446.448,
  ty: 125.157,
  tz: -542.06,
  scalePpm: 20.4894,
  rxSec: -0.1502,
  rySec: -0.247,
  rzSec: -0.8421,
};

const SEC_TO_RAD = Math.PI / (180 * 3600);
const GRID_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ"; // 'I' is unused on the National Grid.

function geodeticToCartesian(latRad, lngRad, heightM, ellipsoid) {
  const { a, b } = ellipsoid;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const eSq = (a * a - b * b) / (a * a);
  const nu = a / Math.sqrt(1 - eSq * sinLat * sinLat);
  return {
    x: (nu + heightM) * cosLat * Math.cos(lngRad),
    y: (nu + heightM) * cosLat * Math.sin(lngRad),
    z: ((1 - eSq) * nu + heightM) * sinLat,
  };
}

function cartesianToGeodetic({ x, y, z }, ellipsoid) {
  const { a, b } = ellipsoid;
  const eSq = (a * a - b * b) / (a * a);
  const p = Math.sqrt(x * x + y * y);
  let lat = Math.atan2(z, p * (1 - eSq));
  let nu = a;
  // Converges in a handful of passes at terrestrial latitudes.
  for (let i = 0; i < 10; i += 1) {
    const sinLat = Math.sin(lat);
    nu = a / Math.sqrt(1 - eSq * sinLat * sinLat);
    const next = Math.atan2(z + eSq * nu * sinLat, p);
    if (Math.abs(next - lat) < 1e-12) {
      lat = next;
      break;
    }
    lat = next;
  }
  return { latRad: lat, lngRad: Math.atan2(y, x), heightM: p / Math.cos(lat) - nu };
}

function helmert(point, params) {
  const { tx, ty, tz, scalePpm, rxSec, rySec, rzSec } = params;
  const s = 1 + scalePpm / 1e6;
  const rx = rxSec * SEC_TO_RAD;
  const ry = rySec * SEC_TO_RAD;
  const rz = rzSec * SEC_TO_RAD;
  const { x, y, z } = point;
  return {
    x: tx + s * x - rz * y + ry * z,
    y: ty + rz * x + s * y - rx * z,
    z: tz - ry * x + rx * y + s * z,
  };
}

/**
 * Transverse Mercator projection onto the National Grid. Input must already be on the
 * Airy 1830 ellipsoid (OSGB36 datum) — use {@link wgs84ToBritishNationalGrid} for GPS input.
 */
export function osgb36ToEastingNorthing(latDeg, lngDeg) {
  const lat = (Number(latDeg) * Math.PI) / 180;
  const lng = (Number(lngDeg) * Math.PI) / 180;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const { a, b } = AIRY_1830;
  const { scale: f0, originLat: lat0, originLng: lng0, originEasting: e0, originNorthing: n0 } = GRID;
  const eSq = (a * a - b * b) / (a * a);
  const n = (a - b) / (a + b);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const tan2 = tanLat * tanLat;

  const nu = a * f0 * (1 - eSq * sinLat * sinLat) ** -0.5;
  const rho = a * f0 * (1 - eSq) * (1 - eSq * sinLat * sinLat) ** -1.5;
  const etaSq = nu / rho - 1;

  const dLat = lat - lat0;
  const sLat = lat + lat0;
  const m =
    b *
    f0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * dLat -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(dLat) * Math.cos(sLat) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * dLat) * Math.cos(2 * sLat) -
      (35 / 24) * n ** 3 * Math.sin(3 * dLat) * Math.cos(3 * sLat));

  const i = m + n0;
  const ii = (nu / 2) * sinLat * cosLat;
  const iii = (nu / 24) * sinLat * cosLat ** 3 * (5 - tan2 + 9 * etaSq);
  const iiiA = (nu / 720) * sinLat * cosLat ** 5 * (61 - 58 * tan2 + tan2 * tan2);
  const iv = nu * cosLat;
  const v = (nu / 6) * cosLat ** 3 * (nu / rho - tan2);
  const vi = (nu / 120) * cosLat ** 5 * (5 - 18 * tan2 + tan2 * tan2 + 14 * etaSq - 58 * tan2 * etaSq);

  const dLng = lng - lng0;
  const northing = i + ii * dLng ** 2 + iii * dLng ** 4 + iiiA * dLng ** 6;
  const easting = e0 + iv * dLng + v * dLng ** 3 + vi * dLng ** 5;

  return { easting, northing };
}

/**
 * Two-letter National Grid reference, e.g. `TQ 30262 79553`. Returns "" outside the grid.
 * @param {number} easting
 * @param {number} northing
 * @param {number} [digits] Digits per axis: 5 gives 1 m precision, 4 gives 10 m.
 */
export function gridReferenceFromEastingNorthing(easting, northing, digits = 5) {
  const e = Number(easting);
  const n = Number(northing);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return "";
  if (e < 0 || e >= 700000 || n < 0 || n >= 1300000) return "";

  const e100k = Math.floor(e / 100000);
  const n100k = Math.floor(n / 100000);
  const firstIndex = 19 - n100k - ((19 - n100k) % 5) + Math.floor((e100k + 10) / 5);
  const secondIndex = (((19 - n100k) * 5) % 25) + (e100k % 5);
  const letters = `${GRID_LETTERS[firstIndex]}${GRID_LETTERS[secondIndex]}`;
  if (letters.includes("undefined")) return "";

  const d = Math.min(5, Math.max(1, Math.round(digits)));
  const divisor = 10 ** (5 - d);
  const eStr = String(Math.floor((e % 100000) / divisor)).padStart(d, "0");
  const nStr = String(Math.floor((n % 100000) / divisor)).padStart(d, "0");
  return `${letters} ${eStr} ${nStr}`;
}

/**
 * GPS coordinates → National Grid easting/northing plus grid reference.
 * @param {number} latDeg WGS84 latitude
 * @param {number} lngDeg WGS84 longitude
 * @returns {{ easting: number, northing: number, gridRef: string } | null} null outside Great Britain
 */
export function wgs84ToBritishNationalGrid(latDeg, lngDeg) {
  const lat = Number(latDeg);
  const lng = Number(lngDeg);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cartesian = geodeticToCartesian((lat * Math.PI) / 180, (lng * Math.PI) / 180, 0, WGS84);
  const shifted = helmert(cartesian, HELMERT_WGS84_TO_OSGB36);
  const { latRad, lngRad } = cartesianToGeodetic(shifted, AIRY_1830);
  const grid = osgb36ToEastingNorthing((latRad * 180) / Math.PI, (lngRad * 180) / Math.PI);
  if (!grid) return null;

  const gridRef = gridReferenceFromEastingNorthing(grid.easting, grid.northing);
  if (!gridRef) return null; // Outside the National Grid — the numbers would be meaningless.
  return {
    easting: Math.round(grid.easting * 100) / 100,
    northing: Math.round(grid.northing * 100) / 100,
    gridRef,
  };
}

const HELMERT_OSGB36_TO_WGS84 = {
  tx: 446.448,
  ty: -125.157,
  tz: 542.06,
  scalePpm: -20.4894,
  rxSec: 0.1502,
  rySec: 0.247,
  rzSec: 0.8421,
};

function meridionalArc(lat, lat0, b, f0, n) {
  const dLat = lat - lat0;
  const sLat = lat + lat0;
  return (
    b *
    f0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * dLat -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(dLat) * Math.cos(sLat) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * dLat) * Math.cos(2 * sLat) -
      (35 / 24) * n ** 3 * Math.sin(3 * dLat) * Math.cos(3 * sLat))
  );
}

/** National Grid easting/northing → OSGB36 latitude and longitude in degrees. */
export function eastingNorthingToOsgb36(easting, northing) {
  const E = Number(easting);
  const N = Number(northing);
  if (!Number.isFinite(E) || !Number.isFinite(N)) return null;
  const { a, b } = AIRY_1830;
  const { scale: f0, originLat: lat0, originLng: lng0, originEasting: e0, originNorthing: n0 } = GRID;
  const eSq = (a * a - b * b) / (a * a);
  const n = (a - b) / (a + b);
  let phi = (N - n0) / (a * f0) + lat0;
  for (let i = 0; i < 12; i += 1) {
    const m = meridionalArc(phi, lat0, b, f0, n);
    phi += (N - n0 - m) / (a * f0);
  }
  const sinLat = Math.sin(phi);
  const cosLat = Math.cos(phi);
  const tanLat = Math.tan(phi);
  const tan2 = tanLat * tanLat;
  const nu = a * f0 * (1 - eSq * sinLat * sinLat) ** -0.5;
  const rho = a * f0 * (1 - eSq) * (1 - eSq * sinLat * sinLat) ** -1.5;
  const etaSq = nu / rho - 1;
  const dE = E - e0;
  const vii = tanLat / (2 * rho * nu);
  const viii = (tanLat / (24 * rho * nu ** 3)) * (5 + 3 * tan2 + etaSq - 9 * tan2 * etaSq);
  const ix = (tanLat / (720 * rho * nu ** 5)) * (61 + 90 * tan2 + 45 * tan2 * tan2);
  const x = 1 / (cosLat * nu);
  const xi = (1 / (cosLat * 6 * nu ** 3)) * (nu / rho + 2 * tan2);
  const xii = (1 / (cosLat * 120 * nu ** 5)) * (5 + 28 * tan2 + 24 * tan2 * tan2);
  const xiia = (1 / (cosLat * 5040 * nu ** 7)) * (61 + 662 * tan2 + 1320 * tan2 * tan2 + 720 * tan2 ** 3);
  const lat = phi - vii * dE ** 2 + viii * dE ** 4 - ix * dE ** 6;
  const lng = lng0 + x * dE - xi * dE ** 3 + xii * dE ** 5 - xiia * dE ** 7;
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/**
 * National Grid → WGS84. Helmert only, about ±5 m against OSTN15.
 * @returns {{ lat: number, lng: number } | null}
 */
export function britishNationalGridToWgs84(easting, northing) {
  const osgb = eastingNorthingToOsgb36(easting, northing);
  if (!osgb) return null;
  const cartesian = geodeticToCartesian((osgb.lat * Math.PI) / 180, (osgb.lng * Math.PI) / 180, 0, AIRY_1830);
  const shifted = helmert(cartesian, HELMERT_OSGB36_TO_WGS84);
  const { latRad, lngRad } = cartesianToGeodetic(shifted, WGS84);
  const lat = (latRad * 180) / Math.PI;
  const lng = (lngRad * 180) / Math.PI;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** "TQ 30262 79553", "530262 179553" or "E 651409 N 313177". */
export function parseBritishNationalGrid(text) {
  const raw = String(text || "").trim().toUpperCase().replace(/\//g, " ");
  const letters = raw.match(/^([A-HJ-Z]{2})\s*(\d{2,10})\s*(\d{2,10})$/);
  if (letters) {
    const eDigits = letters[2];
    const nDigits = letters[3];
    if (eDigits.length !== nDigits.length || eDigits.length > 5) return null;
    const pair = letters[1];
    let square = null;
    for (let e100 = 0; e100 < 7 && !square; e100 += 1) {
      for (let n100 = 0; n100 < 13; n100 += 1) {
        const ref = gridReferenceFromEastingNorthing(e100 * 100000 + 1, n100 * 100000 + 1, 1);
        if (ref.startsWith(pair)) {
          square = { e100, n100 };
          break;
        }
      }
    }
    if (!square) return null;
    const scale = 10 ** (5 - eDigits.length);
    return {
      easting: square.e100 * 100000 + Number(eDigits) * scale,
      northing: square.n100 * 100000 + Number(nDigits) * scale,
    };
  }
  const nums = raw.replace(/[EN]/g, " ").match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const easting = Number(nums[0]);
  const northing = Number(nums[1]);
  if (easting < 0 || easting >= 700000 || northing < 0 || northing >= 1300000) return null;
  return { easting, northing };
}

/** ///filled.count.soap or a what3words.com / w3w.co link. */
export function normaliseWhat3Words(raw) {
  let text = String(raw || "").trim().toLowerCase();
  text = text.replace(/^https?:\/\/(?:www\.)?(?:what3words\.com|w3w\.co)\//, "");
  text = text.replace(/^\/+/, "").split(/[?#]/)[0];
  return /^[a-z]{3,}\.[a-z]{3,}\.[a-z]{3,}$/.test(text) ? text : "";
}
