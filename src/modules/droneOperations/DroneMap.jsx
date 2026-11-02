import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parseDroneGeometry } from "./droneGeometry.js";
import {
  MAP_AREAS,
  MAP_POINTS,
  MAP_DESTINATIONS,
  parseMapCentre,
  downloadMapLayer,
  flightAreaFromBoundary,
} from "./mapTools.js";

const providers = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Imagery &copy; <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a>, Vantor, Earthstar Geographics, GIS User Community',
  },
};
const pointSymbols = { takeoff: "T", landing: "L", alternateLanding: "A" };

export default function DroneMap({ mission, onChange, readOnly = false, preview = false }) {
  const element = useRef(null),
    map = useRef(null),
    layers = useRef(null),
    draft = useRef(null),
    navigation = useRef(null),
    bounds = useRef(null);
  const latest = useRef({ mission, onChange });
  const [mode, setMode] = useState(""),
    [points, setPoints] = useState([]),
    [error, setError] = useState("");
  const [basemap, setBasemap] = useState("streets"),
    [tileError, setTileError] = useState(false),
    [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(() =>
    Object.fromEntries(Object.keys(MAP_DESTINATIONS).map((key) => [key, true]))
  );
  const [centre, setCentre] = useState(""),
    [exportTarget, setExportTarget] = useState("boundary");
  const interaction = useRef({ mode, readOnly });
  latest.current = { mission, onChange };
  interaction.current = { mode, readOnly };
  const data = useMemo(
    () => ({
      boundary: mission.boundary,
      flightArea: mission.flightArea,
      contingencyArea: mission.contingencyArea,
      safetyArea: mission.safetyArea,
      takeoff: mission.takeoff,
      landing: mission.landing,
      alternateLanding: mission.alternateLanding,
    }),
    [
      mission.boundary,
      mission.flightArea,
      mission.contingencyArea,
      mission.safetyArea,
      mission.takeoff,
      mission.landing,
      mission.alternateLanding,
    ]
  );
  function fit() {
    if (bounds.current?.isValid())
      map.current?.fitBounds(bounds.current, { padding: [30, 30], maxZoom: 18, animate: false });
  }
  function saveMapChange(changes) {
    try {
      if (!latest.current.onChange?.(changes)) {
        setError("Map change was not saved. Retry, or cancel drawing.");
        return false;
      }
      setError("");
      return true;
    } catch (e) {
      setError(`Map change was not saved. ${e.message}`);
      return false;
    }
  }
  useEffect(() => {
    const au = latest.current.mission.regionCode === "au";
    const m = L.map(element.current, { scrollWheelZoom: false }).setView(au ? [-25, 134] : [54, -2], au ? 4 : 5);
    L.control.scale({ imperial: false }).addTo(m);
    layers.current = L.layerGroup().addTo(m);
    draft.current = L.layerGroup().addTo(m);
    navigation.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on("click", (e) => {
      const state = interaction.current;
      if (state.readOnly || !state.mode) return;
      const p = [Number(e.latlng.wrap().lng.toFixed(7)), Number(e.latlng.lat.toFixed(7))];
      if (Math.abs(p[1]) > 85) {
        setError("Choose a point within latitude -85 to 85.");
        return;
      }
      if (Object.hasOwn(MAP_POINTS, state.mode)) {
        if (saveMapChange({ [state.mode]: p })) setMode("");
      } else setPoints((prev) => (prev.length < 499 ? [...prev, p] : prev));
    });
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(element.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    setTileError(false);
    const provider = providers[basemap === "streets" ? "streets" : "satellite"];
    const base = L.tileLayer(provider.url, { attribution: provider.attribution, maxZoom: 19, maxNativeZoom: 19 }).addTo(
      m
    );
    const failed = () => setTileError(true);
    base.on("tileerror", failed);
    let labels;
    if (basemap === "hybrid") {
      labels = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, maxNativeZoom: 19, attribution: "Labels &copy; Esri, HERE, Garmin, FAO, NOAA, USGS" }
      ).addTo(m);
      labels.on("tileerror", failed);
    }
    return () => {
      base.off("tileerror", failed);
      base.remove();
      if (labels) {
        labels.off("tileerror", failed);
        labels.remove();
      }
    };
  }, [basemap, retry]);
  useEffect(() => {
    if (!map.current) return;
    layers.current.clearLayers();
    const all = L.latLngBounds([]);
    for (const [key, { label, color }] of Object.entries(MAP_AREAS)) {
      if (!data[key] || !visible[key]) continue;
      const layer = L.geoJSON(data[key], {
        style: { color, weight: 3, fillOpacity: 0.12 },
        pointToLayer: (_f, ll) => L.circleMarker(ll, { radius: 5, color }),
        onEachFeature: (f, l) => {
          const node = document.createElement("span");
          node.textContent = `${label}: ${f.properties?.name || "Area"}`;
          l.bindTooltip(node);
        },
      }).addTo(layers.current);
      if (layer.getBounds().isValid()) all.extend(layer.getBounds());
    }
    for (const [key, label] of Object.entries(MAP_POINTS)) {
      const p = data[key];
      if (!visible[key] || !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) continue;
      const ll = [p[1], p[0]];
      L.circleMarker(ll, { radius: 8, color: "#111827", fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip(pointSymbols[key], {
          permanent: true,
          direction: key === "landing" ? "bottom" : key === "alternateLanding" ? "left" : "top",
        })
        .bindPopup(label)
        .addTo(layers.current);
      all.extend(ll);
    }
    bounds.current = all;
  }, [data, visible]);
  useEffect(() => {
    fit();
  }, [data]);
  useEffect(() => {
    if (!draft.current) return;
    draft.current.clearLayers();
    if (points.length)
      L.polyline(
        points.map((p) => [p[1], p[0]]),
        { color: MAP_AREAS[mode]?.color || "#111827", dashArray: "5 5" }
      ).addTo(draft.current);
  }, [mode, points]);
  function finish() {
    try {
      const geometry = parseDroneGeometry(
        JSON.stringify({
          type: "Feature",
          properties: { name: mode },
          geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
        })
      );
      if (!saveMapChange({ [mode]: geometry })) return;
      setPoints([]);
      setMode("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function go() {
    try {
      const ll = parseMapCentre(centre);
      map.current.setView(ll, 17, { animate: false });
      navigation.current.clearLayers();
      L.circleMarker(ll, { radius: 5, color: "#111827", fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip("View location — not saved to the plan")
        .addTo(navigation.current);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function download(format) {
    try {
      downloadMapLayer(mission, exportTarget, format);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="drone-map-panel">
      <div className="map-view-toolbar">
        <div className="map-basemap-options" role="group" aria-label="Map background">
          {[
            ["streets", "Streets"],
            ["satellite", "Satellite"],
            ["hybrid", "Hybrid"],
          ].map(([key, label]) => (
            <button type="button" key={key} aria-pressed={basemap === key} onClick={() => setBasemap(key)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={fit}>
          Fit to areas
        </button>
      </div>
      <div
        ref={element}
        className="drone-map"
        aria-label={preview ? "Imported geometry preview" : "Mission boundary map"}
      />
      {tileError && (
        <p role="status" className="map-tile-warning">
          Some map tiles could not load. Your geometry is still available.{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry map
          </button>
        </p>
      )}
      {basemap !== "streets" && (
        <p className="drone-note">
          Esri World Imagery · Satellite / aerial mosaic. Capture date varies and is not verified here. Check current
          site conditions.
        </p>
      )}
      <div className="map-layer-controls" role="group" aria-label="Visible map layers">
        {Object.entries(MAP_DESTINATIONS)
          .filter(([key]) => data[key])
          .map(([key, label]) => (
            <label key={key} style={{ "--map-layer-color": MAP_AREAS[key]?.color || "#183348" }}>
              <input
                type="checkbox"
                checked={visible[key]}
                aria-label={`Show ${label}`}
                onChange={(e) => setVisible((v) => ({ ...v, [key]: e.target.checked }))}
              />
              <span className="map-layer-swatch" />
              {label}
            </label>
          ))}
      </div>
      {!readOnly && (
        <div className="drone-actions map-draw-tools">
          <label>
            Draw or replace
            <select
              aria-label="Map drawing layer"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setPoints([]);
                setError("");
                if (e.target.value) setVisible((v) => ({ ...v, [e.target.value]: true }));
              }}
            >
              <option value="">Choose a layer</option>
              {Object.entries(MAP_DESTINATIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {mode && (
            <>
              <span>
                {Object.hasOwn(MAP_POINTS, mode)
                  ? `Click the map to set: ${MAP_POINTS[mode]}.`
                  : `${points.length} corners. Click the map to trace the area.`}
              </span>
              {!Object.hasOwn(MAP_POINTS, mode) && (
                <>
                  <button type="button" disabled={points.length < 3} onClick={finish}>
                    Save area
                  </button>
                  <button type="button" disabled={!points.length} onClick={() => setPoints((p) => p.slice(0, -1))}>
                    Undo corner
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode("");
                  setPoints([]);
                }}
              >
                Cancel drawing
              </button>
            </>
          )}
        </div>
      )}
      {!readOnly &&
        !preview &&
        !mode &&
        !mission.flightArea?.features?.length &&
        mission.boundary?.features?.length > 0 &&
        mission.boundary.features.every((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type)) && (
          <div className="drone-note">
            <p>
              If the intended flight area matches the survey boundary, reuse its polygons. Check exclusions, buffers and
              the actual operating volume before flight.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  if (saveMapChange(flightAreaFromBoundary(latest.current.mission)))
                    setVisible((v) => ({ ...v, flightArea: true }));
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Use survey boundary as flight area
            </button>
          </div>
        )}
      {!preview && (
        <details className="map-extra-tools">
          <summary>Map tools</summary>
          <div className="drone-actions">
            <label>
              Go to latitude, longitude
              <input
                aria-label="Go to latitude, longitude"
                value={centre}
                placeholder="-31.95, 115.86"
                onChange={(e) => setCentre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    go();
                  }
                }}
              />
            </label>
            <button type="button" onClick={go}>
              Go to coordinates
            </button>
          </div>
          <p className="drone-note">Moves the view only. Your take-off, landing and area geometry stay unchanged.</p>
          <div className="drone-actions">
            <label>
              Export layer
              <select aria-label="Export layer" value={exportTarget} onChange={(e) => setExportTarget(e.target.value)}>
                {Object.entries(MAP_DESTINATIONS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => download("kml")}>
              Download KML
            </button>
            <button type="button" onClick={() => download("geojson")}>
              Download GeoJSON
            </button>
          </div>
          <p className="drone-note">
            Planning geometry for GIS / Google Earth. This is not an aircraft route or flight approval.
          </p>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
