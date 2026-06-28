import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { bearingToEnd } from "../../utils/geoPhotoUtils";

/**
 * Mini map with photo point, optional accuracy circle, and bearing arrow polyline.
 */
function GeoPhotoDirectionMap({
  latitude,
  longitude,
  accuracyMeters = null,
  bearing = null,
  arrowColor = "#2563eb",
  height = 180,
  interactive = false,
  satellite = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;

    const map = L.map(el, {
      zoomControl: interactive,
      scrollWheelZoom: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
      maxZoom: 19,
    });

    const url = satellite
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(url, {
      attribution: satellite ? "&copy; Esri" : '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize({ animate: false })) : null;
    ro?.observe(el);

    return () => {
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [interactive, satellite]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      map.setView([51.5074, -0.1278], 6);
      return;
    }

    if (accuracyMeters != null && accuracyMeters > 0) {
      L.circle([lat, lng], {
        radius: Math.min(accuracyMeters, 80),
        color: arrowColor,
        weight: 1.5,
        opacity: 0.75,
        fillColor: arrowColor,
        fillOpacity: 0.12,
      }).addTo(layer);
    }

    L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: arrowColor,
      color: "#fff",
      weight: 2,
      fillOpacity: 0.95,
    }).addTo(layer);

    const end = bearingToEnd(lat, lng, bearing);
    if (end) {
      L.polyline(
        [
          [lat, lng],
          end,
        ],
        { color: arrowColor, weight: 4, opacity: 0.95 }
      ).addTo(layer);
    }

    map.setView([lat, lng], end ? 18 : 17, { animate: false });
  }, [latitude, longitude, accuracyMeters, bearing, arrowColor]);

  return (
    <div
      ref={containerRef}
      className="geo-photo-direction-map"
      style={{ height, width: "100%" }}
      title="Arrow shows camera direction (0°=North, 90°=East)"
    />
  );
}

export default memo(GeoPhotoDirectionMap);
