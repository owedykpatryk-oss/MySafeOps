import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { drawingObjectTypeMeta } from "./permits/projectDrawingRegistry";
import { pdeAreaKindMeta } from "./permits/projectDrawingAreas";

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

/** Avoid Leaflet `_leaflet_pos` crashes after unmount / mid navigation. */
function safeInvalidate(map) {
  try {
    if (!map || !map._loaded || !map.getContainer?.()?.parentNode) return false;
    map.invalidateSize({ animate: false });
    return true;
  } catch {
    return false;
  }
}

/** Squared distance from lat/lng point to line segment (flat approx, fine for site scale). */
function pointToSegmentDist2(p, a, b) {
  const px = p.lat;
  const py = p.lng;
  const ax = a.lat;
  const ay = a.lng;
  const bx = b.lat;
  const by = b.lng;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    const dlat = px - ax;
    const dlng = py - ay;
    return dlat * dlat + dlng * dlng;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const dlat = px - cx;
  const dlng = py - cy;
  return dlat * dlat + dlng * dlng;
}

function closestSegmentInsertIndex(lat, lng, points) {
  if (!points || points.length < 2) return 1;
  let bestIdx = 0;
  let bestDist = Infinity;
  const click = { lat, lng };
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = { lat: points[i][0], lng: points[i][1] };
    const b = { lat: points[i + 1][0], lng: points[i + 1][1] };
    const d = pointToSegmentDist2(click, a, b);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx + 1;
}

function markerHtml(row, selected) {
  const meta = drawingObjectTypeMeta(row.type);
  const color = meta.color || "#0C447C";
  const short = String(meta.short || "").slice(0, 3);
  const isSel = selected;
  const border = isSel ? "3px solid #fff" : "2px solid #fff";
  const shadow = isSel ? "0 0 0 2px rgba(13,148,136,0.5)" : "1px rgba(15,23,42,0.3)";
  const shape = meta.shape;
  let inner;
  if (shape === "diamond") {
    inner = `<div style="width:14px;height:14px;background:${color};transform:rotate(45deg);border:${border};box-shadow:${shadow};"></div>`;
  } else if (shape === "square") {
    inner = `<div style="width:16px;height:16px;border-radius:3px;background:${color};border:${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff;">${short}</div>`;
  } else if (shape === "star") {
    inner = `<div style="width:18px;height:18px;background:${color};clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);border:${border};box-shadow:${shadow};"></div>`;
  } else {
    inner = `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff;line-height:1;">${short}</div>`;
  }
  return inner;
}

