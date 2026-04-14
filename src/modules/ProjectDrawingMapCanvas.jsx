import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { drawingObjectTypeMeta } from "./permits/projectDrawingRegistry";

const OSM = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};
const SAT = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution:
    "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
};

function clampLat(n) {
  return Math.max(-85, Math.min(85, n));
}
function clampLng(n) {
  return Math.max(-180, Math.min(180, n));
}

/**
 * Map editor: place / select / pan, draggable markers, multi-select group move.
 * Auto zoom fits bounds only when going from 0 to 1+ points (not on every edit).
 */
const ProjectDrawingMapCanvas = forwardRef(function ProjectDrawingMapCanvas(
  {
    objects = [],
    tool = "place",
    selectedIds = [],
    basemap = "streets",
    defaultCenter = { lat: 51.505, lng: -0.09 },
    defaultZoom = 17,
    onAddAtLatLng,
    onBatchGeoUpdate,
    onSelectIds,
    onMarkerDragStart,
  },
  ref
) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const markersRef = useRef([]);
  const prevSig = useRef(null);
  const prevObjectCountRef = useRef(0);
  const groupDragRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const objectsRef = useRef(objects);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  const pointsSig = useMemo(
    () => objects.map((o) => `${o.id}:${o.geoLat}:${o.geoLng}`).join("|"),
    [objects]
  );

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom = 17) {
      const m = mapRef.current;
      if (!m || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      m.flyTo([lat, lng], zoom, { duration: 0.55 });
    },
    fitObjects() {
      const m = mapRef.current;
      const layer = layerRef.current;
      if (!m || !layer) return;
      if (typeof layer.getBounds === "function") {
        const b = layer.getBounds();
        if (b?.isValid?.()) {
          m.fitBounds(b, { padding: [40, 40], maxZoom: 19 });
          return;
        }
      }
      const bounds = [];
      layer.eachLayer((ly) => {
        const ll = ly.getLatLng?.();
        if (ll) bounds.push([ll.lat, ll.lng]);
      });
      if (bounds.length === 0) return;
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
    },
  }));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const map = L.map(el, { zoomControl: true });
    mapRef.current = map;
    layerRef.current = L.markerClusterGroup({ maxClusterRadius: 56, spiderfyOnMaxZoom: true }).addTo(map);
    map.setView([defaultCenter.lat, defaultCenter.lng], defaultZoom);
    return () => {
      tileRef.current = null;
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      prevSig.current = null;
      prevObjectCountRef.current = 0;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
      tileRef.current = null;
    }
    const next = basemap === "satellite" ? SAT : OSM;
    const t = L.tileLayer(next.url, {
      attribution: next.attribution,
      maxZoom: 19,
      crossOrigin: true,
    });
    t.addTo(map);
    tileRef.current = t;
  }, [basemap]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const t = window.setTimeout(() => {
      m.invalidateSize();
      window.setTimeout(() => m.invalidateSize(), 280);
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || tool !== "place" || !onAddAtLatLng) return undefined;
    const fn = (e) => {
      onAddAtLatLng(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", fn);
    return () => {
      map.off("click", fn);
    };
  }, [tool, onAddAtLatLng]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    const shouldRebuild = prevSig.current === null || prevSig.current !== pointsSig;
    const selected = new Set(selectedIds);
    const draggable = tool === "select";

    if (shouldRebuild) {
      prevSig.current = pointsSig;
      group.clearLayers();
      markersRef.current = [];
      const bounds = [];
      objects.forEach((row) => {
        const lat = row.geoLat;
        const lng = row.geoLng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const color = drawingObjectTypeMeta(row.type).color;
        const isSel = selected.has(row.id);
        const icon = L.divIcon({
          className: "pde-map-marker-wrap",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:${isSel ? "3px solid #fff" : "2px solid #fff"};box-shadow:0 0 0 ${isSel ? "2px rgba(13,148,136,0.5)" : "1px rgba(15,23,42,0.3)"};"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const m = L.marker([lat, lng], { icon, draggable });
        m.on("click", (ev) => {
          L.DomEvent.stopPropagation(ev);
          const e = ev.originalEvent;
          const additive = Boolean(e?.ctrlKey || e?.metaKey);
          onSelectIds?.(row.id, additive);
        });
        m.on("dragstart", () => {
          onMarkerDragStart?.();
          const sel = selectedIdsRef.current;
          const moveIds =
            sel.length > 1 && sel.includes(row.id)
              ? sel.filter((id) => {
                  const o = objectsRef.current.find((x) => x.id === id);
                  return o && Number.isFinite(o.geoLat) && Number.isFinite(o.geoLng);
                })
              : [row.id];
          const startById = {};
          moveIds.forEach((id) => {
            const o = objectsRef.current.find((x) => x.id === id);
            if (o && Number.isFinite(o.geoLat) && Number.isFinite(o.geoLng)) {
              startById[id] = { lat: o.geoLat, lng: o.geoLng };
            }
          });
          groupDragRef.current = { primaryId: row.id, ids: Object.keys(startById), startById };
        });
        m.on("dragend", (ev) => {
          const ll = ev.target.getLatLng();
          const g = groupDragRef.current;
          groupDragRef.current = null;
          if (!g || g.primaryId !== row.id || !g.startById[row.id]) {
            onBatchGeoUpdate?.([{ id: row.id, geoLat: ll.lat, geoLng: ll.lng }]);
            return;
          }
          const s0 = g.startById[g.primaryId];
          const dLat = ll.lat - s0.lat;
          const dLng = ll.lng - s0.lng;
          const updates = g.ids
            .map((id) => {
              const s = g.startById[id];
              if (!s) return null;
              return {
                id,
                geoLat: clampLat(s.lat + dLat),
                geoLng: clampLng(s.lng + dLng),
              };
            })
            .filter(Boolean);
          if (updates.length > 0) onBatchGeoUpdate?.(updates);
        });
        m.addTo(group);
        markersRef.current.push({ id: row.id, marker: m });
        bounds.push([lat, lng]);
      });
      const n = bounds.length;
      const wasEmpty = prevObjectCountRef.current === 0;
      prevObjectCountRef.current = n;
      if (bounds.length > 0 && wasEmpty) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 19 });
      }
      if (n === 0) {
        prevObjectCountRef.current = 0;
      }
    } else {
      markersRef.current.forEach(({ id, marker }) => {
        const isSel = selected.has(id);
        const row = objects.find((r) => r.id === id);
        const color = row ? drawingObjectTypeMeta(row.type).color : "#0C447C";
        const icon = L.divIcon({
          className: "pde-map-marker-wrap",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:${isSel ? "3px solid #fff" : "2px solid #fff"};box-shadow:0 0 0 ${isSel ? "2px rgba(13,148,136,0.5)" : "1px rgba(15,23,42,0.3)"};"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        marker.setIcon(icon);
        if (marker.dragging) {
          if (draggable) marker.dragging.enable();
          else marker.dragging.disable();
        }
      });
    }
  }, [objects, pointsSig, selectedIds, tool, onSelectIds, onBatchGeoUpdate, onMarkerDragStart]);

  return (
    <div
      id="pde-map-capture-root"
      ref={wrapRef}
      style={{
        width: "100%",
        height: 440,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
        background: "var(--color-background-secondary,#f1f5f9)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
    />
  );
});

export default ProjectDrawingMapCanvas;
