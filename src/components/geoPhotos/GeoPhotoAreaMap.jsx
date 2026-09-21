import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatAreaSqm, normaliseAreaPoints, polygonAreaSqm, MAX_AREA_VERTICES } from "../../utils/geoPhotoArea";

/** Grab handle for a traced corner: big enough for a gloved thumb, small enough to see past. */
function vertexIcon(color) {
  return L.divIcon({
    className: "geo-photo-area-map__vertex",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Map for tracing the extent of what a photo shows: tap to drop corners, drag to adjust,
 * tap a corner to drop it. Satellite imagery is the point — a boundary is only trustworthy
 * against the ground it is drawn over.
 */
function GeoPhotoAreaMap({
  points = [],
  onChange = null,
  latitude = null,
  longitude = null,
  color = "#16a34a",
  height = 260,
  satellite = true,
  readOnly = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pointsRef = useRef(points);
  const onChangeRef = useRef(onChange);
  const fittedRef = useRef(false);
  const draggedRef = useRef(false);

  // Handlers are bound once against the map, so they read the live values through refs
  // rather than being torn down and rebuilt on every dropped corner.
  useEffect(() => {
    pointsRef.current = points;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;

    const map = L.map(el, { zoomControl: true, scrollWheelZoom: true, maxZoom: 21 });
    const url = satellite
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(url, {
      attribution: satellite ? "&copy; Esri" : '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
      // Site boundaries are traced closer in than imagery is published; let Leaflet stretch
      // the last tiles rather than drop to a blank grid.
      maxNativeZoom: 19,
    }).addTo(map);

    const lat = Number(latitude);
    const lng = Number(longitude);
    map.setView(Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [51.5074, -0.1278], Number.isFinite(lat) ? 19 : 6);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const onMapClick = (e) => {
      if (readOnly || typeof onChangeRef.current !== "function") return;
      const current = normaliseAreaPoints(pointsRef.current);
      if (current.length >= MAX_AREA_VERTICES) return;
      onChangeRef.current([...current, [e.latlng.lat, e.latlng.lng]]);
    };
    map.on("click", onMapClick);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize({ animate: false })) : null;
    ro?.observe(el);

    return () => {
      ro?.disconnect();
      map.off("click", onMapClick);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [satellite, readOnly, latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const ring = normaliseAreaPoints(points);

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // The camera position, so the extent can be read against where the photo was taken from.
      L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: "#f8fafc",
        color: "#0f172a",
        weight: 2,
        fillOpacity: 1,
      }).addTo(layer);
    }

    if (ring.length >= 3) {
      const shape = L.polygon(ring, {
        color,
        weight: 2,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: 0.25,
      }).addTo(layer);
      const size = formatAreaSqm(polygonAreaSqm(ring));
      if (size) {
        shape.bindTooltip(size, { permanent: true, direction: "center", className: "geo-photo-area-map__label" });
      }
    } else if (ring.length === 2) {
      L.polyline(ring, { color, weight: 2, opacity: 0.9, dashArray: "6 5" }).addTo(layer);
    }

    if (!readOnly && typeof onChange === "function") {
      const icon = vertexIcon(color);
      ring.forEach((point, index) => {
        const marker = L.marker(point, { icon, draggable: true, keyboard: false }).addTo(layer);
        marker.bindTooltip(`Corner ${index + 1} — drag to move, tap to remove`, { direction: "top", opacity: 0.9 });
        marker.on("dragstart", () => {
          draggedRef.current = true;
        });
        marker.on("dragend", (e) => {
          const { lat: newLat, lng: newLng } = e.target.getLatLng();
          const next = normaliseAreaPoints(pointsRef.current).map((p, i) => (i === index ? [newLat, newLng] : p));
          onChangeRef.current?.(next);
          // Leaflet fires click after a drag on touch devices; ignore that one.
          window.setTimeout(() => {
            draggedRef.current = false;
          }, 250);
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (draggedRef.current) return;
          onChangeRef.current?.(normaliseAreaPoints(pointsRef.current).filter((_, i) => i !== index));
        });
      });
    }

    if (ring.length && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(ring).pad(0.3), { maxZoom: 20, animate: false });
      fittedRef.current = true;
    }
    // `satellite` is a dependency because switching base map rebuilds the map and its layer
    // group; without it the drawn shape would vanish until the next corner.
  }, [points, color, readOnly, onChange, latitude, longitude, satellite]);

  return (
    <div
      ref={containerRef}
      className="geo-photo-area-map"
      style={{ height, width: "100%", cursor: readOnly ? undefined : "crosshair" }}
      title={readOnly ? "Extent drawn on site" : "Tap the map to drop corners. Tap a corner to remove it."}
    />
  );
}

export default memo(GeoPhotoAreaMap);