function geoRingToLatLngs(ring) {
  if (!Array.isArray(ring)) return [];
  return ring
    .map((p) => {
      const lat = Number(p.geoLat ?? p.lat);
      const lng = Number(p.geoLng ?? p.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    })
    .filter(Boolean);
}

/**
 * Map editor: place / select / pan / boundary / area, draggable markers, area polygons.
 */
const ProjectDrawingMapCanvas = forwardRef(function ProjectDrawingMapCanvas(
  {
    objects = [],
    areaObjects = [],
    tool = "place",
    selectedIds = [],
    basemap = "streets",
    defaultCenter = { lat: 51.505, lng: -0.09 },
    defaultZoom = 17,
    boundaryRing = null,
    draftRing = [],
    draftRingColor = "#0d9488",
    draftMode = "polygon",
    escapeRoutes = [],
    highlightEscapeRouteId = "",
    highlightEscapeRoutePointIndex = -1,
    layers = {
      markers: true,
      boundary: true,
      areas: true,
      escapeRoutes: true,
      hospitalRoute: true,
    },
    hospitalOverlay = null,
    onAddAtLatLng,
    onDraftPoint,
    onBatchGeoUpdate,
    onSelectIds,
    onMarkerDragStart,
    onEscapeRoutePointsUpdate,
    onEscapeRoutePointSelect,
    onEscapeRouteInsertPoint,
  },
  ref
) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const areaLayerRef = useRef(null);
  const draftLayerRef = useRef(null);
  const hospitalLayerRef = useRef(null);
  const escapeLayerRef = useRef(null);
  const tileRef = useRef(null);
  const markersRef = useRef([]);
  const prevSig = useRef(null);
  const prevObjectCountRef = useRef(0);
  const prevCenterRef = useRef(null);
  const prevBoundarySigRef = useRef("");
  const prevAreaSigRef = useRef("");
  const prevEscapeSigRef = useRef("");
  const prevDraftSigRef = useRef("");
  const groupDragRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const objectsRef = useRef(objects);
  const onDraftPointRef = useRef(onDraftPoint);
  const onEscapeRoutePointsUpdateRef = useRef(onEscapeRoutePointsUpdate);
  const onEscapeRouteInsertPointRef = useRef(onEscapeRouteInsertPoint);

  useEffect(() => {
    onEscapeRoutePointsUpdateRef.current = onEscapeRoutePointsUpdate;
  }, [onEscapeRoutePointsUpdate]);

  useEffect(() => {
    onEscapeRouteInsertPointRef.current = onEscapeRouteInsertPoint;
  }, [onEscapeRouteInsertPoint]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);
  useEffect(() => {
    onDraftPointRef.current = onDraftPoint;
  }, [onDraftPoint]);

  const pointsSig = useMemo(
    () => objects.map((o) => `${o.id}:${o.geoLat}:${o.geoLng}`).join("|"),
    [objects]
  );

  const areaSig = useMemo(
    () =>
      areaObjects
        .map((o) => `${o.id}:${(o.ring || []).map((p) => `${p.geoLat},${p.geoLng}`).join(";")}`)
        .join("|"),
    [areaObjects]
  );

  const draftSig = useMemo(
    () => draftRing.map((p) => `${Number(p.geoLat).toFixed(6)},${Number(p.geoLng).toFixed(6)}`).join("|"),
    [draftRing]
  );

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom = 17) {
      const m = mapRef.current;
      if (!m || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      try {
        safeInvalidate(m);
        const size = m.getSize?.();
        if (!size || size.x <= 0 || size.y <= 0) {
          m.setView([lat, lng], zoom, { animate: false });
          return;
        }
        m.flyTo([lat, lng], zoom, { duration: 0.55 });
      } catch {
        try {
          m.setView([lat, lng], zoom, { animate: false });
        } catch {
          /* map torn down */
        }
      }
    },
    fitObjects() {
      const m = mapRef.current;
      const group = layerRef.current;
      if (!m || !group) return;
      try {
        if (!safeInvalidate(m)) return;
        const bounds = [];
        group.eachLayer((ly) => {
          const ll = ly.getLatLng?.();
          if (ll) bounds.push([ll.lat, ll.lng]);
        });
        areaLayerRef.current?.eachLayer?.((ly) => {
          if (typeof ly.getBounds === "function") {
            const b = ly.getBounds();
            if (b?.isValid?.()) bounds.push(b.getSouthWest(), b.getNorthEast());
          }
        });
        if (bounds.length === 0) return;
        m.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
      } catch {
        /* map not ready */
      }
    },
    getView() {
      const m = mapRef.current;
      if (!m) return null;
      try {
        const c = m.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: m.getZoom() };
      } catch {
        return null;
      }
    },
    setView(lat, lng, zoom) {
      const m = mapRef.current;
      if (!m || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      try {
        if (!safeInvalidate(m)) return;
        m.setView([lat, lng], Number.isFinite(zoom) ? zoom : m.getZoom(), { animate: false });
      } catch {
        /* map not ready */
      }
    },
    fitHospitalRoute(ring, opts = {}) {
      const m = mapRef.current;
      if (!m || !Array.isArray(ring) || ring.length < 2) return;
      try {
        if (!safeInvalidate(m)) return;
        m.fitBounds(ring, {
          padding: opts.padding || [48, 48],
          maxZoom: opts.maxZoom ?? 15,
          animate: false,
        });
      } catch {
        /* map not ready */
      }
    },
    fitEscapeRoute(points) {
      const m = mapRef.current;
      if (!m || !Array.isArray(points) || points.length < 2) return;
      const ring = points
        .map((p) => {
          const lat = Number(p.lat);
          const lng = Number(p.lng);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean);
      if (ring.length < 2) return;
      try {
        if (!safeInvalidate(m)) return;
        m.fitBounds(ring, { padding: [48, 48], maxZoom: 17 });
      } catch {
        /* map not ready */
      }
    },
  }));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const map = L.map(el, { zoomControl: true, maxZoom: 19 });
    mapRef.current = map;
    layerRef.current = L.markerClusterGroup({ maxClusterRadius: 56, spiderfyOnMaxZoom: true }).addTo(map);
    boundaryLayerRef.current = L.layerGroup().addTo(map);
    areaLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    hospitalLayerRef.current = L.layerGroup().addTo(map);
    escapeLayerRef.current = L.layerGroup().addTo(map);
    map.setView([defaultCenter.lat, defaultCenter.lng], defaultZoom);
    return () => {
      tileRef.current = null;
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      boundaryLayerRef.current = null;
      areaLayerRef.current = null;
      draftLayerRef.current = null;
      hospitalLayerRef.current = null;
      escapeLayerRef.current = null;
      prevSig.current = null;
      prevObjectCountRef.current = 0;
      prevBoundarySigRef.current = "";
      prevAreaSigRef.current = "";
      prevDraftSigRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lat = Number(defaultCenter.lat);
    const lng = Number(defaultCenter.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (prevCenterRef.current === key) return;
    prevCenterRef.current = key;
    const hasObjects = prevObjectCountRef.current > 0;
    try {
      if (!safeInvalidate(map)) return;
      if (hasObjects) map.setView([lat, lng], defaultZoom, { animate: false });
      else map.flyTo([lat, lng], defaultZoom, { duration: 0.55 });
    } catch {
      try {
        map.setView([lat, lng], defaultZoom, { animate: false });
      } catch {
        /* map torn down */
      }
    }
  }, [defaultCenter.lat, defaultCenter.lng, defaultZoom]);

  useEffect(() => {
    const boundaryLayer = boundaryLayerRef.current;
    if (!boundaryLayer) return;
    const ring = Array.isArray(boundaryRing) ? boundaryRing : [];
    const sig = `${layers.boundary ? "1" : "0"}|${ring.map(([plat, plng]) => `${Number(plat).toFixed(5)},${Number(plng).toFixed(5)}`).join(";")}`;
    if (prevBoundarySigRef.current === sig) return;
    prevBoundarySigRef.current = sig;
    boundaryLayer.clearLayers();
    if (!layers.boundary) return;
    const lat = Number(defaultCenter.lat);
    const lng = Number(defaultCenter.lng);
    if (ring.length >= 3) {
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#0d9488";
      L.polygon(ring, {
        color: accent,
        weight: 2,
        fillColor: accent,
        fillOpacity: 0.1,
        dashArray: "6 4",
      })
        .addTo(boundaryLayer)
        .bindPopup("Site boundary");
    }
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      L.circleMarker([lat, lng], {
        radius: 7,
        color: "#0f172a",
        fillColor: "#0C447C",
        fillOpacity: 0.95,
        weight: 2,
      })
        .addTo(boundaryLayer)
        .bindPopup(ring.length >= 3 ? "Site centre" : "Project site");
    }
  }, [boundaryRing, defaultCenter.lat, defaultCenter.lng, layers.boundary]);

  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    if (prevAreaSigRef.current === areaSig && !layers.areas) {
      layer.clearLayers();
      return;
    }
    if (!layers.areas) {
      prevAreaSigRef.current = "";
      layer.clearLayers();
      return;
    }
    if (prevAreaSigRef.current === areaSig) return;
    prevAreaSigRef.current = areaSig;
    layer.clearLayers();
    areaObjects.forEach((row) => {
      const latLngs = geoRingToLatLngs(row.ring);
      if (latLngs.length < 3) return;
      const kind = pdeAreaKindMeta(row.meta?.areaKind);
      const isSel = selectedIds.includes(row.id);
      L.polygon(latLngs, {
        color: kind.color,
        weight: isSel ? 3 : 2,
        fillColor: kind.color,
        fillOpacity: 0.22,
        dashArray: isSel ? null : "4 3",
      })
        .addTo(layer)
        .bindPopup(row.label || kind.label)
        .on("click", (ev) => {
          L.DomEvent.stopPropagation(ev);
          const additive = Boolean(ev.originalEvent?.ctrlKey || ev.originalEvent?.metaKey);
          onSelectIds?.(row.id, additive);
        });
    });
  }, [areaObjects, areaSig, selectedIds, onSelectIds, layers.areas]);

  useEffect(() => {
    const layer = draftLayerRef.current;
    if (!layer) return;
    if (prevDraftSigRef.current === draftSig) return;
    prevDraftSigRef.current = draftSig;
    layer.clearLayers();
    const latLngs = geoRingToLatLngs(draftRing);
    latLngs.forEach(([lat, lng], idx) => {
      L.circleMarker([lat, lng], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: draftRingColor,
        fillOpacity: 1,
      })
        .addTo(layer)
        .bindPopup(`Point ${idx + 1}`);
    });
    if (latLngs.length >= 2) {
      if (draftMode === "route") {
        L.polyline(latLngs, { color: draftRingColor, weight: 3, dashArray: "8 5", opacity: 0.9 }).addTo(layer);
      } else {
        L.polyline(latLngs, { color: draftRingColor, weight: 2, dashArray: "5 4" }).addTo(layer);
      }
    }
    if (latLngs.length >= 3 && draftMode !== "route") {
      L.polygon(latLngs, {
        color: draftRingColor,
        weight: 2,
        fillColor: draftRingColor,
        fillOpacity: 0.12,
        dashArray: "6 4",
      }).addTo(layer);
    }
  }, [draftRing, draftSig, draftRingColor, draftMode]);

  useEffect(() => {
    const layer = escapeLayerRef.current;
    if (!layer) return;
    const sig = `${highlightEscapeRouteId}|${highlightEscapeRoutePointIndex}|${tool}|${layers.escapeRoutes ? "1" : "0"}|${(escapeRoutes || [])
      .map((r) => `${r.id}:${(r.points || []).map((p) => `${p.lat},${p.lng}`).join(";")}`)
      .join("|")}`;
    if (prevEscapeSigRef.current === sig) return;
    prevEscapeSigRef.current = sig;
    layer.clearLayers();
    if (!layers.escapeRoutes) return;
    (escapeRoutes || []).forEach((route) => {
      const pts = (route.points || [])
        .map((p) => {
          const lat = Number(p.lat);
          const lng = Number(p.lng);
          return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
        })
        .filter(Boolean);
      if (pts.length < 2) return;
      const highlighted = highlightEscapeRouteId && route.id === highlightEscapeRouteId;
      const line = L.polyline(pts, {
        color: highlighted ? "#ea580c" : "#0C447C",
        weight: highlighted ? 6 : 4,
        opacity: highlighted ? 1 : 0.85,
        dashArray: highlighted ? null : "10 6",
      })
        .addTo(layer)
        .bindPopup(route.name || "Escape route");

      if (highlighted && tool === "select" && typeof onEscapeRouteInsertPointRef.current === "function") {
        line.on("click", (ev) => {
          L.DomEvent.stopPropagation(ev);
          const ll = ev.latlng;
          const insertAt = closestSegmentInsertIndex(ll.lat, ll.lng, pts);
          onEscapeRouteInsertPointRef.current?.(route.id, insertAt, clampLat(ll.lat), clampLng(ll.lng));
        });
      }

      if (
        highlighted &&
        tool === "select" &&
        typeof onEscapeRoutePointsUpdateRef.current === "function"
      ) {
        (route.points || []).forEach((p, idx) => {
          const lat = Number(p.lat);
          const lng = Number(p.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const selected = idx === highlightEscapeRoutePointIndex;
          const handle = L.circleMarker([lat, lng], {
            radius: selected ? 10 : 8,
            color: "#fff",
            weight: selected ? 3 : 2,
            fillColor: selected ? "#c2410c" : "#ea580c",
            fillOpacity: 1,
            draggable: true,
          });
          handle.on("dragstart", () => onMarkerDragStart?.());
          handle.on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            onEscapeRoutePointSelect?.(route.id, idx);
          });
          handle.on("dragend", () => {
            const ll = handle.getLatLng();
            const nextPoints = (route.points || []).map((pt, i) =>
              i === idx
                ? { lat: clampLat(ll.lat), lng: clampLng(ll.lng) }
                : { lat: Number(pt.lat), lng: Number(pt.lng) }
            );
            onEscapeRoutePointsUpdateRef.current?.(route.id, nextPoints);
          });
          handle.addTo(layer);
        });
      }
    });
  }, [
    escapeRoutes,
    highlightEscapeRouteId,
    highlightEscapeRoutePointIndex,
    layers.escapeRoutes,
    tool,
    onMarkerDragStart,
    onEscapeRoutePointSelect,
  ]);

  useEffect(() => {
    const layer = hospitalLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!layers.hospitalRoute) return;
    if (!hospitalOverlay?.show || !Array.isArray(hospitalOverlay.ring) || hospitalOverlay.ring.length < 2) return;

    const ring = hospitalOverlay.ring;
    L.polyline(ring, {
      color: "#dc2626",
      weight: 5,
      opacity: 0.88,
      dashArray: "10 6",
      lineCap: "round",
    })
      .addTo(layer)
      .bindPopup("Route to nearest A&E");

    const hosp = hospitalOverlay.hospital;
    if (hosp && Number.isFinite(hosp.lat) && Number.isFinite(hosp.lng)) {
      L.circleMarker([hosp.lat, hosp.lng], {
        radius: 10,
        color: "#fff",
        weight: 3,
        fillColor: "#dc2626",
        fillOpacity: 0.95,
      })
        .addTo(layer)
        .bindPopup(`<strong>${String(hosp.name || "Hospital").replace(/</g, "&lt;")}</strong><br/>Nearest A&E`);
    }
  }, [hospitalOverlay, layers.hospitalRoute]);

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
      crossOrigin: "anonymous",
    });
    t.addTo(map);
    tileRef.current = t;
  }, [basemap]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return undefined;
    let t2 = null;
    const t = window.setTimeout(() => {
      safeInvalidate(m);
      t2 = window.setTimeout(() => safeInvalidate(m), 280);
    }, 80);
    return () => {
      window.clearTimeout(t);
      if (t2 != null) window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (tool === "place" && onAddAtLatLng) {
      const fn = (e) => onAddAtLatLng(e.latlng.lat, e.latlng.lng);
      map.on("click", fn);
      return () => map.off("click", fn);
    }
    if ((tool === "boundary" || tool === "area" || tool === "route") && onDraftPointRef.current) {
      const fn = (e) => onDraftPointRef.current?.(e.latlng.lat, e.latlng.lng);
      map.on("click", fn);
      return () => map.off("click", fn);
    }
    return undefined;
  }, [tool, onAddAtLatLng]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    if (!layers.markers) {
      prevSig.current = "";
      group.clearLayers();
      markersRef.current = [];
      return;
    }

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
        const isSel = selected.has(row.id);
        const icon = L.divIcon({
          className: "pde-map-marker-wrap",
          html: markerHtml(row, isSel),
          iconSize: [18, 18],
          iconAnchor: [9, 9],
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
        try {
          if (!safeInvalidate(map)) return;
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 19 });
        } catch {
          /* map not ready */
        }
      }
      if (n === 0) prevObjectCountRef.current = 0;
    } else {
      markersRef.current.forEach(({ id, marker }) => {
        const isSel = selected.has(id);
        const row = objects.find((r) => r.id === id);
        const icon = L.divIcon({
          className: "pde-map-marker-wrap",
          html: markerHtml(row || { type: "zone" }, isSel),
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        marker.setIcon(icon);
        if (marker.dragging) {
          if (draggable) marker.dragging.enable();
          else marker.dragging.disable();
        }
      });
    }
  }, [objects, pointsSig, selectedIds, tool, onSelectIds, onBatchGeoUpdate, onMarkerDragStart, layers.markers]);

  return (
    <div
      ref={wrapRef}
      className="pde-map-canvas"
      style={{
        width: "100%",
        height: 440,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--color-border-tertiary,#e5e5e5)",
        background: "var(--color-background-secondary,#f1f5f9)",
        boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.5)",
        cursor: tool === "boundary" || tool === "area" || tool === "route" ? "crosshair" : undefined,
      }}
    />
  );
});

export default ProjectDrawingMapCanvas;
