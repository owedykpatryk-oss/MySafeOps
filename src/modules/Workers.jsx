import { useState, useEffect } from "react";

const WORKERS_KEY = "mysafeops_workers";
const PROJECTS_KEY = "mysafeops_projects";
const ORG_KEY = "mysafeops_orgId";

const getOrgId = () => localStorage.getItem(ORG_KEY) || "default";
const scopedKey = (k) => `${k}_${getOrgId()}`;

const load = (key) => {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(key)) || "[]");
  } catch {
    return [];
  }
};
const save = (key, data) => localStorage.setItem(scopedKey(key), JSON.stringify(data));

const genId = () => `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const ss = {
  btn: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  btnP: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#E1F5EE", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  btnO: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #c2410c", background: "#f97316", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  inp: { width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 6, fontSize: 13, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontFamily: "DM Sans,sans-serif", boxSizing: "border-box" },
  lbl: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

function toCsv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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
    const header = ["Name", "Role", "Phone", "Email", "Certs / notes"];
    const rows = workers.map((w) => [w.name || "", w.role || "", w.phone || "", w.email || "", w.certs || ""]);
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
    setWorkers((prev) => prev.filter((w) => w.id !== id));
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
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <h1 style={{ margin: 0, flex: "1 1 100%", fontSize: 20 }}>Workers & projects</h1>
        <button type="button" style={ss.btnP} onClick={() => setModal({ type: "worker", data: null })}>
          Add worker
        </button>
        <button type="button" style={ss.btnO} onClick={() => setModal({ type: "project", data: null })}>
          Add project
        </button>
        <button type="button" style={ss.btn} onClick={exportWorkersCsv}>
          Export workers CSV
        </button>
      </div>

      <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Data keys: <code style={{ fontSize: 12 }}>{scopedKey(WORKERS_KEY)}</code>, <code style={{ fontSize: 12 }}>{scopedKey(PROJECTS_KEY)}</code>
      </p>

      <div style={{ ...ss.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Workers ({workers.length})</div>
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
            <div style={{ flex: "1 1 200px" }}>
              <strong>{w.name || "Unnamed"}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{w.role || "—"} · {w.phone || w.email || ""}</div>
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

      <div style={ss.card}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Projects ({projects.length})</div>
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
            <div style={{ flex: "1 1 200px" }}>
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
      projectIds: [],
    };
  }
  const c0 = w.certifications?.[0];
  return {
    ...w,
    certType: c0?.certType || "",
    certExpiry: c0?.expiryDate || "",
  };
}

function WorkerForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => workerFormShape(item));
  useEffect(() => {
    setForm(workerFormShape(item));
  }, [item?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const persist = () => {
    const certs = [];
    if (form.certType?.trim() && form.certExpiry) {
      certs.push({ certType: form.certType.trim(), expiryDate: form.certExpiry });
    }
    const rest = (form.certifications || []).filter((c) => c?.certType && c?.expiryDate);
    const merged = [...rest, ...certs];
    const unique = merged.filter(
      (c, i, a) => a.findIndex((x) => x.certType === c.certType && x.expiryDate === c.expiryDate) === i
    );
    onSave({ ...form, certifications: unique });
  };

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
        <label style={{ ...ss.lbl, marginTop: 10 }}>Certificates / notes (free text)</label>
        <textarea style={{ ...ss.inp, minHeight: 72, resize: "vertical" }} value={form.certs} onChange={(e) => set("certs", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
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

function ProjectForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        name: "",
        site: "",
        address: "",
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
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
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave(form)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
