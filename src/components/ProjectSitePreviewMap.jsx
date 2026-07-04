import { memo, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { bearingToEnd } from "../utils/geoPhotoUtils";
import { geoPhotoPreset } from "../utils/geoPhotoPresets";
import { asStorageArray } from "../utils/orgStorage";

const EMPTY_ROUTES = [];
const EMPTY_GEO = [];

function boundsKey(lat, lng, boundaryRing, escapeRoutes, geoPhotos) {
  const ring = Array.isArray(boundaryRing)
    ? boundaryRing.map(([a, b]) => `${Number(a).toFixed(5)},${Number(b).toFixed(5)}`).join(";")
    : "";
  const routes = (escapeRoutes || [])
    .map((r) =>
      (r.points || [])
        .map((p) => `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`)
        .join("|")
    )
    .join("~");
  const geo = asStorageArray(geoPhotos)
    .filter(Boolean)
    .map((g) => `${g.id}:${Number(g.latitude).toFixed(5)},${Number(g.longitude).toFixed(5)}:${g.bearing ?? ""}`)
    .join(";");
  return `${lat ?? ""}|${lng ?? ""}|${ring}|${routes}|${geo}`;
}

/**
 * Lightweight site preview — pin, KML boundary polygon, optional escape-route polylines.
 */
function ProjectSitePreviewMap({
  lat,
  lng,
  boundaryRing = null,
  escapeRoutes = EMPTY_ROUTES,
  geoPhotos = EMPTY_GEO,
  height = 220,
  label = "Site preview",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastBoundsKeyRef = useRef("");
  const labelRef = useRef(label);
  labelRef.current = label;

  const geometryKey = useMemo(
    () => boundsKey(lat, lng, boundaryRing, escapeRoutes, geoPhotos),
    [lat, lng, boundaryRing, escapeRoutes, geoPhotos]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;
    const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, maxZoom: 18 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          map.invalidateSize({ animate: false });
        })
      : null;
    ro?.observe(el);

    return () => {
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      lastBoundsKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = [];
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#0d9488";

    if (Array.isArray(boundaryRing) && boundaryRing.length >= 3) {
      L.polygon(boundaryRing, {
        color: accent,
        weight: 2,
        fillColor: accent,
        fillOpacity: 0.12,
      })
        .addTo(layer)
        .bindPopup("Site boundary");
      boundaryRing.forEach(([plat, plng]) => bounds.push([plat, plng]));
    }

    (escapeRoutes || []).forEach((route, idx) => {
      const pts = (route.points || [])
        .map((p) => {
          const plat = Number(p.lat);
          const plng = Number(p.lng);
          return Number.isFinite(plat) && Number.isFinite(plng) ? [plat, plng] : null;
        })
        .filter(Boolean);
      if (pts.length >= 2) {
        L.polyline(pts, { color: "#0C447C", weight: 3, dashArray: "6 4" })
          .addTo(layer)
          .bindPopup(route.name || `Escape route ${idx + 1}`);
        pts.forEach((p) => bounds.push(p));
      }
    });

    asStorageArray(geoPhotos).forEach((photo) => {
      if (!photo || typeof photo !== "object") return;
      const plat = Number(photo.latitude);
      const plng = Number(photo.longitude);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
      const preset = geoPhotoPreset(photo.type);
      const color = preset.color || "#ea580c";
      L.circleMarker([plat, plng], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .addTo(layer)
        .bindPopup(`${preset.icon} ${preset.label}`);
      const end = bearingToEnd(plat, plng, photo.bearing);
      if (end) {
        L.polyline(
          [
            [plat, plng],
            end,
          ],
          { color, weight: 2, opacity: 0.85 }
        ).addTo(layer);
        bounds.push(end);
      }
      bounds.push([plat, plng]);
    });

    const la = parseFloat(String(lat ?? "").trim());
    const lo = parseFloat(String(lng ?? "").trim());
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      L.circleMarker([la, lo], {
        radius: 8,
        color: "#0f172a",
        fillColor: "#0C447C",
        fillOpacity: 0.95,
        weight: 2,
      })
        .addTo(layer)
        .bindPopup(labelRef.current);
      bounds.push([la, lo]);
    }

    if (lastBoundsKeyRef.current === geometryKey) return;
    lastBoundsKeyRef.current = geometryKey;

    if (bounds.length === 1) {
      map.setView(bounds[0], 15, { animate: false });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
    } else {
      map.setView([54.5, -2.5], 6, { animate: false });
    }
  }, [geometryKey, boundaryRing, escapeRoutes, geoPhotos, lat, lng]);

  const hasBoundary = Array.isArray(boundaryRing) && boundaryRing.length >= 3;
  const hasCoords = Number.isFinite(parseFloat(String(lat ?? ""))) && Number.isFinite(parseFloat(String(lng ?? "")));

  if (!hasBoundary && !hasCoords && !(escapeRoutes || []).length && !(geoPhotos || []).length) {
    return (
      <div
        className="project-site-preview-map project-site-preview-map--empty"
        style={{ height }}
        role="status"
      >
        Map preview appears after postcode lookup or KML import.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="project-site-preview-map"
      style={{ height }}
      aria-label={label}
    />
  );
}

export default memo(ProjectSitePreviewMap);
