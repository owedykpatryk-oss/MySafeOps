import { useState, useEffect, useMemo, useRef } from "react";
import HAZARD_LIBRARY, { TRADE_CATEGORIES, getByCategory, searchHazards, getRiskLevel } from "./ramsAllHazards";
import {
  RAMS_PRINT_SECTIONS,
  RAMS_SECTION_IDS,
  normalizePrintSections,
  previewAnchorId,
  isSectionIncluded,
} from "./ramsSectionConfig";
import { generatePrintHTML, computeRamsFingerprint, openRamsPrintWindow, formatOperativeCertsLine } from "./ramsPrintHtml";
import { loadEmergencySiteExtras, googleMapsSearchUrl } from "../../utils/emergencySiteExtras";
import { ms } from "../../utils/moduleStyles";
import { safeHttpUrl } from "../../utils/safeUrl";
import PageHero from "../../components/PageHero";
import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

// ─── storage ─────────────────────────────────────────────────────────────────
const RAMS_DRAFT_KEY = "mysafeops_rams_builder_draft";
const RAMS_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const genId = () => `rams_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); };

function normalisePersonKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** All tokens (length ≥2) must appear in worker name — avoids matching on a single common word. */
function looseNameMatch(tokens, workerName) {
  const wn = normalisePersonKey(workerName);
  return tokens.every((t) => wn.includes(t));
}

/** On JSON import: keep operative id if local; else match by email, exact name, or multi-token name (export metadata or id string). */
function remapOperativeIds(oldIds, operativeNames, workersList) {
  if (!Array.isArray(oldIds) || oldIds.length === 0) return [];
  const wl = workersList || [];
  return oldIds.map((id, i) => {
    if (wl.some((w) => w.id === id)) return id;
    const idStr = String(id ?? "").trim();
    if (idStr.includes("@")) {
      const em = idStr.toLowerCase();
      const byEmail = wl.find((w) => normalisePersonKey(w.email) === em);
      if (byEmail) return byEmail.id;
    }
    const nm = Array.isArray(operativeNames) ? operativeNames[i] : undefined;
    if (nm && typeof nm === "string" && nm.trim()) {
      const t = nm.trim();
      const tl = t.toLowerCase();
      if (t.includes("@")) {
        const byEmail = wl.find((w) => normalisePersonKey(w.email) === tl);
        if (byEmail) return byEmail.id;
      }
      const exact = wl.find((w) => normalisePersonKey(w.name) === normalisePersonKey(t));
      if (exact) return exact.id;
      const parts = tl.split(/\s+/).filter((x) => x.length >= 2);
      if (parts.length >= 2) {
        const loose = wl.find((w) => looseNameMatch(parts, w.name));
        if (loose) return loose.id;
      }
    }
    return id;
  });
}

const ss = {
  ...ms,
  btnO: {
    ...ms.btn,
    padding: "10px 16px",
    borderRadius: "var(--radius-sm, 8px)",
    border: "1px solid #c2410c",
    background: "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "DM Sans,sans-serif",
    minHeight: 44,
    lineHeight: 1.3,
    boxShadow: "0 2px 8px rgba(234, 88, 12, 0.35)",
  },
  ta: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--color-border-secondary,#cbd5e1)",
    borderRadius: "var(--radius-sm, 8px)",
    fontSize: 13,
    background: "var(--color-background-primary,#fff)",
    color: "var(--color-text-primary)",
    fontFamily: "DM Sans,sans-serif",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 60,
    lineHeight: 1.5,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
};

const RAMS_FORM_DEFAULTS = {
  siteWeatherNote: "",
  siteMapUrl: "",
  siteLat: "",
  siteLng: "",
  nearestHospital: "",
  hospitalDirectionsUrl: "",
  printSections: {},
};

const RL = {
  high:   { bg:"#FCEBEB", color:"#791F1F" },
  medium: { bg:"#FAEEDA", color:"#633806" },
  low:    { bg:"#EAF3DE", color:"#27500A" },
};

function openWeatherDescription(code = "", fallback = "") {
  const c = String(code || "").slice(0, 2);
  const MAP = {
    "01": "Clear",
    "02": "Few clouds",
    "03": "Scattered clouds",
    "04": "Overcast",
    "09": "Shower rain",
    "10": "Rain",
    "11": "Thunderstorm",
    "13": "Snow",
    "50": "Mist",
  };
  return MAP[c] || fallback || "Weather";
}

async function fetchWeatherSummary(lat, lng) {
  const la = parseFloat(String(lat).trim(), 10);
  const lo = parseFloat(String(lng).trim(), 10);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) throw new Error("Invalid coordinates");
  const openWeatherKey = String(import.meta.env.VITE_OPENWEATHER_API_KEY || "").trim();
  const when = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  // Prefer OpenWeather when key is provided; fallback to Open-Meteo for keyless usage.
  if (openWeatherKey) {
    const u = new URL("https://api.openweathermap.org/data/2.5/weather");
    u.searchParams.set("lat", String(la));
    u.searchParams.set("lon", String(lo));
    u.searchParams.set("appid", openWeatherKey);
    u.searchParams.set("units", "metric");
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error("Weather request failed");
    const j = await r.json();
    const t = Number(j.main?.temp).toFixed(1);
    const w = Number(j.wind?.speed || 0) * 2.23694; // m/s -> mph
    const iconCode = j.weather?.[0]?.icon || "";
    const desc = openWeatherDescription(iconCode, j.weather?.[0]?.description || "");
    return `Site weather (${when}): ~${t}°C, ${desc}, wind ~${w.toFixed(1)} mph — OpenWeather snapshot for this location.`;
  }

  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(la));
  u.searchParams.set("longitude", String(lo));
  u.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  u.searchParams.set("wind_speed_unit", "mph");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  const t = j.current?.temperature_2m;
  const w = j.current?.wind_speed_10m;
  const code = j.current?.weather_code;
  const WMO = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 61: "Rain", 80: "Rain showers", 95: "Thunderstorm" };
  const desc = WMO[code] ?? `Weather code ${code}`;
  return `Site weather (${when}): ~${t}°C, ${desc}, wind ~${w} mph — Open-Meteo snapshot for this location.`;
}

function RiskBadge({ rf }) {
  const lvl = getRiskLevel({ RF: rf });
  const c = RL[lvl];
  return <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, fontWeight:500, background:c.bg, color:c.color }}>{rf} — {lvl}</span>;
}

// ─── Step 1 — Document info ──────────────────────────────────────────────────
function StepInfo({ form, setForm, projects, workers, onNext }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const valid = form.title?.trim() && form.location?.trim();

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not available in this browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          siteLat: String(Number(pos.coords.latitude.toFixed(5))),
          siteLng: String(Number(pos.coords.longitude.toFixed(5))),
        }));
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        alert(err?.message || "Could not read location. Allow location access or enter coordinates manually.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
    );
  };

  const importFromEmergency = () => {
    const ex = loadEmergencySiteExtras();
    setForm((f) => ({
      ...f,
      nearestHospital: ex.nearestHospital || f.nearestHospital,
      hospitalDirectionsUrl: ex.hospitalDirectionsUrl || f.hospitalDirectionsUrl,
      siteMapUrl: ex.siteMapUrl || f.siteMapUrl,
    }));
  };

  const runWeatherLookup = async () => {
    setWeatherLoading(true);
    try {
      const line = await fetchWeatherSummary(form.siteLat, form.siteLng);
      set("siteWeatherNote", [form.siteWeatherNote, line].filter(Boolean).join("\n\n"));
    } catch (e) {
      console.warn(e);
      alert("Could not load weather. Check latitude / longitude and try again.");
    } finally {
      setWeatherLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:20 }}>
        Fill in the document header details. These appear on the cover page of the RAMS.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:12, marginBottom:12 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={ss.lbl}>Job / document title *</label>
          <input value={form.title||""} onChange={e=>set("title",e.target.value)}
            placeholder="e.g. Kettle removal and installation of new kettle" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Location / site *</label>
          <input value={form.location||""} onChange={e=>set("location",e.target.value)}
            placeholder="e.g. Two Sisters Scunthorpe" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Project</label>
          <select value={form.projectId||""} onChange={e=>set("projectId",e.target.value)} style={ss.inp}>
            <option value="">— Select project —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={ss.lbl}>Date</label>
          <input type="date" value={form.date||today()} onChange={e=>set("date",e.target.value)} style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Lead engineer / supervisor</label>
          <input value={form.leadEngineer||""} onChange={e=>set("leadEngineer",e.target.value)}
            placeholder="e.g. D Anderson" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Job reference</label>
          <input value={form.jobRef||""} onChange={e=>set("jobRef",e.target.value)}
            placeholder="e.g. FP1-DOLAV-001" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Review due date</label>
          <input type="date" value={form.reviewDate||""} onChange={e=>set("reviewDate",e.target.value)} style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Revision</label>
          <input value={form.revision||"1A"} onChange={e=>set("revision",e.target.value)} placeholder="1A" style={{ ...ss.inp, width:"auto" }} />
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Scope of works</label>
        <textarea value={form.scope||""} onChange={e=>set("scope",e.target.value)}
          placeholder="Describe the work to be carried out…" style={ss.ta} rows={3} />
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={ss.lbl}>Operatives / workers on this RAMS</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {workers.map(w=>{
            const sel = (form.operativeIds||[]).includes(w.id);
            return (
              <button key={w.id} type="button" onClick={()=>set("operativeIds", sel ? (form.operativeIds||[]).filter(id=>id!==w.id) : [...(form.operativeIds||[]),w.id])}
                style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
                  background:sel?"#0d9488":"var(--color-background-secondary,#f7f7f5)",
                  color:sel?"#E1F5EE":"var(--color-text-primary)",
                  border:sel?"0.5px solid #085041":"0.5px solid var(--color-border-secondary,#ccc)" }}>
                {w.name}
              </button>
            );
          })}
          {workers.length===0 && <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>No workers added yet — add workers in the Workers module.</span>}
        </div>
        {workers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, operativeIds: workers.map((w) => w.id) }))}
              style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}
            >
              Select all operatives
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, operativeIds: [] }))}
              style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}
            >
              Clear selection
            </button>
          </div>
        )}
        {(form.operativeIds || []).length > 0 && (
          <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", fontSize:13, marginTop:12, maxWidth:640, lineHeight:1.45 }}>
            <input
              type="checkbox"
              checked={normalizePrintSections(form.printSections)[RAMS_SECTION_IDS.OPERATIVE_CERTS] === true}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  printSections: { ...f.printSections, operative_certs: e.target.checked },
                }))
              }
              style={{ accentColor:"#0d9488", width:15, height:15, marginTop:2, flexShrink:0 }}
            />
            <span>
              Include <strong>certificates &amp; competencies</strong> for selected operatives (from Workers: dated certs and free-text notes). Optional — appears in preview/print when enabled.
            </span>
          </label>
        )}
      </div>

      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", margin:"20px 0 10px" }}>
        Site weather, map &amp; emergency (optional)
      </div>
      <p style={{ fontSize:12, color:"var(--color-text-secondary)", margin:"0 0 12px", maxWidth:640 }}>
        Fills printed RAMS sections. Save nearest A&amp;E under <strong>Emergency contacts</strong> and use &quot;Import from Emergency&quot; to copy here.
      </p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
        <button type="button" onClick={importFromEmergency} style={{ ...ss.btn, fontSize:12 }}>
          Import from Emergency module
        </button>
        {form.location?.trim() && (
          <a href={googleMapsSearchUrl(form.location)} target="_blank" rel="noopener noreferrer" style={{ ...ss.btn, fontSize:12, textDecoration:"none", display:"inline-flex", alignItems:"center" }}>
            Open site location in Google Maps
          </a>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap:10, marginBottom:12 }}>
        <div>
          <label style={ss.lbl}>Latitude (for weather)</label>
          <input value={form.siteLat || ""} onChange={(e) => set("siteLat", e.target.value)} placeholder="e.g. 53.58" inputMode="decimal" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Longitude (for weather)</label>
          <input value={form.siteLng || ""} onChange={(e) => set("siteLng", e.target.value)} placeholder="e.g. -0.65" inputMode="decimal" style={ss.inp} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={geoLoading}
            onClick={useMyLocation}
            style={{ ...ss.btn, fontSize: 12, width: "100%", opacity: geoLoading ? 0.7 : 1 }}
          >
            {geoLoading ? "Getting location…" : "Use my location (lat / lng)"}
          </button>
          <button type="button" disabled={weatherLoading || !String(form.siteLat || "").trim() || !String(form.siteLng || "").trim()} onClick={runWeatherLookup} style={{ ...ss.btnP, fontSize:12, width:"100%", opacity: weatherLoading ? 0.7 : 1 }}>
            {weatherLoading ? "Loading…" : "Fetch weather"}
          </button>
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={ss.lbl}>Site weather note</label>
        <textarea value={form.siteWeatherNote || ""} onChange={(e) => set("siteWeatherNote", e.target.value)} rows={2} placeholder="Conditions for the work date, or use Open-Meteo above" style={ss.ta} />
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={ss.lbl}>Map / OSM link (optional)</label>
        <input value={form.siteMapUrl || ""} onChange={(e) => set("siteMapUrl", e.target.value)} placeholder="https://…" style={ss.inp} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap:10, marginBottom:12 }}>
        <div>
          <label style={ss.lbl}>Nearest A&amp;E / hospital</label>
          <input value={form.nearestHospital || ""} onChange={(e) => set("nearestHospital", e.target.value)} placeholder="Hospital name and area" style={ss.inp} />
        </div>
        <div>
          <label style={ss.lbl}>Directions URL (Google Maps)</label>
          <input value={form.hospitalDirectionsUrl || ""} onChange={(e) => set("hospitalDirectionsUrl", e.target.value)} placeholder="https://maps.google.com/…" style={ss.inp} />
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button type="button" disabled={!valid} onClick={onNext} style={{ ...ss.btnP, opacity:valid?1:0.4 }}>
          Next — select hazards →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Hazard picker ──────────────────────────────────────────────────
function HazardPicker({ selected, onToggle, onClearSelected, onAddAllVisible, onNext, onBack }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const results = search ? searchHazards(search)
    : activeCategory === "All" ? HAZARD_LIBRARY
    : getByCategory(activeCategory);

  const categoryCounts = Object.fromEntries(
    TRADE_CATEGORIES.map(c => [c, getByCategory(c).length])
  );

  const selectedIdSet = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const visibleNotSelectedCount = useMemo(
    () => results.filter((h) => !selectedIdSet.has(h.id)).length,
    [results, selectedIdSet]
  );

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:16 }}>
        Select all activities that apply to this job. You can edit each one in the next step.
        <span style={{ marginLeft:8, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500, background:"#E6F1FB", color:"#0C447C" }}>
          {selected.length} selected
        </span>
        {visibleNotSelectedCount > 0 && onAddAllVisible && (
          <button
            type="button"
            onClick={() => onAddAllVisible(results)}
            style={{ ...ss.btn, fontSize: 12, padding: "4px 12px", minHeight: 36, marginLeft: 4 }}
          >
            Add all visible ({visibleNotSelectedCount})
          </button>
        )}
        {selected.length > 0 && onClearSelected && (
          <button type="button" onClick={onClearSelected} style={{ ...ss.btn, fontSize: 12, padding: "4px 12px", minHeight: 36, marginLeft: 4 }}>
            Clear selection
          </button>
        )}
      </div>

      {/* search */}
      <div style={{ marginBottom:12 }}>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search activities… e.g. welding, height, electrical isolation"
          style={ss.inp}
          aria-label="Search hazard library"
        />
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)", marginTop: 6 }}>
          Showing {results.length} activit{results.length === 1 ? "y" : "ies"}
          {search.trim() ? ` for “${search.trim()}”` : activeCategory !== "All" ? ` in ${activeCategory}` : ""}
        </div>
      </div>

      {/* category tabs */}
      {!search && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:16 }}>
          {["All",...TRADE_CATEGORIES].map(c=>(
            <button key={c} type="button" onClick={()=>setActiveCategory(c)} style={{
              padding:"4px 10px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif",
              background:activeCategory===c?"#0f172a":"var(--color-background-secondary,#f7f7f5)",
              color:activeCategory===c?"#fff":"var(--color-text-secondary)",
              border:"0.5px solid var(--color-border-secondary,#ccc)",
            }}>
              {c}{c!=="All"&&categoryCounts[c]?` (${categoryCounts[c]})`:c==="All"?` (${HAZARD_LIBRARY.length})`:""}
            </button>
          ))}
        </div>
      )}

      {/* hazard list */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {results.map(h=>{
          const sel = selected.some(s=>s.id===h.id);
          const rl = getRiskLevel(h.initialRisk);
          return (
            <div
              key={h.id}
              className="app-rams-hazard-row"
              role="button"
              tabIndex={0}
              onClick={() => onToggle(h)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(h);
                }
              }}
              style={{ ...ss.card, cursor:"pointer", padding:"12px 14px",
                borderColor:sel?"#0d9488":"var(--color-border-tertiary,#e5e5e5)",
                background:sel?"#f0fdf8":"var(--color-background-primary,#fff)" }}
            >
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                {/* checkbox */}
                <div style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${sel?"#0d9488":"var(--color-border-secondary,#ccc)"}`, background:sel?"#0d9488":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  {sel && <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round"/></svg>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                    <span style={{ fontSize:11, padding:"1px 8px", borderRadius:20, background:"#E6F1FB", color:"#0C447C", fontWeight:500 }}>{h.category}</span>
                    <RiskBadge rf={h.initialRisk.RF} />
                  </div>
                  <div style={{ fontWeight:500, fontSize:13, marginBottom:2 }}>{h.activity}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{h.hazard}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>
                    {h.controlMeasures.length} control measures · PPE: {h.ppeRequired.slice(0,3).join(", ")}{h.ppeRequired.length>3?`…`:""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {results.length===0 && <div style={{ textAlign:"center", padding:"2rem", color:"var(--color-text-secondary)", fontSize:13 }}>No hazards match your search.</div>}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button type="button" onClick={onBack} style={ss.btn}>← Back</button>
        <button type="button" disabled={selected.length===0} onClick={onNext} style={{ ...ss.btnP, opacity:selected.length>0?1:0.4 }}>
          Next — review & edit ({selected.length}) →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Review / edit each row ────────────────────────────────────────
function HazardEditor({ rows, setRows, onNext, onBack }) {
  const [editing, setEditing] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  const [rowFilter, setRowFilter] = useState("");

  const filteredRows = useMemo(() => {
    const q = rowFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.activity || "")
          .toLowerCase()
          .includes(q) ||
        String(r.hazard || "")
          .toLowerCase()
          .includes(q) ||
        String(r.category || "")
          .toLowerCase()
          .includes(q)
    );
  }, [rows, rowFilter]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (expandAll) setExpandAll(false);
      else if (editing != null) setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandAll, editing]);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, [field]:value} : r));
  };

  const updateControl = (id, idx, value) => {
    setRows(prev => prev.map(r => {
      if (r.id!==id) return r;
      const cms = [...r.controlMeasures];
      cms[idx] = value;
      return {...r, controlMeasures:cms};
    }));
  };

  const addControl = (id) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, controlMeasures:[...r.controlMeasures,""]} : r));
  };

  const removeControl = (id, idx) => {
    setRows(prev => prev.map(r => r.id===id ? {...r, controlMeasures:r.controlMeasures.filter((_,i)=>i!==idx)} : r));
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id!==id));

  const duplicateRow = (id) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const r = prev[idx];
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = genId();
      const arr = [...prev];
      arr.splice(idx + 1, 0, copy);
      return arr;
    });
    setExpandAll(false);
    setEditing(null);
  };

  const moveRow = (id, dir) => {
    setRows(prev => {
      const idx = prev.findIndex(r=>r.id===id);
      const next = idx + dir;
      if (next<0||next>=prev.length) return prev;
      const arr = [...prev];
      [arr[idx],arr[next]] = [arr[next],arr[idx]];
      return arr;
    });
  };

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:12 }}>
        Review and edit each hazard row. Adjust control measures, risk scores and PPE to match your specific job.
        <span style={{ display: "block", fontSize: 12, color: "var(--color-text-tertiary, #94a3b8)", marginTop: 6 }}>
          Tip: press <kbd style={{ padding: "1px 6px", borderRadius: 4, border: "1px solid var(--color-border-tertiary)", fontSize: 11 }}>Esc</kbd> to close an open row or exit &quot;expand all&quot;.
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button type="button" onClick={() => { setExpandAll(true); setEditing(null); }} style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
          Expand all rows
        </button>
        <button type="button" onClick={() => { setExpandAll(false); setEditing(null); }} style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36 }}>
          Collapse all
        </button>
        {rows.length > 3 && (
          <div style={{ flex: "1 1 220px", minWidth: 0, maxWidth: 420 }}>
            <input
              id="rams-row-filter"
              type="search"
              value={rowFilter}
              onChange={(e) => setRowFilter(e.target.value)}
              placeholder="Filter rows by activity, hazard, category…"
              style={{ ...ss.inp, fontSize: 12, padding: "8px 12px", minHeight: 40 }}
              aria-label="Filter hazard rows"
            />
            {rowFilter.trim() && (
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)", marginTop: 4 }}>
                Showing {filteredRows.length} of {rows.length} rows
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom:20 }}>
        {filteredRows.length === 0 && rowFilter.trim() ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--color-text-secondary)", fontSize: 13 }}>
            No hazard rows match &quot;{rowFilter.trim()}&quot;. Clear the filter to see all rows.
          </div>
        ) : null}
        {filteredRows.map((r) => {
          const idx = rows.findIndex((x) => x.id === r.id);
          const isOpen = expandAll || editing === r.id;
          return (
            <div key={r.id} style={{ ...ss.card, marginBottom:8, borderColor:isOpen?"#0d9488":"var(--color-border-tertiary,#e5e5e5)" }}>
              {/* collapsed header */}
              <div
                style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer" }}
                onClick={() => {
                  if (expandAll) {
                    setExpandAll(false);
                    setEditing(r.id);
                  } else {
                    setEditing(editing === r.id ? null : r.id);
                  }
                }}
              >
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:20, background:"#E6F1FB", color:"#0C447C" }}>{r.category}</span>
                    <RiskBadge rf={r.initialRisk.RF} />
                    <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>→</span>
                    <RiskBadge rf={r.revisedRisk.RF} />
                  </div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{r.activity}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>{r.hazard}</div>
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <button type="button" onClick={e=>{e.stopPropagation();moveRow(r.id,-1);}} disabled={idx===0} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:idx===0?0.3:1 }}>↑</button>
                  <button type="button" onClick={e=>{e.stopPropagation();moveRow(r.id,1);}} disabled={idx===rows.length-1} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, opacity:idx===rows.length-1?0.3:1 }}>↓</button>
                  <button type="button" onClick={e=>{e.stopPropagation();duplicateRow(r.id);}} style={{ ...ss.btn, padding:"3px 8px", fontSize:11 }} title="Duplicate this hazard row">
                    Dup
                  </button>
                  <button type="button" onClick={e=>{e.stopPropagation();removeRow(r.id);}} style={{ ...ss.btn, padding:"3px 7px", fontSize:11, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
                  <button type="button" onClick={e=>{e.stopPropagation(); if (expandAll) setExpandAll(false); setEditing(editing===r.id?null:r.id);}} style={{ ...ss.btn, padding:"3px 10px", fontSize:11, background:isOpen?"var(--color-background-secondary,#f7f7f5)":"transparent" }}>
                    {isOpen?"Done":"Edit"}
                  </button>
                </div>
              </div>

              {/* expanded editor */}
              {isOpen && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:10, marginBottom:12 }}>
                    <div>
                      <label style={ss.lbl}>Activity</label>
                      <input value={r.activity} onChange={e=>updateRow(r.id,"activity",e.target.value)} style={ss.inp} />
                    </div>
                    <div>
                      <label style={ss.lbl}>Hazard / additional hazard</label>
                      <input value={r.hazard} onChange={e=>updateRow(r.id,"hazard",e.target.value)} style={ss.inp} />
                    </div>
                  </div>

                  {/* risk matrix */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:12, marginBottom:12 }}>
                    <div style={{ padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Initial risk (before controls)</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
                        {[["L","Likelihood (H=6 M=4 L=2)","initialRisk"],["S","Severity (Fatal=6 Major=4 Minor=2)","initialRisk"]].map(([k,hint,obj])=>(
                          <div key={k}>
                            <label style={{ ...ss.lbl, marginBottom:2 }}>{k} <span style={{ fontWeight:400 }}>({hint})</span></label>
                            <select value={r[obj][k]} onChange={e=>updateRow(r.id,obj,{...r[obj],[k]:parseInt(e.target.value),RF:parseInt(e.target.value)*(k==="L"?r[obj].S:r[obj].L)})} style={{ ...ss.inp, width:"auto" }}>
                              {[2,4,6].map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, fontSize:12 }}>RF = {r.initialRisk.L} × {r.initialRisk.S} = <strong>{r.initialRisk.L*r.initialRisk.S}</strong> <RiskBadge rf={r.initialRisk.L*r.initialRisk.S} /></div>
                    </div>
                    <div style={{ padding:"10px 12px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:8 }}>Revised risk (after controls)</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap:8 }}>
                        {[["L","Likelihood","revisedRisk"],["S","Severity","revisedRisk"]].map(([k,hint,obj])=>(
                          <div key={k}>
                            <label style={{ ...ss.lbl, marginBottom:2 }}>{k}</label>
                            <select value={r[obj][k]} onChange={e=>updateRow(r.id,obj,{...r[obj],[k]:parseInt(e.target.value),RF:parseInt(e.target.value)*(k==="L"?r[obj].S:r[obj].L)})} style={{ ...ss.inp, width:"auto" }}>
                              {[2,4,6].map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, fontSize:12 }}>RF = {r.revisedRisk.L} × {r.revisedRisk.S} = <strong>{r.revisedRisk.L*r.revisedRisk.S}</strong> <RiskBadge rf={r.revisedRisk.L*r.revisedRisk.S} /></div>
                    </div>
                  </div>

                  {/* control measures */}
                  <div style={{ marginBottom:12 }}>
                    <label style={ss.lbl}>Control measures</label>
                    {r.controlMeasures.map((cm,i)=>(
                      <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"flex-start" }}>
                        <span style={{ fontSize:12, color:"var(--color-text-secondary)", paddingTop:9, minWidth:16, textAlign:"right" }}>{i+1}.</span>
                        <textarea value={cm} onChange={e=>updateControl(r.id,i,e.target.value)} rows={2}
                          style={{ ...ss.ta, flex:1, minHeight:40 }} />
                        <button type="button" onClick={()=>removeControl(r.id,i)} style={{ ...ss.btn, padding:"4px 8px", color:"#A32D2D", borderColor:"#F09595", flexShrink:0, marginTop:4 }}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={()=>addControl(r.id)} style={{ ...ss.btn, fontSize:12, marginTop:4 }}>+ Add control measure</button>
                  </div>

                  {/* PPE */}
                  <div>
                    <label style={ss.lbl}>PPE required</label>
                    <input value={(r.ppeRequired||[]).join(", ")}
                      onChange={e=>updateRow(r.id,"ppeRequired",e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}
                      placeholder="e.g. Hard hat, Safety glasses, Gloves" style={ss.inp} />
                    <div style={{ fontSize:11, color:"var(--color-text-tertiary,#aaa)", marginTop:4 }}>Comma-separated list</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <button type="button" onClick={onBack} style={ss.btn}>← Back</button>
        <button type="button" onClick={onNext} style={ss.btnP}>Next — preview & save →</button>
      </div>
    </div>
  );
}

// ─── Step 4 — Preview & save ─────────────────────────────────────────────────
function PreviewSave({ form, setForm, rows, workers, projects, onSave, onBack }) {
  const [fpCopied, setFpCopied] = useState(false);
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const operatives = (form.operativeIds||[]).map(id=>workerMap[id]).filter(Boolean);
  const selectedWorkers = (form.operativeIds || []).map((id) => workers.find((w) => w.id === id)).filter(Boolean);
  const printFlags = normalizePrintSections(form.printSections);

  const previewFingerprint = computeRamsFingerprint(form, rows);

  const copyFingerprint = () => {
    navigator.clipboard?.writeText(previewFingerprint).then(() => {
      setFpCopied(true);
      setTimeout(() => setFpCopied(false), 2000);
    }).catch(() => {});
  };

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(previewAnchorId(sectionId));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const togglePrintSection = (id, checked) => {
    setForm((f) => ({ ...f, printSections: { ...f.printSections, [id]: checked } }));
  };

  const printRAMS = () => {
    const win = window.open("", "_blank");
    const pf = normalizePrintSections(form.printSections);
    const content = generatePrintHTML(form, rows, operatives, projectMap, pf, previewFingerprint, workers);
    win.document.write(content);
    win.document.close();
    win.print();
  };

  const tocItems = RAMS_PRINT_SECTIONS.filter((s) => {
    if (s.id === RAMS_SECTION_IDS.COVER) return true;
    if (s.id === RAMS_SECTION_IDS.WEATHER) return !!(form.siteWeatherNote || "").trim();
    if (s.id === RAMS_SECTION_IDS.MAP) return !!(form.siteMapUrl || "").trim() || !!(form.siteLat && form.siteLng);
    if (s.id === RAMS_SECTION_IDS.HOSPITAL) return !!(form.nearestHospital || "").trim() || !!(form.hospitalDirectionsUrl || "").trim();
    if (s.id === RAMS_SECTION_IDS.OPERATIVE_CERTS) return selectedWorkers.length > 0 && printFlags[RAMS_SECTION_IDS.OPERATIVE_CERTS] === true;
    if (s.id === RAMS_SECTION_IDS.HAZARDS) return rows.length > 0;
    if (s.id === RAMS_SECTION_IDS.SIGNATURES) return operatives.length > 0;
    if (s.id === RAMS_SECTION_IDS.INTEGRITY) return true;
    return true;
  });

  const highResidual = rows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
  const medResidual = rows.filter((r) => getRiskLevel(r.revisedRisk) === "medium").length;

  return (
    <div>
      <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:12 }}>
        Review your completed RAMS before saving. Use the table of contents to jump within the preview; toggles control what appears in print.
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 14,
          fontSize: 13,
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: "var(--radius-md, 12px)",
          background: "var(--color-background-secondary, #f8fafc)",
          border: "1px solid var(--color-border-tertiary)",
        }}
      >
        <span>
          <strong style={{ color: "var(--color-text-primary)" }}>{rows.length}</strong> hazard rows
        </span>
        <span>
          <strong style={{ color: "#791F1F" }}>{highResidual}</strong> high residual
        </span>
        <span>
          <strong style={{ color: "#633806" }}>{medResidual}</strong> medium residual
        </span>
        <span>
          <strong style={{ color: "var(--color-text-primary)" }}>{operatives.length}</strong> operatives (signatures)
        </span>
      </div>

      {highResidual > 0 && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: "var(--radius-md, 12px)",
            border: "1px solid #F5C2C2",
            background: "#FEF2F2",
            color: "#7F1D1D",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <span>
            <strong>High residual risk:</strong> {highResidual} row{highResidual !== 1 ? "s" : ""} still rated{" "}
            <strong>HIGH</strong> after controls — review likelihood/severity and additional controls before issue.
          </span>
          <button
            type="button"
            onClick={() => scrollToSection(RAMS_SECTION_IDS.HAZARDS)}
            style={{ ...ss.btn, fontSize: 12, padding: "6px 12px", minHeight: 36, flexShrink: 0 }}
          >
            Jump to risks in preview
          </button>
        </div>
      )}

      <div style={{ ...ss.card, marginBottom:14, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>Table of contents</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {tocItems.map((s) => (
            <button key={s.id} type="button" onClick={() => scrollToSection(s.id)} style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32 }}>
              {s.short}
            </button>
          ))}
        </div>
        <div style={{ marginTop:12, fontSize:11, color:"var(--color-text-secondary)" }}>
          Include in print:
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:6, alignItems:"center" }}>
          {RAMS_PRINT_SECTIONS.filter((x) => !x.locked).map((s) => (
            <label key={s.id} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer" }}>
              <input
                type="checkbox"
                checked={isSectionIncluded(s, printFlags)}
                onChange={(e) => togglePrintSection(s.id, e.target.checked)}
                style={{ accentColor:"#0d9488", width:14, height:14 }}
              />
              {s.short}
            </label>
          ))}
        </div>
      </div>

      {/* preview card */}
      <div style={{ ...ss.card, marginBottom:20, border:"0.5px solid #9FE1CB", maxHeight:"min(75vh, 780px)", overflowY:"auto", scrollBehavior:"smooth" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 4,
            margin: "-4px -8px 12px",
            padding: "10px 10px 12px",
            background: "linear-gradient(180deg, var(--color-background-primary,#fff) 65%, rgba(255,255,255,0.92) 100%)",
            WebkitBackdropFilter: "blur(8px)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--color-border-tertiary,#e5e5e5)",
            borderRadius: "var(--radius-md, 12px) var(--radius-md, 12px) 0 0",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Jump in preview
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tocItems.map((s) => (
              <button key={`sticky-${s.id}`} type="button" onClick={() => scrollToSection(s.id)} style={{ ...ss.btn, fontSize: 11, padding: "4px 10px", minHeight: 32 }}>
                {s.short}
              </button>
            ))}
          </div>
        </div>
        {/* cover */}
        <div id={previewAnchorId(RAMS_SECTION_IDS.COVER)} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", paddingBottom:14, marginBottom:14, scrollMarginTop:72 }}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Location</div>
              <div style={{ fontWeight:500 }}>{form.location}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Project</div>
              <div style={{ fontWeight:500 }}>{form.projectId ? projectMap[form.projectId] || "—" : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Job reference</div>
              <div style={{ fontWeight:500 }}>{form.jobRef||"—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Date</div>
              <div>{fmtDate(form.date)}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:2 }}>Lead engineer</div>
              <div>{form.leadEngineer||"—"}</div>
            </div>
          </div>
          <div style={{ background:"#f97316", borderRadius:6, padding:"8px 12px", color:"#fff", fontSize:14, fontWeight:500, textAlign:"center", marginBottom:8 }}>
            {form.title}
          </div>
          {form.scope && <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{form.scope}</div>}
        </div>

        {(form.siteWeatherNote || "").trim() && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.WEATHER)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Site weather</div>
            <div style={{ fontSize:12, whiteSpace:"pre-wrap", lineHeight:1.45 }}>{form.siteWeatherNote}</div>
          </div>
        )}

        {((form.siteMapUrl || "").trim() || (form.siteLat && form.siteLng)) && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.MAP)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Map / location</div>
            {(form.siteMapUrl || "").trim() && (() => {
              const raw = (form.siteMapUrl || "").trim();
              const safe = safeHttpUrl(raw);
              return safe ? (
                <a href={safe} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#0d9488", wordBreak:"break-all" }}>
                  {raw}
                </a>
              ) : (
                <span style={{ fontSize:12, color:"var(--color-text-secondary)", wordBreak:"break-all" }} title="Use http(s) URL only">{raw}</span>
              );
            })()}
            {(form.siteLat && form.siteLng) && (
              <div style={{ fontSize:12, marginTop:6 }}>
                Coordinates: {form.siteLat}, {form.siteLng}{" "}
                <a href={googleMapsSearchUrl(`${form.siteLat},${form.siteLng}`)} target="_blank" rel="noopener noreferrer" style={{ color:"#0d9488" }}>
                  Open in Google Maps
                </a>
              </div>
            )}
          </div>
        )}

        {((form.nearestHospital || "").trim() || (form.hospitalDirectionsUrl || "").trim()) && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.HOSPITAL)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:6 }}>Nearest A&amp;E / hospital</div>
            {form.nearestHospital && <div style={{ fontSize:12, marginBottom:4 }}>{form.nearestHospital}</div>}
            {(form.hospitalDirectionsUrl || "").trim() && (() => {
              const raw = (form.hospitalDirectionsUrl || "").trim();
              const safe = safeHttpUrl(raw);
              return safe ? (
                <a href={safe} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#0d9488", wordBreak:"break-all" }}>
                  Directions link
                </a>
              ) : (
                <span style={{ fontSize:12, color:"var(--color-text-secondary)" }} title="Use http(s) URL only">Invalid directions URL</span>
              );
            })()}
          </div>
        )}

        {selectedWorkers.length > 0 && printFlags[RAMS_SECTION_IDS.OPERATIVE_CERTS] === true && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.OPERATIVE_CERTS)} style={{ marginBottom:14, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:8 }}>Operative competencies</div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8 }}>From Workers — verify on site.</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e5e5e5)", textAlign:"left", color:"var(--color-text-secondary)", fontSize:11 }}>
                  <th style={{ padding:"6px 8px 6px 0", fontWeight:600 }}>Name</th>
                  <th style={{ padding:"6px 8px", fontWeight:600 }}>Role</th>
                  <th style={{ padding:"6px 0 6px 8px", fontWeight:600 }}>Certificates / notes</th>
                </tr>
              </thead>
              <tbody>
                {selectedWorkers.map((w) => (
                  <tr key={w.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#eee)", verticalAlign:"top" }}>
                    <td style={{ padding:"8px 8px 8px 0", fontWeight:500 }}>{w.name}</td>
                    <td style={{ padding:8, color:"var(--color-text-secondary)" }}>{w.role || "—"}</td>
                    <td style={{ padding:"8px 0 8px 8px", lineHeight:1.45 }}>{formatOperativeCertsLine(w) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* hazard summary */}
        <div id={previewAnchorId(RAMS_SECTION_IDS.HAZARDS)} style={{ scrollMarginTop:72 }}>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:10 }}>
            {rows.length} risk assessment rows · {rows.filter(r=>getRiskLevel(r.initialRisk)==="high").length} high risk activities
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {rows.map((r,i)=>{
              const rl = getRiskLevel(r.revisedRisk);
              const c = RL[rl];
              return (
                <div key={r.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"6px 8px", background:"var(--color-background-secondary,#f7f7f5)", borderRadius:6, fontSize:12 }}>
                  <span style={{ color:"var(--color-text-secondary)", minWidth:20, textAlign:"right" }}>{i+1}</span>
                  <span style={{ flex:1, fontWeight:500 }}>{r.activity}</span>
                  <span style={{ padding:"1px 8px", borderRadius:20, fontSize:11, background:c.bg, color:c.color }}>RF {r.revisedRisk.L*r.revisedRisk.S}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* operatives */}
        {operatives.length>0 && (
          <div id={previewAnchorId(RAMS_SECTION_IDS.SIGNATURES)} style={{ marginTop:14, paddingTop:14, borderTop:"0.5px solid var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>Operatives to sign:</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {operatives.map(n=>(
                <span key={n} style={{ padding:"2px 10px", borderRadius:20, fontSize:11, background:"#EAF3DE", color:"#27500A" }}>{n}</span>
              ))}
            </div>
          </div>
        )}

        <div id={previewAnchorId(RAMS_SECTION_IDS.INTEGRITY)} style={{ marginTop:14, paddingTop:12, borderTop:"0.5px dashed var(--color-border-tertiary,#e5e5e5)", scrollMarginTop:72 }}>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)" }}>Document integrity (preview)</div>
            <button type="button" onClick={copyFingerprint} style={{ ...ss.btn, fontSize:11, padding:"4px 10px", minHeight:32 }}>
              {fpCopied ? "Copied" : "Copy fingerprint"}
            </button>
          </div>
          <div style={{ fontSize:11, fontFamily:"ui-monospace, monospace", color:"var(--color-text-secondary)", wordBreak:"break-all" }}>
            Fingerprint: {previewFingerprint} — updates when content above changes. Stored on save.
          </div>
        </div>
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:8 }}>
        <button type="button" onClick={onBack} style={ss.btn}>← Back</button>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          <button type="button" onClick={printRAMS} style={ss.btn}>
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="1" width="10" height="10" rx="1"/><path d="M1 8h14v6H1z"/><path d="M5 14v-3h6v3"/><circle cx="12" cy="11" r=".5" fill="currentColor"/></svg>
            Print / PDF
          </button>
          <button type="button" onClick={onSave} style={ss.btnO}>
            Save RAMS
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Saved RAMS list ─────────────────────────────────────────────────────────
function SavedList({ ramsDocs, workers, projects, onNew, onEdit, onDelete, onPrint, onDuplicate, onExportJson, onCopyShareLink, onImportJson }) {
  const workerMap = Object.fromEntries(workers.map(w=>[w.id,w.name]));
  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const [q, setQ] = useState("");
  const importRef = useRef(null);

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onImportJson(parsed);
      } catch (err) {
        alert(err?.message || "Could not import file.");
      }
    };
    reader.onerror = () => alert("Could not read file.");
    reader.readAsText(file);
  };

  const sortedByDate = useMemo(() => {
    return [...ramsDocs].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [ramsDocs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sortedByDate;
    return sortedByDate.filter((d) => {
      const pn = d.projectId ? projectMap[d.projectId] || "" : "";
      return (
        (d.title || "").toLowerCase().includes(s) ||
        (d.location || "").toLowerCase().includes(s) ||
        (d.jobRef || "").toLowerCase().includes(s) ||
        pn.toLowerCase().includes(s)
      );
    });
  }, [sortedByDate, q, projectMap]);

  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:16 }}>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
          {ramsDocs.length} RAMS document{ramsDocs.length!==1?"s":""}
          {q.trim() ? ` · showing ${filtered.length}` : ""}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
          {ramsDocs.length > 0 && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, location, ref, project…"
              style={{ ...ss.inp, minWidth: 200, maxWidth: 360 }}
              aria-label="Search RAMS list"
            />
          )}
          <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onImportFile} aria-hidden />
          <button type="button" onClick={() => importRef.current?.click()} style={ss.btn} title="Restore from a previously exported .json file">
            Import JSON
          </button>
          <button type="button" onClick={onNew} style={ss.btnO}>+ Build new RAMS</button>
        </div>
      </div>

      {ramsDocs.length===0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2.75rem 1.25rem",
            border: "2px dashed var(--color-border-tertiary,#e2e8f0)",
            borderRadius: "var(--radius-lg, 16px)",
            background: "linear-gradient(180deg, rgba(13,148,136,0.06) 0%, var(--color-background-primary) 55%)",
          }}
        >
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0, lineHeight: 1.55, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            No RAMS yet. Use <strong style={{ color: "var(--color-text-primary)" }}>Build new</strong> or <strong style={{ color: "var(--color-text-primary)" }}>Import JSON</strong> above (e.g. from another device or backup).
          </p>
        </div>
      ) : filtered.length===0 ? (
        <div style={{ ...ss.card, textAlign:"center", color:"var(--color-text-secondary)", fontSize:13 }}>
          No documents match your search.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map((doc) => (
            <div key={doc.id} className="app-rams-doc-row" style={{ ...ss.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{doc.title}</div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12, color:"var(--color-text-secondary)" }}>
                  <span>{doc.location}</span>
                  {doc.projectId && projectMap[doc.projectId] && <span>Project: {projectMap[doc.projectId]}</span>}
                  {doc.jobRef && <span>Ref: {doc.jobRef}</span>}
                  <span>{doc.rows?.length||0} hazard rows</span>
                  <span>Created: {fmtDate(doc.createdAt)}</span>
                  {doc.reviewDate && <span style={{ color: new Date(doc.reviewDate)<new Date() ? "#A32D2D" : "inherit" }}>Review: {fmtDate(doc.reviewDate)}</span>}
                  {doc.contentHash && <span style={{ fontFamily:"ui-monospace, monospace", fontSize:10 }} title="Fingerprint">#{String(doc.contentHash).slice(0,8)}…</span>}
                </div>
                {(doc.operativeIds||[]).length>0 && (
                  <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(doc.operativeIds||[]).map(id=>(
                      <span key={id} style={{ padding:"1px 8px", borderRadius:20, fontSize:10, background:"#EAF3DE", color:"#27500A" }}>{workerMap[id]||id}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0, justifyContent:"flex-end", maxWidth: 420 }}>
                <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:500,
                  background:doc.status==="approved"?"#EAF3DE":doc.status==="draft"?"var(--color-background-secondary,#f7f7f5)":"#FAEEDA",
                  color:doc.status==="approved"?"#27500A":doc.status==="draft"?"var(--color-text-secondary)":"#633806" }}>
                  {doc.status||"draft"}
                </span>
                <button type="button" onClick={()=>onPrint(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Print</button>
                <button type="button" onClick={()=>onDuplicate(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>Duplicate</button>
                <button type="button" onClick={()=>onExportJson(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }}>JSON</button>
                <button type="button" onClick={()=>onCopyShareLink(doc)} style={{ ...ss.btn, padding:"4px 10px", fontSize:12 }} title="Read-only link, this browser only">Share</button>
                <button type="button" onClick={()=>onEdit(doc)} style={{ ...ss.btnP, padding:"4px 10px", fontSize:12 }}>Edit</button>
                <button type="button" onClick={()=>onDelete(doc.id)} style={{ ...ss.btn, padding:"4px 8px", fontSize:12, color:"#A32D2D", borderColor:"#F09595" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formShapeForCompare(f) {
  if (!f || typeof f !== "object") return {};
  return {
    title: f.title,
    location: f.location,
    scope: f.scope,
    date: f.date,
    projectId: f.projectId,
    leadEngineer: f.leadEngineer,
    jobRef: f.jobRef,
    revision: f.revision,
    reviewDate: f.reviewDate,
    operativeIds: [...(f.operativeIds || [])].sort(),
    siteWeatherNote: f.siteWeatherNote,
    siteMapUrl: f.siteMapUrl,
    siteLat: f.siteLat,
    siteLng: f.siteLng,
    nearestHospital: f.nearestHospital,
    hospitalDirectionsUrl: f.hospitalDirectionsUrl,
    printSections: f.printSections,
  };
}

function rowsShapeForCompare(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    sourceId: r.sourceId,
    category: r.category,
    activity: r.activity,
    hazard: r.hazard,
    initialRisk: r.initialRisk,
    revisedRisk: r.revisedRisk,
    controlMeasures: r.controlMeasures,
    ppeRequired: r.ppeRequired,
  }));
}

function snapshotBuilderState(step, form, rows) {
  return JSON.stringify({
    step,
    form: formShapeForCompare(form),
    rows: rowsShapeForCompare(rows),
  });
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function RAMSTemplateBuilder() {
  const [view, setView] = useState("list"); // list | builder
  const [step, setStep] = useState(1);
  const [ramsDocs, setRamsDocs] = useState(()=>load("rams_builder_docs",[]));
  const [workers] = useState(()=>load("mysafeops_workers",[]));
  const [projects] = useState(()=>load("mysafeops_projects",[]));
  const [editingDoc, setEditingDoc] = useState(null);

  // builder state
  const [form, setForm] = useState({});
  const [selectedHazards, setSelectedHazards] = useState([]);
  const [editedRows, setEditedRows] = useState([]);

  const builderBaselineRef = useRef("");

  const builderDirty = useMemo(
    () => snapshotBuilderState(step, form, editedRows) !== builderBaselineRef.current,
    [step, form, editedRows]
  );

  useEffect(() => {
    if (view !== "builder" || !builderDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [view, builderDirty]);

  useEffect(() => {
    if (view !== "builder") return undefined;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(
          RAMS_DRAFT_KEY,
          JSON.stringify({
            step,
            form,
            editedRows,
            selectedHazards,
            savedAt: Date.now(),
          })
        );
      } catch (e) {
        /* quota or private mode */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [view, step, form, editedRows, selectedHazards]);

  useEffect(()=>{ save("rams_builder_docs",ramsDocs); },[ramsDocs]);

  const startNew = () => {
    let formInit = { ...RAMS_FORM_DEFAULTS, date: today(), revision: "1A" };
    let rowsInit = [];
    let selInit = [];
    let startStep = 1;
    let usedAi = false;
    try {
      const raw = sessionStorage.getItem("mysafeops_ai_rams_prefill");
      if (raw) {
        usedAi = true;
        sessionStorage.removeItem("mysafeops_ai_rams_prefill");
        const d = JSON.parse(raw);
        formInit = {
          ...formInit,
          title: d.title || "",
          location: d.location || "",
          leadEngineer: d.leadEngineer || "",
          jobRef: d.jobRef || "",
        };
        (d.hazards || []).forEach((h) => {
          const id = genId();
          const sourceId = `ai_${id}`;
          rowsInit.push({
            id,
            sourceId,
            category: h.category || "General",
            activity: h.activity || "",
            hazard: h.hazard || "",
            initialRisk: h.initialRisk || { L: 3, S: 4, RF: 12 },
            revisedRisk: h.revisedRisk || { L: 2, S: 4, RF: 8 },
            controlMeasures: h.controlMeasures || [],
            ppeRequired: h.ppeRequired || [],
            regs: h.regs || [],
          });
          selInit.push({ id: sourceId });
        });
        if (rowsInit.length) startStep = 3;
      }
    } catch (e) {
      console.warn(e);
    }

    if (!usedAi) {
      try {
        const rawDraft = sessionStorage.getItem(RAMS_DRAFT_KEY);
        if (rawDraft) {
          const d = JSON.parse(rawDraft);
          const age = Date.now() - (d.savedAt || 0);
          if (
            d &&
            typeof d.step === "number" &&
            age >= 0 &&
            age < RAMS_DRAFT_MAX_AGE_MS
          ) {
            const when = d.savedAt ? new Date(d.savedAt).toLocaleString() : "recently";
            if (window.confirm(`Resume unsaved RAMS draft from ${when}?`)) {
              const fi = {
                ...RAMS_FORM_DEFAULTS,
                ...(d.form || {}),
                date: (d.form && d.form.date) || today(),
              };
              const er = Array.isArray(d.editedRows) ? d.editedRows : [];
              const sh = Array.isArray(d.selectedHazards) ? d.selectedHazards : [];
              const st = Math.min(4, Math.max(1, Number(d.step) || 1));
              setForm(fi);
              setEditedRows(er);
              setSelectedHazards(sh);
              setStep(st);
              setEditingDoc(null);
              builderBaselineRef.current = snapshotBuilderState(st, fi, er);
              setView("builder");
              return;
            }
            sessionStorage.removeItem(RAMS_DRAFT_KEY);
          } else if (rawDraft) {
            sessionStorage.removeItem(RAMS_DRAFT_KEY);
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    setForm(formInit);
    setSelectedHazards(selInit);
    setEditedRows(rowsInit);
    setStep(startStep);
    setEditingDoc(null);
    builderBaselineRef.current = snapshotBuilderState(startStep, formInit, rowsInit);
    setView("builder");
  };

  const startEdit = (doc) => {
    const { rows: docRows, ...docRest } = doc;
    const mergedForm = { ...RAMS_FORM_DEFAULTS, ...docRest };
    const rows = docRows || [];
    setForm(mergedForm);
    setEditedRows(rows);
    setSelectedHazards((doc.rows||[]).map(r=>({ id:r.sourceId||r.id })));
    setEditingDoc(doc);
    setStep(3); // jump to editor
    builderBaselineRef.current = snapshotBuilderState(3, mergedForm, rows);
    setView("builder");
  };

  const goToList = () => {
    if (builderDirty && !window.confirm("Leave RAMS builder? Unsaved changes will be lost.")) return;
    setView("list");
  };

  const clearHazardSelection = () => {
    setSelectedHazards([]);
    setEditedRows([]);
  };

  const addHazardsVisible = (visibleList) => {
    if (!Array.isArray(visibleList) || visibleList.length === 0) return;
    const existing = new Set(selectedHazards.map((s) => s.id));
    const toAdd = visibleList.filter((h) => h && !existing.has(h.id));
    if (toAdd.length === 0) return;
    setSelectedHazards((prev) => [...prev, ...toAdd]);
    setEditedRows((rows) => [
      ...rows,
      ...toAdd.map((h) => ({ ...JSON.parse(JSON.stringify(h)), sourceId: h.id, id: genId() })),
    ]);
  };

  const toggleHazard = (h) => {
    setSelectedHazards(prev => {
      const exists = prev.some(s=>s.id===h.id);
      if (exists) {
        setEditedRows(rows => rows.filter(r=>(r.sourceId||r.id)!==h.id));
        return prev.filter(s=>s.id!==h.id);
      } else {
        // add to edited rows with copy of library data
        const newRow = { ...JSON.parse(JSON.stringify(h)), sourceId:h.id, id:genId() };
        setEditedRows(rows=>[...rows, newRow]);
        return [...prev, h];
      }
    });
  };

  const handleSave = () => {
    const highResidualRows = editedRows.filter((r) => getRiskLevel(r.revisedRisk) === "high").length;
    if (highResidualRows > 0) {
      if (
        !window.confirm(
          `This RAMS has ${highResidualRows} hazard row(s) with HIGH residual risk after controls. Only save if that is intentional (e.g. further controls on site). Continue?`
        )
      ) {
        return;
      }
    }
    try {
      sessionStorage.removeItem(RAMS_DRAFT_KEY);
    } catch (e) {
      /* ignore */
    }
    const contentHash = computeRamsFingerprint(form, editedRows);
    const doc = {
      ...form,
      id: editingDoc?.id || genId(),
      rows: editedRows,
      status: "draft",
      createdAt: editingDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contentHash,
    };
    setRamsDocs(prev => editingDoc
      ? prev.map(d=>d.id===doc.id?doc:d)
      : [doc,...prev]
    );
    setView("list");
  };

  const deleteDoc = (id) => { if(confirm("Delete this RAMS?")) setRamsDocs(prev=>prev.filter(d=>d.id!==id)); };

  const printSavedDoc = (doc) => {
    openRamsPrintWindow(doc, doc.rows || [], workers, projects);
  };

  const duplicateDoc = (doc) => {
    const { shareToken: _st, contentHash: _ch, id: _oid, rows: srcRows, ...rest } = doc;
    const rows = JSON.parse(JSON.stringify(srcRows || []));
    const newDoc = {
      ...RAMS_FORM_DEFAULTS,
      ...rest,
      id: genId(),
      title: `${doc.title || "RAMS"} (copy)`,
      rows,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareToken: undefined,
      contentHash: undefined,
      status: "draft",
    };
    newDoc.contentHash = computeRamsFingerprint(newDoc, rows);
    setRamsDocs((prev) => [newDoc, ...prev]);
  };

  const exportDocJson = (doc) => {
    const safe = (doc.title || "rams").replace(/[^\w\-\s]/g, "").replace(/\s+/g, "_").slice(0, 48);
    const wm = Object.fromEntries(workers.map((w) => [w.id, w.name || ""]));
    const operativeNames = (doc.operativeIds || []).map((id) => wm[id] || "");
    const payload = {
      ...doc,
      _mysafeops_export: {
        version: 1,
        exportedAt: new Date().toISOString(),
        operativeNames,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}_${(doc.id || "").slice(-8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importRamsJson = (parsed) => {
    if (!parsed || typeof parsed !== "object") throw new Error("File must contain a JSON object.");
    if (!Array.isArray(parsed.rows)) throw new Error('Expected a "rows" array (hazard lines). Export from MySafeOps or use a compatible backup.');
    const rows = parsed.rows.map((r) => ({ ...r, id: genId() }));
    const {
      id: _i,
      shareToken: _st,
      contentHash: _ch,
      rows: _r,
      createdAt: _c,
      updatedAt: _u,
      _mysafeops_export: exportMeta,
      ...rest
    } = parsed;
    const rawOpIds = Array.isArray(parsed.operativeIds) ? parsed.operativeIds : [];
    const operativeNames = exportMeta?.operativeNames;
    const operativeIds = remapOperativeIds(rawOpIds, operativeNames, workers);
    const doc = {
      ...RAMS_FORM_DEFAULTS,
      ...rest,
      id: genId(),
      rows,
      operativeIds,
      title: (typeof parsed.title === "string" && parsed.title.trim()) ? parsed.title.trim() : "Imported RAMS",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shareToken: undefined,
      status: parsed.status || "draft",
    };
    doc.contentHash = computeRamsFingerprint(doc, rows);
    setRamsDocs((prev) => [doc, ...prev]);
    alert(`Imported: ${doc.title}`);
  };

  const genShareToken = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;

  const copyShareLink = (doc) => {
    let token = doc.shareToken;
    if (!token) {
      token = genShareToken();
      setRamsDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, shareToken: token, updatedAt: new Date().toISOString() } : d
        )
      );
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const url = `${base}?ramsShare=${encodeURIComponent(token)}`;
    navigator.clipboard?.writeText(url).then(() =>
      alert("Link copied. Opens read-only RAMS in this browser only (same saved data as here).")
    );
  };

  const STEPS = ["Document info","Select hazards","Review & edit","Preview & save"];

  if (view==="list") {
    return (
      <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
        <PageHero
          badgeText="RAMS"
          title="RAMS builder"
          lead="Build RAMS from the hazard library — export/import JSON, share read-only links, optional operative certificates from Workers, site weather and map links. Unsaved work is kept as a draft in this browser for up to a week — choose &quot;Resume&quot; when you start a new RAMS."
        />
        <SavedList
          ramsDocs={ramsDocs}
          workers={workers}
          projects={projects}
          onNew={startNew}
          onEdit={startEdit}
          onDelete={deleteDoc}
          onPrint={printSavedDoc}
          onDuplicate={duplicateDoc}
          onExportJson={exportDocJson}
          onCopyShareLink={copyShareLink}
          onImportJson={importRamsJson}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"DM Sans,system-ui,sans-serif", padding:"1.25rem 0", fontSize:14, color:"var(--color-text-primary)" }}>
      {/* header */}
      <div
        className="app-panel-surface app-rams-builder-header"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
          padding: "15px 14px 14px",
        }}
      >
        <button type="button" onClick={goToList} style={{ ...ss.btn, fontSize: 12 }}>
          ← Back to list
        </button>
        <h2 style={{ fontWeight: 600, fontSize: 17, margin: 0, flex: "1 1 200px", letterSpacing: "-0.02em" }}>
          {editingDoc ? `Edit: ${form.title || "Untitled"}` : "New RAMS"}
        </h2>
      </div>

      {/* step progress — click a completed step to go back */}
      <div className="app-rams-stepper" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const done = stepNum < step;
          const current = stepNum === step;
          const canGoBack = step > stepNum;
          return (
            <div key={i} style={{ flex: "1 1 120px", textAlign: "center", minWidth: 0 }}>
              <button
                type="button"
                className="app-rams-stepper-btn"
                disabled={!canGoBack}
                onClick={() => canGoBack && setStep(stepNum)}
                aria-label={canGoBack ? `Go back to step ${stepNum}: ${s}` : current ? `Current step: ${s}` : `Step ${stepNum}: ${s}`}
                aria-current={current ? "step" : undefined}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  padding: "4px 4px 0",
                  cursor: canGoBack ? "pointer" : "default",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                  <div
                    className="app-rams-stepper-dot"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-full, 9999px)",
                      background: done ? "var(--color-accent,#0d9488)" : current ? "#f97316" : "var(--color-background-primary,#fff)",
                      color: done || current ? "#fff" : "var(--color-text-muted,#94a3b8)",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: current ? "2px solid #fdba74" : done ? "none" : "1px solid var(--color-border-tertiary)",
                      boxShadow: current ? "0 0 0 4px rgba(249, 115, 22, 0.2)" : done ? "0 2px 8px rgba(13, 148, 136, 0.25)" : "var(--shadow-sm)",
                      pointerEvents: "none",
                    }}
                  >
                    {stepNum}
                  </div>
                </div>
                <div
                  className="app-stepper-segment"
                  style={{
                    height: 4,
                    borderRadius: 4,
                    background: done ? "var(--color-accent,#0d9488)" : current ? "#fed7aa" : "var(--color-border-tertiary)",
                    marginBottom: 8,
                    maxWidth: 100,
                    marginLeft: "auto",
                    marginRight: "auto",
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: current ? 600 : 500,
                    color: current ? "#c2410c" : done ? "var(--color-accent-hover,#0f766e)" : "var(--color-text-secondary)",
                    lineHeight: 1.35,
                    display: "block",
                    pointerEvents: "none",
                  }}
                >
                  {s}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* steps */}
      <div className="app-rams-step-body">
        {step===1 && <StepInfo form={form} setForm={setForm} projects={projects} workers={workers} onNext={()=>setStep(2)} />}
        {step===2 && (
          <HazardPicker
            selected={selectedHazards}
            onToggle={toggleHazard}
            onClearSelected={clearHazardSelection}
            onAddAllVisible={addHazardsVisible}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step===3 && <HazardEditor rows={editedRows} setRows={setEditedRows} onNext={()=>setStep(4)} onBack={() => setStep(2)} />}
        {step===4 && <PreviewSave form={form} setForm={setForm} rows={editedRows} workers={workers} projects={projects} onSave={handleSave} onBack={()=>setStep(3)} />}
      </div>
    </div>
  );
}
