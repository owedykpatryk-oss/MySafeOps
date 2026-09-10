import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const UK_CENTRE = [54.5, -2.5];
const UK_ZOOM = 5;

function coordsFor(job) {
  const lat = Number(job?.project?.lat);
  const lng = Number(job?.project?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Real slippy map of where the scheduled work actually is.
 *
 * Only jobs with geocoded coordinates are plotted. The previous version derived a
 * position by hashing the location string, which put a pin somewhere in the UK that
 * had nothing to do with the site — worse than showing nothing, because it looked
 * authoritative. Jobs without coordinates are counted and named instead.
 */
export default function ManagementFootprintMap({ jobs = [], teams = [], onSelectJob }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const selectRef = useRef(onSelectJob);

  useEffect(() => {
    selectRef.current = onSelectJob;
  }, [onSelectJob]);

  const plotted = useMemo(
    () => jobs.map((job) => ({ job, coords: coordsFor(job) })).filter((entry) => entry.coords),
    [jobs],
  );
  const unplotted = useMemo(() => jobs.filter((job) => !coordsFor(job)), [jobs]);
  const teamColour = useMemo(() => {
    const map = new Map(teams.map((team) => [team.id, team.colour]));
    return (teamId) => map.get(teamId) || "#0f766e";
  }, [teams]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, {
      // The panel sits inside a scrolling dashboard; wheel-zoom would hijack the page.
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView(UK_CENTRE, UK_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    for (const { job, coords } of plotted) {
      const colour = teamColour(job.teamId);
      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: "mgo-map-marker",
          html: `<span style="--pin-colour:${escapeHtml(colour)}"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        keyboard: true,
        title: job.name,
        alt: `${job.name} — ${job.site}`,
      });
      marker.bindTooltip(`<strong>${escapeHtml(job.name)}</strong><br>${escapeHtml(job.site)}`, {
        direction: "top",
        offset: [0, -8],
      });
      marker.on("click", () => selectRef.current?.(job.id));
      marker.addTo(layer);
    }

    if (plotted.length === 1) {
      map.setView(plotted[0].coords, 11);
    } else if (plotted.length > 1) {
      map.fitBounds(L.latLngBounds(plotted.map((entry) => entry.coords)), { padding: [32, 32], maxZoom: 11 });
    } else {
      map.setView(UK_CENTRE, UK_ZOOM);
    }
  }, [plotted, teamColour]);

  return (
    <div className="mgo-footprint">
      <div
        ref={containerRef}
        className="mgo-footprint__map"
        role="application"
        aria-label={`Map showing ${plotted.length} scheduled ${plotted.length === 1 ? "site" : "sites"}`}
      />
      <div className="mgo-footprint__legend">
        <span className="mgo-footprint__count"><i />{plotted.length} plotted</span>
        {unplotted.length ? (
          <span className="mgo-footprint__missing">
            {unplotted.length} without coordinates — add a postcode and geocode the project to place{" "}
            {unplotted.length === 1 ? "it" : "them"}.
          </span>
        ) : null}
      </div>
    </div>
  );
}
