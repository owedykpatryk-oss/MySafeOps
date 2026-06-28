import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { bearingToEnd } from "../../utils/geoPhotoUtils";
import { geoPhotoPreset } from "../../utils/geoPhotoPresets";

/**
 * Map showing multiple geo-photos with direction arrows.
 */
function GeoPhotosMap({ photos = [], height = 320, satellite = false, onPhotoClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;

    const map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: true,
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
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const valid = photos.filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
    if (valid.length === 0) {
      map.setView([51.5074, -0.1278], 6);
      return;
    }

    const bounds = L.latLngBounds([]);
    valid.forEach((photo) => {
      const lat = Number(photo.latitude);
      const lng = Number(photo.longitude);
      const preset = geoPhotoPreset(photo.type);
      const color = preset.color || "#2563eb";

      L.circleMarker([lat, lng], {
        radius: 7,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.95,
      })
        .bindTooltip(`${preset.icon} ${preset.label}${photo.notes ? ` — ${photo.notes.slice(0, 40)}` : ""}`, {
          direction: "top",
          opacity: 0.95,
        })
        .on("click", () => onPhotoClick?.(photo))
        .addTo(layer);

      const end = bearingToEnd(lat, lng, photo.bearing);
      if (end) {
        L.polyline(
          [
            [lat, lng],
            end,
          ],
          { color, weight: 3, opacity: 0.9 }
        ).addTo(layer);
      }

      bounds.extend([lat, lng]);
      if (end) bounds.extend(end);
    });

    map.fitBounds(bounds.pad(0.15), { maxZoom: 18, animate: false });
  }, [photos, onPhotoClick]);

  return (
    <div
      ref={containerRef}
      className="geo-photos-map"
      style={{ height, width: "100%" }}
    />
  );
}

export default memo(GeoPhotosMap);
