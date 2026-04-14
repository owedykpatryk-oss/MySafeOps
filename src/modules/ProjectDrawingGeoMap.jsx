import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Interactive OSM preview: points use illustrative lat/lng from planPercentToLatLng.
 * Rebuilds layers when point positions change; updates styles only when selection changes.
 */
export default function ProjectDrawingGeoMap({ points, selectedIds = [], onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const prevPointsSig = useRef(null);
  const prevPointCountRef = useRef(0);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const pointsSig = useMemo(() => points.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|"), [points]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const map = L.map(el, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    prevPointsSig.current = null;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      prevPointsSig.current = null;
      prevPointCountRef.current = 0;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    const shouldRebuild = prevPointsSig.current === null || prevPointsSig.current !== pointsSig;
    const selectedSet = new Set(selectedIds);

    if (shouldRebuild) {
      prevPointsSig.current = pointsSig;
      layer.clearLayers();
      const bounds = [];
      points.forEach((p) => {
        const isSel = selectedSet.has(p.id);
        const m = L.circleMarker([p.lat, p.lng], {
          radius: isSel ? 11 : 8,
          color: "#0f172a",
          fillColor: p.color || "#0C447C",
          fillOpacity: 0.9,
          weight: isSel ? 3 : 2,
          pdeId: p.id,
        });
        const title = String(p.title || "").replace(/</g, "&lt;");
        m.bindPopup(`<strong>${title}</strong><br/><span style="font-size:11px">Plan: ${Number(p.x).toFixed(1)}% × ${Number(p.y).toFixed(1)}%</span>`);
        m.on("click", () => onSelectRef.current?.(p.id));
        m.addTo(layer);
        bounds.push([p.lat, p.lng]);
      });
      const n = bounds.length;
      const wasEmpty = prevPointCountRef.current === 0;
      prevPointCountRef.current = n;
      if (bounds.length > 0) {
        if (wasEmpty) {
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
        }
      } else {
        prevPointCountRef.current = 0;
        map.setView([51.505, -0.09], 11);
      }
    } else {
      layer.eachLayer((ly) => {
        const id = ly.options?.pdeId;
        if (id == null || typeof ly.setStyle !== "function") return;
        const isSel = selectedSet.has(id);
        ly.setStyle({
          radius: isSel ? 11 : 8,
          weight: isSel ? 3 : 2,
        });
      });
    }
  }, [points, pointsSig, selectedIds]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 280,
        width: "100%",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
        background: "var(--color-background-secondary,#f7f7f5)",
        boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08)",
      }}
    />
  );
}
