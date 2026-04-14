import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import PageHero from "../components/PageHero";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";

const INCIDENTS_KEY = "mysafeops_incidents";
const PROJECTS_KEY = "mysafeops_projects";
const ACTIONS_KEY = "incident_actions_v1";
const HOTSPOT_TEMPLATES = [
  {
    id: "root_cause",
    label: "Root-cause review",
    priority: "high",
    correctiveAction: "Run a focused root-cause review (task/method/supervision) and implement targeted controls.",
  },
  {
    id: "traffic_pedestrian",
    label: "Traffic & pedestrian segregation",
    priority: "high",
    correctiveAction: "Review route segregation, barriers, signage and spotters in this hotspot area.",
  },
  {
    id: "housekeeping_ppe",
    label: "Housekeeping & PPE reset",
    priority: "medium",
    correctiveAction: "Perform housekeeping/PPE compliance reset and verify with repeat inspection in this hotspot.",
  },
];

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const ss = ms;

function hasGps(i) {
  const lat = Number(i?.gpsLat);
  const lng = Number(i?.gpsLng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function IncidentHotspotMap() {
  const [incidents] = useState(() => load(INCIDENTS_KEY, []));
  const [projects] = useState(() => load(PROJECTS_KEY, []));
  const [actions, setActions] = useState(() => load(ACTIONS_KEY, []));
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [windowDays, setWindowDays] = useState("all");
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [hotspotTemplateId, setHotspotTemplateId] = useState("root_cause");

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const boundaryLayerRef = useRef(null);

  const gpsIncidents = useMemo(() => incidents.filter(hasGps), [incidents]);
  const filtered = useMemo(
    () =>
      gpsIncidents.filter((x) => {
        if (windowDays !== "all") {
          const d = Number(windowDays);
          const at = new Date(x.occurredAt || x.createdAt || 0).getTime();
          if (Number.isFinite(d) && Number.isFinite(at)) {
            const since = Date.now() - d * 24 * 60 * 60 * 1000;
            if (at < since) return false;
          }
        }
        if (typeFilter && x.type !== typeFilter) return false;
        if (severityFilter && x.severity !== severityFilter) return false;
        if (statusFilter && x.status !== statusFilter) return false;
        return true;
      }),
    [gpsIncidents, typeFilter, severityFilter, statusFilter, windowDays]
  );

  const hotspots = useMemo(() => {
    const byCell = new Map();
    filtered.forEach((x) => {
      const lat = Number(x.gpsLat);
      const lng = Number(x.gpsLng);
      const key = `${lat.toFixed(3)}|${lng.toFixed(3)}`;
      const bucket = byCell.get(key) || { key, lat: 0, lng: 0, count: 0, high: 0, nearMiss: 0, incident: 0 };
      bucket.lat += lat;
      bucket.lng += lng;
      bucket.count += 1;
      if (x.severity === "high" || x.severity === "critical") bucket.high += 1;
      if (x.type === "near_miss") bucket.nearMiss += 1;
      if (x.type === "incident") bucket.incident += 1;
      byCell.set(key, bucket);
    });
    return Array.from(byCell.values())
      .map((x) => ({ ...x, lat: x.lat / x.count, lng: x.lng / x.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  const parseProjectBoundary = (project) => {
    if (Array.isArray(project?.boundaryPoints) && project.boundaryPoints.length >= 3) {
      const points = project.boundaryPoints
        .map((p) => {
          if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
          if (p && typeof p === "object") return [Number(p.lat), Number(p.lng)];
          return null;
        })
        .filter((x) => x && Number.isFinite(x[0]) && Number.isFinite(x[1]));
      if (points.length >= 3) return points;
    }
    const coords = project?.boundaryGeoJson?.coordinates;
    if (Array.isArray(coords) && Array.isArray(coords[0])) {
      const ring = coords[0]
        .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[1]), Number(p[0])] : null))
        .filter((x) => x && Number.isFinite(x[0]) && Number.isFinite(x[1]));
      if (ring.length >= 3) return ring;
    }
    return null;
  };

  const focusAll = () => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;
    const bounds = filtered.map((x) => [Number(x.gpsLat), Number(x.gpsLng)]);
    if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  };

  const focusHotspot = (h) => {
    if (!mapRef.current) return;
    mapRef.current.setView([h.lat, h.lng], 17);
  };

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { scrollWheelZoom: true }).setView([54.5, -2.5], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    boundaryLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      markerLayerRef.current?.clearLayers();
      boundaryLayerRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const boundaryLayer = boundaryLayerRef.current;
    if (!map || !markerLayer || !boundaryLayer) return;
    markerLayer.clearLayers();
    boundaryLayer.clearLayers();
    if (showBoundaries) {
      projects.forEach((p) => {
        const ring = parseProjectBoundary(p);
        if (!ring) return;
        L.polygon(ring, { color: "#0d9488", weight: 2, fillOpacity: 0.05 }).addTo(boundaryLayer).bindTooltip(String(p.name || "Project"));
      });
    }
    filtered.forEach((x) => {
      const lat = Number(x.gpsLat);
      const lng = Number(x.gpsLng);
      const photo = Array.isArray(x.photos) && x.photos[0] ? `<img src="${x.photos[0]}" style="width:96px;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:6px" />` : "";
      const popup = `
        <div style="font-family:DM Sans,system-ui,sans-serif;font-size:12px;line-height:1.35;max-width:220px">
          ${photo}
          <div style="font-weight:700">${escapeHtml(String(x.type || "incident").replace("_", " "))}</div>
          <div style="color:#64748b">${escapeHtml(x.severity || "medium")} · ${escapeHtml(x.status || "open")}</div>
          <div style="margin-top:4px">${escapeHtml(x.location || "No location text")}</div>
          <div style="margin-top:4px;color:#334155">${escapeHtml(String(x.description || "").slice(0, 120))}</div>
        </div>`;
      L.marker([lat, lng]).addTo(markerLayer).bindPopup(popup, { maxWidth: 240 });
    });
    focusAll();
  }, [filtered, projects, showBoundaries]);

  const createActionFromHotspot = (hotspot) => {
    const tpl = HOTSPOT_TEMPLATES.find((t) => t.id === hotspotTemplateId) || HOTSPOT_TEMPLATES[0];
    const sourceId = `hotspot:${hotspot.key}`;
    const exists = (actions || []).some((a) => a.sourceId === sourceId && a.status !== "closed");
    if (exists) {
      window.alert("Open hotspot action already exists for this location.");
      return;
    }
    const title = `Hotspot CAPA: ${hotspot.count} events near ${hotspot.lat.toFixed(4)}, ${hotspot.lng.toFixed(4)}`;
    const action = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      owner: "Assign owner",
      dueDate: "",
      priority: hotspot.high > 0 ? "high" : tpl.priority,
      status: "open",
      sourceType: "hotspot",
      sourceId,
      sourceLabel: `Incident hotspot (${windowDays === "all" ? "all time" : `${windowDays}d`})`,
      correctiveAction: tpl.correctiveAction,
      verificationNote: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [action, ...(actions || [])];
    setActions(next);
    save(ACTIONS_KEY, next);
    window.alert("Hotspot action created in Incident Action Tracker.");
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="INC MAP"
        title="Incident Map & Hotspots"
        lead="GPS incidents and near misses on one map with hotspot grouping for quick risk focus."
        right={
          <button type="button" style={ss.btn} onClick={focusAll}>
            Focus all
          </button>
        }
      />

      <div className="app-panel-surface" style={{ padding: 12, borderRadius: 10, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
          <select style={ss.inp} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="near_miss">Near miss</option>
            <option value="incident">Incident</option>
          </select>
          <select style={ss.inp} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select style={ss.inp} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
          <select style={ss.inp} value={windowDays} onChange={(e) => setWindowDays(e.target.value)}>
            <option value="all">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
            <input type="checkbox" checked={showBoundaries} onChange={(e) => setShowBoundaries(e.target.checked)} />
            Show project boundaries
          </label>
          <select style={ss.inp} value={hotspotTemplateId} onChange={(e) => setHotspotTemplateId(e.target.value)}>
            {HOTSPOT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                Hotspot template: {t.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Points: <strong style={{ marginLeft: 4, color: "var(--color-text-primary)" }}>{filtered.length}</strong>
          </div>
        </div>
      </div>

      <div className="app-panel-surface" style={{ padding: 8, borderRadius: 10, marginBottom: 12 }}>
        <div ref={mapElRef} style={{ width: "100%", height: 420, borderRadius: 8, overflow: "hidden" }} />
      </div>

      <div className="app-panel-surface" style={{ padding: 12, borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Top hotspots (approx. 100m cells)</div>
        {hotspots.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>No GPS incidents for current filters.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {hotspots.map((h) => (
              <div key={h.key} className="app-surface-card" style={{ ...ss.card, padding: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12 }}>
                    {h.count} events · incidents {h.incident} · near misses {h.nearMiss} · high/critical {h.high}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
                  </span>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button type="button" style={ss.btn} onClick={() => focusHotspot(h)}>
                    Focus
                  </button>
                  <button type="button" style={ss.btnP} onClick={() => createActionFromHotspot(h)}>
                    Create hotspot action
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

