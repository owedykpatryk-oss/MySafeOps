import { useState, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { ms } from "../utils/moduleStyles";
import { geocodeAddressNominatim } from "../utils/geocode";
import { pushAudit } from "../utils/auditLog";
import PageHero from "../components/PageHero";
import { loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import { presenceFromTodaysBriefing } from "../utils/briefingToPresence";

const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";
const PRESENCE_KEY = "mysafeops_site_presence";
const BRIEFINGS_KEY = "daily_briefings";

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

function loadJson(key, fallback) {
  return loadOrgScoped(key, fallback);
}

function saveJson(key, value) {
  saveOrgScoped(key, value);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasCoords(p) {
  const lat = Number(p?.lat);
  const lng = Number(p?.lng);
  return !Number.isNaN(lat) && !Number.isNaN(lng);
}

const ss = {
  ...ms,
  btnO: { padding: "10px 14px", borderRadius: 6, border: "0.5px solid #c2410c", background: "#f97316", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", minHeight: 44, lineHeight: 1.3 },
};

export default function SitePresenceMap() {
  const [workers, setWorkers] = useState(() => loadJson(WORKERS_KEY, []));
  const [projects, setProjects] = useState(() => loadJson(PROJECTS_KEY, []));
  const [presence, setPresence] = useState(() => loadJson(PRESENCE_KEY, {}));
  const [geoBusy, setGeoBusy] = useState(null);
  const [msg, setMsg] = useState("");

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    const sync = () => {
      setWorkers(loadJson(WORKERS_KEY, []));
      setProjects(loadJson(PROJECTS_KEY, []));
    };
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    saveJson(PROJECTS_KEY, projects);
  }, [projects]);
  useEffect(() => {
    saveJson(PRESENCE_KEY, presence);
  }, [presence]);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { scrollWheelZoom: true }).setView([54.5, -2.5], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    markersLayerRef.current = layer;
    mapRef.current = map;
    const invalidate = () => {
      requestAnimationFrame(() => {
        try {
          map.invalidateSize({ animate: false });
        } catch {
          /* map tearing down */
        }
      });
    };
    const ro = new ResizeObserver(invalidate);
    ro.observe(mapElRef.current);
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    invalidate();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      layer.clearLayers();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const plotted = projects.filter(hasCoords);
    const bounds = [];
    plotted.forEach((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      const here = workers.filter((w) => presence[w.id]?.projectId === p.id);
      const lines = here.map((w) => {
        const pr = presence[w.id];
        const act = (pr?.activity || "").trim();
        return `<div style="margin-bottom:6px"><strong>${escapeHtml(w.name || "—")}</strong>${act ? ` — ${escapeHtml(act)}` : ""}</div>`;
      });
      const body = `
        <div style="font-family:DM Sans,system-ui,sans-serif;font-size:13px;line-height:1.4">
          <div style="font-weight:600;margin-bottom:6px">${escapeHtml(p.name || "Project")}</div>
          <div style="color:#475569;font-size:12px;margin-bottom:8px">${escapeHtml(p.address || p.site || "")}</div>
          <div style="border-top:1px solid #e2e8f0;padding-top:8px">
            ${lines.length ? lines.join("") : "<span style='color:#64748b'>No team assigned here yet.</span>"}
          </div>
        </div>`;
      const m = L.marker([lat, lng]).addTo(layer).bindPopup(body, { maxWidth: 320 });
      m.on("click", () => m.openPopup());
      bounds.push([lat, lng]);
    });
    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [projects, workers, presence]);

  const applyPresenceFromBriefing = () => {
    const briefings = loadJson(BRIEFINGS_KEY, []);
    const res = presenceFromTodaysBriefing(briefings, workers, presence, {});
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    const pname = (projectById[res.projectId]?.name || projectById[res.projectId]?.id || "project").trim();
    if (
      !window.confirm(
        `Set ${res.count} signed worker(s) from today's daily briefing to "${pname}" on the map? Other workers stay as they are.`
      )
    ) {
      return;
    }
    setPresence(res.presence);
    pushAudit({ action: "site_presence_from_briefing", entity: "site_map", detail: `${res.count}:${res.projectId}` });
    setMsg("Presence updated from today's briefing.");
  };

  const geocodeProject = async (projectId) => {
    const p = projectById[projectId];
    const q = (p?.address || p?.site || "").trim();
    if (!q) {
      setMsg("Add an address or site name to the project first (Workers → projects).");
      return;
    }
    setGeoBusy(projectId);
    setMsg("");
    try {
      const coords = await geocodeAddressNominatim(q);
      if (!coords) {
        setMsg("No location found for that address. Try editing the address in Workers → projects.");
        return;
      }
      setProjects((prev) => prev.map((x) => (x.id === projectId ? { ...x, lat: coords.lat, lng: coords.lng } : x)));
      setMsg("Coordinates saved for map.");
    } catch (e) {
      setMsg(e?.message || "Geocoding failed.");
    } finally {
      setGeoBusy(null);
    }
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="MAP"
        title="Site map"
        lead={
          <>
            Plot project sites, then record who is working where and what they are doing. Coordinates live on each project (edit in{" "}
            <strong>Workers → projects</strong>). Address lookup uses OpenStreetMap Nominatim — repeated queries are cached locally for 30 days.
          </>
        }
      />

      <div
        ref={mapElRef}
        style={{
          width: "100%",
          height: minMapHeight(),
          borderRadius: "var(--radius-md, 12px)",
          border: "1px solid var(--color-border-tertiary,#e2e8f0)",
          boxShadow: "var(--shadow-sm)",
          marginBottom: 20,
          zIndex: 0,
        }}
        role="presentation"
        aria-label="Map of project sites"
      />
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "-12px 0 20px" }}>
        Map data © OpenStreetMap contributors.
      </p>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Project locations</div>
        {projects.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>Add projects under Workers → projects.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                }}
              >
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <strong>{p.name || "Unnamed"}</strong>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{p.address || p.site || "—"}</div>
                  {hasCoords(p) ? (
                    <div style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#64748b" }}>
                      {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#b45309" }}>No coordinates — pin won&apos;t show until lat/lng are set.</div>
                  )}
                </div>
                <button type="button" style={ss.btn} disabled={geoBusy === p.id} onClick={() => geocodeProject(p.id)}>
                  {geoBusy === p.id ? "Looking up…" : "Geocode address"}
                </button>
                <a
                  href={googleMapsSearchUrl(p.address || p.site || p.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...ss.btn, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  Open in Google Maps
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={ss.card}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Who is where (today)</div>
          <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={applyPresenceFromBriefing}>
            Apply from today&apos;s briefing
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Uses the <strong>most recent briefing dated today</strong>: workers who are <strong>present and signed</strong>, with a{" "}
          <strong>project</strong> set on the briefing, are placed on that project. Scope text becomes the activity line when present.
        </p>
        {workers.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>Add workers under Workers.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workers.map((w) => {
              const pr = presence[w.id] || {};
              return (
                <div
                  key={w.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                    background: "var(--color-background-secondary,#fafafa)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{w.name || "Unnamed"}</div>
                  <label style={{ ...ss.lbl, fontSize: 11 }}>Project / site</label>
                  <select
                    style={ss.inp}
                    value={pr.projectId || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setPresence((prev) => {
                          const next = { ...prev };
                          delete next[w.id];
                          return next;
                        });
                        pushAudit({ action: "site_presence_clear", entity: "site_map", detail: w.id });
                        return;
                      }
                      setPresence((prev) => ({
                        ...prev,
                        [w.id]: {
                          projectId: v,
                          activity: prev[w.id]?.activity || "",
                          updatedAt: new Date().toISOString(),
                        },
                      }));
                      pushAudit({ action: "site_presence_update", entity: "site_map", detail: w.id });
                    }}
                  >
                    <option value="">— Not set —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id}
                      </option>
                    ))}
                  </select>
                  <label style={{ ...ss.lbl, fontSize: 11, marginTop: 10 }}>Activity / task</label>
                  <input
                    style={ss.inp}
                    value={pr.activity || ""}
                    placeholder="e.g. 1st fix electrics, crane lift, induction"
                    onChange={(e) =>
                      setPresence((prev) => ({
                        ...prev,
                        [w.id]: {
                          projectId: prev[w.id]?.projectId ?? pr.projectId ?? "",
                          activity: e.target.value,
                          updatedAt: prev[w.id]?.updatedAt,
                        },
                      }))
                    }
                    onBlur={() => {
                      if (!pr.projectId) return;
                      setPresence((prev) => ({
                        ...prev,
                        [w.id]: {
                          ...prev[w.id],
                          projectId: pr.projectId,
                          activity: pr.activity || "",
                          updatedAt: new Date().toISOString(),
                        },
                      }));
                      pushAudit({ action: "site_presence_update", entity: "site_map", detail: w.id });
                    }}
                  />
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>
                    {pr.updatedAt ? `Last updated: ${new Date(pr.updatedAt).toLocaleString("en-GB")}` : " "}
                  </div>
                  {pr.projectId && projectById[pr.projectId] && (
                    <p style={{ fontSize: 12, margin: "8px 0 0", color: "var(--color-text-secondary)" }}>
                      {projectById[pr.projectId].address || projectById[pr.projectId].site || ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {msg && (
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--color-text-secondary)" }} role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

function minMapHeight() {
  if (typeof window === "undefined") return 320;
  return Math.min(480, Math.max(260, Math.floor(window.innerHeight * 0.38)));
}

function googleMapsSearchUrl(query) {
  const q = String(query || "").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
