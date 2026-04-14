/**
 * Affine georeferencing: map plan coordinates (0–100 %, origin top-left) to WGS84
 * using three non-collinear control points (u=x/100, v=y/100, linear lat/lng).
 */

/** @param {number[][]} A — 3×3 matrix rows */
function det3(A) {
  const a = A[0][0];
  const b = A[0][1];
  const c = A[0][2];
  const d = A[1][0];
  const e = A[1][1];
  const f = A[1][2];
  const g = A[2][0];
  const h = A[2][1];
  const i = A[2][2];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/** Solve 3×3 linear system A x = b (Cramer's rule). */
function solve3(A, b) {
  const D = det3(A);
  if (!Number.isFinite(D) || Math.abs(D) < 1e-14) return null;
  const Ax = [
    [b[0], A[0][1], A[0][2]],
    [b[1], A[1][1], A[1][2]],
    [b[2], A[2][1], A[2][2]],
  ];
  const Ay = [
    [A[0][0], b[0], A[0][2]],
    [A[1][0], b[1], A[1][2]],
    [A[2][0], b[2], A[2][2]],
  ];
  const Az = [
    [A[0][0], A[0][1], b[0]],
    [A[1][0], A[1][1], b[1]],
    [A[2][0], A[2][1], b[2]],
  ];
  return [det3(Ax) / D, det3(Ay) / D, det3(Az) / D];
}

/**
 * @param {{ px: number, py: number, lat: number, lng: number }[]} points — length 3, px/py in 0–100
 * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number } | null}
 */
export function solvePlanAffineFromControlPoints(points) {
  if (!Array.isArray(points) || points.length !== 3) return null;
  const P = points.map((p) => {
    const px = Number(p.px);
    const py = Number(p.py);
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (![px, py, lat, lng].every((x) => Number.isFinite(x))) return null;
    return { u: px / 100, v: py / 100, lat, lng };
  });
  if (P.some((x) => x == null)) return null;

  const area =
    (P[1].u - P[0].u) * (P[2].v - P[0].v) - (P[2].u - P[0].u) * (P[1].v - P[0].v);
  if (Math.abs(area) < 1e-10) return null;

  const A = [
    [P[0].u, P[0].v, 1],
    [P[1].u, P[1].v, 1],
    [P[2].u, P[2].v, 1],
  ];
  const latSol = solve3(
    A,
    P.map((p) => p.lat)
  );
  const lngSol = solve3(
    A,
    P.map((p) => p.lng)
  );
  if (!latSol || !lngSol) return null;
  return {
    a: latSol[0],
    b: latSol[1],
    c: latSol[2],
    d: lngSol[0],
    e: lngSol[1],
    f: lngSol[2],
  };
}

/**
 * @param {number} px — 0–100
 * @param {number} py — 0–100
 * @param {{ a: number, b: number, c: number, d: number, e: number, f: number }} aff
 */
export function planPercentToLatLngAffine(px, py, aff) {
  const u = Number(px) / 100;
  const v = Number(py) / 100;
  return {
    lat: aff.a * u + aff.b * v + aff.c,
    lng: aff.d * u + aff.e * v + aff.f,
  };
}
