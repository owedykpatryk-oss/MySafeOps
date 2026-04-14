import { useState, useEffect } from "react";
import { ms } from "../utils/moduleStyles";
import { geocodeAddressNominatim } from "../utils/geocode";
import PageHero from "../components/PageHero";
import { getOrgId, orgScopedKey, loadOrgScoped, saveOrgScoped } from "../utils/orgStorage";
import {
  CERT_LIBRARY,
  certLabel,
  addMonthsIso,
  normalizeWorkerCertifications,
  getWorkerCertAlerts,
} from "../utils/certifications";
import { pushRecycleBinItem } from "../utils/recycleBin";

const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";

const load = (key) => loadOrgScoped(key, []);
const save = (key, data) => saveOrgScoped(key, data);

const genId = () => `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const ss = { ...ms, btnO: { padding: "10px 14px", borderRadius: 6, border: "0.5px solid #c2410c", background: "#f97316", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", minHeight: 44, lineHeight: 1.3 } };

function toCsv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function certSummaryText(worker) {
  const certs = normalizeWorkerCertifications(worker);
  if (certs.length === 0) return "";
  return certs.map((c) => `${c.certType}${c.expiryDate ? ` (${c.expiryDate})` : ""}`).join("; ");
}

export default function Workers() {
  const [workers, setWorkers] = useState(() => load(WORKERS_KEY));
  const [projects, setProjects] = useState(() => load(PROJECTS_KEY));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save(WORKERS_KEY, workers);
  }, [workers]);
  useEffect(() => {
    save(PROJECTS_KEY, projects);
  }, [projects]);

  const exportWorkersCsv = () => {
    const header = ["Name", "Role", "Phone", "Email", "Certs / notes", "Structured certifications"];
    const rows = workers.map((w) => [w.name || "", w.role || "", w.phone || "", w.email || "", w.certs || "", certSummaryText(w)]);
    const blob = new Blob([toCsv([header, ...rows])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workers_${getOrgId()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveWorker = (form) => {
    setWorkers((prev) => {
      const i = prev.findIndex((x) => x.id === form.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = form;
        return next;
      }
      return [form, ...prev];
    });
    setModal(null);
  };

  const removeWorker = (id) => {
    if (!confirm("Remove this worker?")) return;
    setWorkers((prev) => {
      const victim = prev.find((w) => w.id === id);
      if (victim) {
        pushRecycleBinItem({
          moduleId: "workers",
          moduleLabel: "Workers",
          itemType: "worker",
          itemLabel: victim.name || victim.id,
          sourceKey: WORKERS_KEY,
          payload: victim,
        });
      }
      return prev.filter((w) => w.id !== id);
    });
  };

  const saveProject = (form) => {
    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === form.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = form;
        return next;
      }
      return [form, ...prev];
    });
    setModal(null);
  };

  const removeProject = (id) => {
    if (!confirm("Remove this project?")) return;
    setProjects((prev) => {
      const victim = prev.find((p) => p.id === id);
      if (victim) {
        pushRecycleBinItem({
          moduleId: "workers",
          moduleLabel: "Workers",
          itemType: "project",
          itemLabel: victim.name || victim.id,
          sourceKey: PROJECTS_KEY,
          payload: victim,
        });
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const certAlerts = workers
    .flatMap((w) => getWorkerCertAlerts(w).map((a) => ({ ...a, worker: w })))
    .sort((a, b) => a.days - b.days);
  const criticalAlerts = certAlerts.filter((a) => a.severity === "expired" || a.severity === "critical");

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      {modal?.type === "worker" && (
        <WorkerForm
          item={modal.data}
          onSave={saveWorker}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "project" && (
        <ProjectForm
          item={modal.data}
          onSave={saveProject}
          onClose={() => setModal(null)}
        />
      )}

      <PageHero
        badgeText="WP"
        title="Workers & projects"
        lead="People and sites used across RAMS, permits, daily briefings, site map, and registers."
        right={
          <>
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "worker", data: null })}>
              Add worker
            </button>
            <button type="button" style={ss.btnO} onClick={() => setModal({ type: "project", data: null })}>
              Add project
            </button>
            <button type="button" style={ss.btn} onClick={exportWorkersCsv}>
              Export CSV
            </button>
          </>
        }
      />

      <p style={{ color: "var(--color-text-secondary)", fontSize: 12, marginBottom: 20, marginTop: -8 }}>
        Storage keys: <code style={{ fontSize: 11 }}>{orgScopedKey(WORKERS_KEY)}</code>, <code style={{ fontSize: 11 }}>{orgScopedKey(PROJECTS_KEY)}</code>
      </p>

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Certification alerts</div>
          <span style={ss.chip}>{certAlerts.length} alert(s)</span>
        </div>
        {certAlerts.length === 0 ? (
          <div style={{ marginTop: 8, color: "var(--color-text-secondary)", fontSize: 13 }}>No expiring certifications right now.</div>
        ) : (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {certAlerts.slice(0, 8).map((a) => (
              <div key={`${a.worker.id}_${a.cert.certCode}_${a.cert.expiryDate}`} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: a.severity === "expired" ? "#FCEBEB" : a.severity === "critical" ? "#FCEBEB" : "#FAEEDA", color: a.severity === "warning" ? "#633806" : "#791F1F" }}>
                <strong>{a.worker.name || "Unnamed worker"}</strong> · {a.cert.certType} ·{" "}
                {a.days < 0 ? `expired ${Math.abs(a.days)} day(s) ago` : `expires in ${a.days} day(s)`}
              </div>
            ))}
            {criticalAlerts.length > 0 ? (
              <div style={{ fontSize: 11, color: "#791F1F" }}>
                Critical: {criticalAlerts.length} certificate(s) require immediate action.
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 16 }}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          Workers ({workers.length})
        </div>
        {workers.length === 0 && <div style={{ color: "var(--color-text-secondary)" }}>No workers yet.</div>}
        {workers.map((w) => (
          <div
            key={w.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
            }}
          >
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <strong>{w.name || "Unnamed"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{w.role || "—"} · {w.phone || w.email || ""}</div>
              {normalizeWorkerCertifications(w).length > 0 ? (
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                  {normalizeWorkerCertifications(w)
                    .slice(0, 3)
                    .map((c) => `${c.certType}${c.expiryDate ? ` (${c.expiryDate})` : ""}`)
                    .join(" · ")}
                </div>
              ) : null}
            </div>
            <button type="button" style={ss.btn} onClick={() => setModal({ type: "worker", data: w })}>
              Edit
            </button>
            <button type="button" style={ss.btn} onClick={() => removeWorker(w.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="app-surface-card" style={ss.card}>
        <div className="app-section-label" style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, textTransform: "none", letterSpacing: "normal", color: "var(--color-text-primary)" }}>
          Projects ({projects.length})
        </div>
        {projects.length === 0 && <div style={{ color: "var(--color-text-secondary)" }}>No projects yet.</div>}
        {projects.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
            }}
          >
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <strong>{p.name || "Unnamed"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{p.site || p.address || ""}</div>
            </div>
            <button type="button" style={ss.btn} onClick={() => setModal({ type: "project", data: p })}>
              Edit
            </button>
            <button type="button" style={ss.btn} onClick={() => removeProject(p.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function workerFormShape(w) {
  const baseMatrix = Object.fromEntries(
    CERT_LIBRARY.map((c) => [
      c.code,
      { enabled: false, expiryDate: "", certNumber: "", provider: "" },
    ])
  );
  if (w) {
    normalizeWorkerCertifications(w).forEach((c) => {
      const key = String(c.certCode || "").toLowerCase();
      if (baseMatrix[key]) {
        baseMatrix[key] = {
          enabled: true,
          expiryDate: c.expiryDate || "",
          certNumber: c.certNumber || "",
          provider: c.provider || "",
        };
      }
    });
  }
  if (!w) {
    return {
      id: genId(),
      name: "",
      role: "",
      phone: "",
      email: "",
      certs: "",
      certType: "",
      certExpiry: "",
      certifications: [],
      certMatrix: baseMatrix,
      projectIds: [],
    };
  }
  const c0 = w.certifications?.[0];
  return {
    ...w,
    certType: c0?.certType || "",
    certExpiry: c0?.expiryDate || "",
    certMatrix: baseMatrix,
  };
}

function WorkerForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => workerFormShape(item));
  const [certFilter, setCertFilter] = useState("");
  useEffect(() => {
    setForm(workerFormShape(item));
  }, [item?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCert = (code, key, value) =>
    setForm((f) => ({
      ...f,
      certMatrix: {
        ...(f.certMatrix || {}),
        [code]: { ...(f.certMatrix?.[code] || {}), [key]: value },
      },
    }));

  const toggleCert = (code, enabled) => {
    setForm((f) => {
      const prev = f.certMatrix?.[code] || {};
      const lib = CERT_LIBRARY.find((x) => x.code === code);
      return {
        ...f,
        certMatrix: {
          ...(f.certMatrix || {}),
          [code]: {
            ...prev,
            enabled,
            expiryDate: enabled ? prev.expiryDate || addMonthsIso(new Date().toISOString(), lib?.defaultValidityMonths || 24) : prev.expiryDate || "",
          },
        },
      };
    });
  };

  const persist = () => {
    const certs = [];
    if (form.certType?.trim() && form.certExpiry) {
      certs.push({ certType: form.certType.trim(), expiryDate: form.certExpiry });
    }
    const rest = (form.certifications || []).filter((c) => c?.certType && c?.expiryDate);
    const merged = [...rest, ...certs];
    const matrixRows = Object.entries(form.certMatrix || {})
      .filter(([, v]) => v?.enabled)
      .map(([code, v]) => ({
        certCode: code,
        certType: certLabel(code),
        expiryDate: String(v.expiryDate || "").slice(0, 10),
        certNumber: String(v.certNumber || ""),
        provider: String(v.provider || ""),
      }));
    const mergedAll = [...merged, ...matrixRows];
    const uniqueAll = mergedAll.filter(
      (c, i, a) =>
        a.findIndex(
          (x) =>
            String(x.certCode || x.certType).toLowerCase() === String(c.certCode || c.certType).toLowerCase() &&
            String(x.expiryDate || "") === String(c.expiryDate || "")
        ) === i
    );
    onSave({ ...form, certifications: uniqueAll });
  };

  const visibleCatalog = CERT_LIBRARY.filter((c) => c.label.toLowerCase().includes(certFilter.trim().toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>{item ? "Edit worker" : "New worker"}</h2>
        <label style={ss.lbl}>Name</label>
        <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Role</label>
        <input style={ss.inp} value={form.role} onChange={(e) => set("role", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Phone</label>
        <input style={ss.inp} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Email</label>
        <input style={ss.inp} value={form.email} onChange={(e) => set("email", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Primary certificate (for dashboard expiry)</label>
        <input style={ss.inp} value={form.certType || ""} onChange={(e) => set("certType", e.target.value)} placeholder="e.g. CSCS, IPAF" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Certificate expiry</label>
        <input type="date" style={ss.inp} value={form.certExpiry || ""} onChange={(e) => set("certExpiry", e.target.value)} />
        <div style={{ marginTop: 12, border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: "10px 10px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Ready-made certifications</strong>
            <input
              value={certFilter}
              onChange={(e) => setCertFilter(e.target.value)}
              placeholder="Filter certs..."
              style={{ ...ss.inp, width: "auto", minWidth: 160, fontSize: 12, padding: "6px 8px" }}
            />
          </div>
          <div style={{ maxHeight: 260, overflow: "auto", display: "grid", gap: 8 }}>
            {visibleCatalog.map((c) => {
              const row = form.certMatrix?.[c.code] || {};
              return (
                <div key={c.code} style={{ border: "1px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 8, padding: "8px 8px 6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={row.enabled === true} onChange={(e) => toggleCert(c.code, e.target.checked)} />
                    {c.label}
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: "auto" }}>
                      default {c.defaultValidityMonths}m
                    </span>
                  </label>
                  {row.enabled ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 6, marginTop: 6 }}>
                      <input
                        type="date"
                        style={{ ...ss.inp, margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={row.expiryDate || ""}
                        onChange={(e) => setCert(c.code, "expiryDate", e.target.value)}
                      />
                      <input
                        style={{ ...ss.inp, margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={row.certNumber || ""}
                        onChange={(e) => setCert(c.code, "certNumber", e.target.value)}
                        placeholder="Certificate no."
                      />
                      <input
                        style={{ ...ss.inp, margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={row.provider || ""}
                        onChange={(e) => setCert(c.code, "provider", e.target.value)}
                        placeholder="Provider"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Certificates / notes (free text)</label>
        <textarea style={{ ...ss.inp, minHeight: 72, resize: "vertical" }} value={form.certs} onChange={(e) => set("certs", e.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={persist}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function projectFormShape(p) {
  if (!p) {
    return { id: genId(), name: "", site: "", address: "", lat: "", lng: "" };
  }
  return {
    ...p,
    lat: p.lat != null && p.lat !== "" ? String(p.lat) : "",
    lng: p.lng != null && p.lng !== "" ? String(p.lng) : "",
  };
}

function ProjectForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => projectFormShape(item));
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    setForm(projectFormShape(item));
  }, [item?.id]);

  const persist = () => {
    const latRaw = String(form.lat ?? "").trim();
    const lngRaw = String(form.lng ?? "").trim();
    const lat = latRaw === "" ? undefined : Number(latRaw);
    const lng = lngRaw === "" ? undefined : Number(lngRaw);
    onSave({
      ...form,
      lat: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
      lng: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
    });
  };

  const geocode = async () => {
    const q = (form.address || form.site || "").trim();
    if (!q) {
      setGeoMsg("Enter address or site first.");
      return;
    }
    setGeoBusy(true);
    setGeoMsg("");
    try {
      const c = await geocodeAddressNominatim(q);
      if (!c) {
        setGeoMsg("No coordinates found — try a fuller address.");
        return;
      }
      setForm((f) => ({ ...f, lat: String(c.lat), lng: String(c.lng) }));
    } catch (e) {
      setGeoMsg(e?.message || "Geocoding failed.");
    } finally {
      setGeoBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>{item ? "Edit project" : "New project"}</h2>
        <label style={ss.lbl}>Project name</label>
        <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Site / client</label>
        <input style={ss.inp} value={form.site} onChange={(e) => set("site", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Address</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.address} onChange={(e) => set("address", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Latitude (optional)</label>
            <input style={ss.inp} inputMode="decimal" value={form.lat ?? ""} onChange={(e) => set("lat", e.target.value)} placeholder="e.g. 51.5" />
          </div>
          <div>
            <label style={ss.lbl}>Longitude (optional)</label>
            <input style={ss.inp} inputMode="decimal" value={form.lng ?? ""} onChange={(e) => set("lng", e.target.value)} placeholder="e.g. -0.12" />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" style={ss.btn} disabled={geoBusy} onClick={geocode}>
            {geoBusy ? "Looking up…" : "Fill lat/lng from address"}
          </button>
          {geoMsg && <span style={{ marginLeft: 10, fontSize: 12, color: "#b45309" }}>{geoMsg}</span>}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 10, lineHeight: 1.45 }}>
          Coordinates power the <strong>Site map</strong> module. You can paste OS grid converted to decimal degrees or use the button (OpenStreetMap Nominatim).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={persist}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
