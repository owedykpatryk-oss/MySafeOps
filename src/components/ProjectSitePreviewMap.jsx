import { memo, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { bearingToEnd } from "../utils/geoPhotoUtils";
import { geoPhotoPreset } from "../utils/geoPhotoPresets";
import { asStorageArray } from "../utils/orgStorage";

const EMPTY_ROUTES = [];
const EMPTY_GEO = [];

const OSM = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};
const SAT = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
};

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

function isKmlFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  return name.endsWith(".kml") || name.endsWith(".kmz");
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function mapHasLayout(map) {
  if (!map) return false;
  try {
    if (map._loaded === false) return false;
    const el = map.getContainer?.();
    if (!el?.parentNode) return false;
    const size = map.getSize?.();
    return Boolean(size && size.x > 0 && size.y > 0);
  } catch {
    return false;
  }
}

function applyMapBounds(map, bounds, { animate = false } = {}) {
  if (!map || !Array.isArray(bounds) || bounds.length === 0) return false;
  try {
    if (!map.getContainer?.()?.parentNode) return false;
    map.invalidateSize({ animate: false });
  } catch {
    return false;
  }
  if (!mapHasLayout(map)) return false;

  try {
    if (bounds.length === 1) {
      const zoom = 15;
      if (animate) map.flyTo(bounds[0], zoom, { duration: 0.55 });
      else map.setView(bounds[0], zoom, { animate: false });
    } else {
      const opts = { padding: [24, 24], maxZoom: 17 };
      if (animate && typeof map.flyToBounds === "function") {
        map.flyToBounds(bounds, { ...opts, duration: 0.6 });
      } else {
        map.fitBounds(bounds, { ...opts, animate: false });
      }
    }
    return true;
  } catch {
    try {
      if (!map.getContainer?.()?.parentNode) return false;
      if (bounds.length === 1) {
        map.setView(bounds[0], 15, { animate: false });
      } else {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
      }
      return true;
    } catch {
      return false;
    }
  }
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
  showLegend = false,
  basemap = "streets",
  onBasemapChange = null,
  showBasemapToggle = false,
  animateZoom = false,
  onKmlDrop = null,
  kmlDropBusy = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const lastBoundsKeyRef = useRef("");
  const fitMapRef = useRef(() => {});
  const fitRetryRef = useRef(0);
  const hasFittedOnceRef = useRef(false);
  const pendingBoundsRef = useRef([]);
  const labelRef = useRef(label);
  const [kmlDragOver, setKmlDragOver] = useState(false);
  labelRef.current = label;

  const geometryKey = useMemo(
    () => boundsKey(lat, lng, boundaryRing, escapeRoutes, geoPhotos),
    [lat, lng, boundaryRing, escapeRoutes, geoPhotos]
  );

  const hasBoundary = Array.isArray(boundaryRing) && boundaryRing.length >= 3;
  const hasCoords = Number.isFinite(parseFloat(String(lat ?? ""))) && Number.isFinite(parseFloat(String(lng ?? "")));
  const hasRoutes = (escapeRoutes || []).some((r) => (r.points || []).length >= 2);
  const hasMapContent = hasBoundary || hasCoords || hasRoutes || asStorageArray(geoPhotos).length > 0;
  const canDropKml = typeof onKmlDrop === "function";

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;
    const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, maxZoom: 18 });
    const tile = L.tileLayer(OSM.url, { attribution: OSM.attribution, maxZoom: 19 }).addTo(map);
    tile.bringToBack();
    tileRef.current = tile;
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    try {
      map.setView([54.5, -2.5], 6, { animate: false });
    } catch {
      /* container may be display:none on first paint */
    }

    let disposed = false;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (disposed || mapRef.current !== map) return;
            try {
              if (!map.getContainer?.()?.parentNode) return;
              map.invalidateSize({ animate: false });
              requestAnimationFrame(() => {
                if (!disposed && mapRef.current === map) fitMapRef.current();
              });
            } catch {
              /* map torn down mid-resize */
            }
          })
        : null;
    ro?.observe(el);

    return () => {
      disposed = true;
      ro?.disconnect();
      fitMapRef.current = () => {};
      try {
        map.remove();
      } catch {
        /* already removed */
      }
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
      lastBoundsKeyRef.current = "";
      fitRetryRef.current = 0;
      hasFittedOnceRef.current = false;
      pendingBoundsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = basemap === "satellite" ? SAT : OSM;
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
      tileRef.current = null;
    }
    tileRef.current = L.tileLayer(next.url, { attribution: next.attribution, maxZoom: 19 }).addTo(map);
    tileRef.current.bringToBack();
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasMapContent) return;
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      fitMapRef.current();
    });
  }, [hasMapContent]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !hasMapContent) return;

    if (lastBoundsKeyRef.current === geometryKey) return;
    lastBoundsKeyRef.current = geometryKey;

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
        L.polyline([[plat, plng], end], { color, weight: 2, opacity: 0.85 }).addTo(layer);
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

    const fitMap = () => {
      if (mapRef.current !== map) return;
      pendingBoundsRef.current = bounds;
      const animate = animateZoom && !prefersReducedMotion() && hasFittedOnceRef.current;
      const applied = applyMapBounds(map, bounds, { animate });
      if (applied) {
        hasFittedOnceRef.current = true;
        fitRetryRef.current = 0;
        return;
      }
      if (fitRetryRef.current >= 12) {
        applyMapBounds(map, bounds.length ? bounds : [[54.5, -2.5]], { animate: false });
        hasFittedOnceRef.current = true;
        fitRetryRef.current = 0;
        return;
      }
      fitRetryRef.current += 1;
      requestAnimationFrame(() => {
        if (mapRef.current === map && pendingBoundsRef.current === bounds) fitMapRef.current();
      });
    };

    fitMapRef.current = fitMap;
    fitMap();
  }, [geometryKey, boundaryRing, escapeRoutes, geoPhotos, lat, lng, hasMapContent, animateZoom]);

  const handleKmlFile = (file) => {
    if (!isKmlFile(file) || kmlDropBusy) return;
    onKmlDrop?.(file);
  };

  const dropHandlers = canDropKml
    ? {
        onDragEnter: (e) => {
          e.preventDefault();
          setKmlDragOver(true);
        },
        onDragOver: (e) => {
          e.preventDefault();
          setKmlDragOver(true);
        },
        onDragLeave: (e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          setKmlDragOver(false);
        },
        onDrop: (e) => {
          e.preventDefault();
          setKmlDragOver(false);
          handleKmlFile(e.dataTransfer?.files?.[0]);
        },
      }
    : {};

  return (
    <div
      className={`project-site-preview-map-wrap${kmlDragOver ? " project-site-preview-map-wrap--drop" : ""}`}
      {...dropHandlers}
    >
      {showBasemapToggle && onBasemapChange ? (
        <div className="project-site-preview-map__toolbar">
          <div className="project-site-preview-map__basemap" role="group" aria-label="Map style">
            <button
              type="button"
              className={`project-site-preview-map__basemap-btn${basemap === "streets" ? " project-site-preview-map__basemap-btn--active" : ""}`}
              onClick={() => onBasemapChange("streets")}
            >
              Map
            </button>
            <button
              type="button"
              className={`project-site-preview-map__basemap-btn${basemap === "satellite" ? " project-site-preview-map__basemap-btn--active" : ""}`}
              onClick={() => onBasemapChange("satellite")}
            >
              Satellite
            </button>
          </div>
          {canDropKml ? (
            <span className="project-site-preview-map__drop-hint">
              {kmlDragOver ? "Drop KML to import" : "Drop KML here"}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="project-site-preview-map"
        style={{ height, display: hasMapContent ? "block" : "none" }}
        aria-label={hasMapContent ? label : undefined}
      />
      {!hasMapContent ? (
        <div
          className={`project-site-preview-map project-site-preview-map--empty${kmlDragOver ? " project-site-preview-map--empty-drop" : ""}`}
          style={{ height }}
          role="status"
        >
          <span className="project-site-preview-map__empty-icon" aria-hidden>📍</span>
          <strong className="project-site-preview-map__empty-title">Site map preview</strong>
          <p className="project-site-preview-map__empty-text">
            {canDropKml
              ? "Enter a postcode, drop a KML file, or browse below — the map will zoom to your site."
              : "Enter a postcode or import a KML boundary — the map will zoom to your site automatically."}
          </p>
        </div>
      ) : null}
      {showLegend && hasMapContent ? (
        <ul className="project-site-preview-legend" aria-label="Map legend">
          {hasCoords ? <li><span className="project-site-preview-legend__swatch project-site-preview-legend__swatch--pin" /> Site centre</li> : null}
          {hasBoundary ? <li><span className="project-site-preview-legend__swatch project-site-preview-legend__swatch--boundary" /> Site boundary</li> : null}
          {hasRoutes ? <li><span className="project-site-preview-legend__swatch project-site-preview-legend__swatch--route" /> Escape route</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export default memo(ProjectSitePreviewMap);
