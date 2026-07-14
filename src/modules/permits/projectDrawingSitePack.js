import { buildDrawingObjectsKml, escapeXml } from "./projectDrawingGeo";
import { computeProjectDrawingReadiness } from "./projectDrawingReadiness";
import { drawingObjectLabel } from "./projectDrawingRegistry";

function kmlLinePlacemark(name, desc, coords, style = {}) {
  const color = style.color || "ff0000ff";
  const width = style.width || 4;
  return `    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}</description>
      <Style><LineStyle><color>${color}</color><width>${width}</width></LineStyle></Style>
      <LineString><coordinates>${coords}</coordinates></LineString>
    </Placemark>`;
}

function kmlPolygonPlacemark(name, desc, coords) {
  return `    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}</description>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>`;
}

/**
 * KML with drawing objects plus project boundary and escape routes.
 */
export function buildSitePackKml({
  projectId = "",
  planName = "",
  objects = [],
  anchor,
  affine = null,
  permitRef = "",
  boundaryPoints = [],
  boundaryName = "",
  escapeRoutes = [],
}) {
  const base = buildDrawingObjectsKml({
    projectId,
    planName,
    objects,
    anchor,
    affine,
    permitRef,
  });

  const extra = [];

  if (Array.isArray(boundaryPoints) && boundaryPoints.length >= 3) {
    const coords = boundaryPoints
      .map((p) => {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? `${lng},${lat},0` : null;
      })
      .filter(Boolean)
      .join(" ");
    if (coords) {
      extra.push(
        kmlPolygonPlacemark(
          boundaryName || "Site boundary",
          "Project site boundary from drawing editor",
          coords
        )
      );
    }
  }

  (escapeRoutes || []).forEach((route, idx) => {
    const pts = (route.points || [])
      .map((p) => {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? `${lng},${lat},0` : null;
      })
      .filter(Boolean)
      .join(" ");
    if (pts.split(" ").length >= 2) {
      extra.push(
        kmlLinePlacemark(
          route.name || `Escape route ${idx + 1}`,
          "Evacuation / escape route saved on project",
          pts,
          { color: "ff7c440c", width: 5 }
        )
      );
    }
  });

  if (extra.length === 0) return base;
  return base.replace("</Document>\n</kml>", `${extra.join("\n")}\n  </Document>\n</kml>`);
}

export function buildSitePackManifest({
  project = {},
  readiness = null,
  objects = [],
  escapeRoutes = [],
  permitRef = "",
  exportedAt = new Date().toISOString(),
}) {
  const objectSummary = objects.reduce((acc, row) => {
    const key = row.type || "zone";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    format: "mysafeops-site-pack-v1",
    exportedAt,
    project: {
      id: project.id || "",
      name: project.name || "",
      postcode: project.postcode || "",
      address: project.address || "",
      site: project.site || "",
      lat: project.lat || "",
      lng: project.lng || "",
    },
    readiness: readiness || computeProjectDrawingReadiness({}),
    emergency: {
      nearestHospital: project.nearestHospital || "",
      hospitalDirectionsUrl: project.hospitalDirectionsUrl || "",
      hospitalRouteScreenshotUrl: project.hospitalRouteScreenshotUrl || "",
      hospitalRouteCapturedAt: project.hospitalRouteCapturedAt || "",
      siteMapUrl: project.siteMapUrl || "",
    },
    geometry: {
      boundaryPointCount: Array.isArray(project.boundaryPoints) ? project.boundaryPoints.length : 0,
      escapeRouteCount: (escapeRoutes || []).length,
      escapeRoutes: (escapeRoutes || []).map((r) => ({
        id: r.id,
        name: r.name || "",
        pointCount: (r.points || []).length,
      })),
    },
    drawingObjects: {
      total: objects.length,
      byType: objectSummary,
      labels: objects.slice(0, 80).map((row) => ({
        id: row.id,
        type: row.type,
        label: drawingObjectLabel(row),
        placement: row.placement || "plan",
      })),
    },
    permitRef: String(permitRef || "").trim(),
    attachments: [
      project.hospitalRouteScreenshotUrl,
      project.siteMapUrl,
    ].filter(Boolean),
  };
}

export function triggerBlobDownload(blob, filename) {
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
