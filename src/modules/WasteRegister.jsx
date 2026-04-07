import { useState, useEffect } from "react";

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const sk = (k) => `${k}_${getOrgId()}`;
const load = (k, fb) => {
  try {
    return JSON.parse(localStorage.getItem(sk(k)) || JSON.stringify(fb));
  } catch {
    return fb;
  }
};
const save = (k, v) => localStorage.setItem(sk(k), JSON.stringify(v));
const genId = () => `waste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = {
  btn: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary,#ccc)", background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  btnP: { padding: "7px 14px", borderRadius: 6, border: "0.5px solid #085041", background: "#0d9488", color: "#E1F5EE", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6 },
  inp: { width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 6, fontSize: 13, fontFamily: "DM Sans,sans-serif", boxSizing: "border-box" },
  lbl: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 },
  card: { background: "var(--color-background-primary,#fff)", border: "0.5px solid var(--color-border-tertiary,#e5e5e5)", borderRadius: 12, padding: "1.25rem" },
};

const WASTE_CODES = ["Non-hazardous", "Inert", "Hazardous — EWC code required", "Construction & demolition", "Packaging waste"];

function WasteForm({ item, projects, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        wtnRef: "",
        projectId: "",
        carrierName: "",
        carrierReg: "",
        receiverSite: "",
        ewcCode: "",
        description: "",
        quantity: "",
        unit: "tonnes",
        dutySigned: false,
        transferDate: today(),
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pm = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>{item ? "Edit waste transfer" : "New waste transfer note"}</h2>
        <label style={ss.lbl}>WTN / reference</label>
        <input style={ss.inp} value={form.wtnRef} onChange={(e) => set("wtnRef", e.target.value)} placeholder="e.g. WTN-2026-0042" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Project</label>
        <select style={ss.inp} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Waste description</label>
        <textarea style={{ ...ss.inp, minHeight: 64, resize: "vertical" }} value={form.description} onChange={(e) => set("description", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>EWC / List of Waste code</label>
        <input style={ss.inp} value={form.ewcCode} onChange={(e) => set("ewcCode", e.target.value)} placeholder="e.g. 17 09 04" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Waste category</label>
        <select style={ss.inp} value={form.wasteCategory || ""} onChange={(e) => set("wasteCategory", e.target.value)}>
          <option value="">—</option>
          {WASTE_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <label style={ss.lbl}>Quantity</label>
            <input style={ss.inp} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl}>Unit</label>
            <select style={ss.inp} value={form.unit} onChange={(e) => set("unit", e.target.value)}>
              <option value="tonnes">tonnes</option>
              <option value="m3">m³</option>
              <option value="loads">loads</option>
            </select>
          </div>
        </div>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Carrier name</label>
        <input style={ss.inp} value={form.carrierName} onChange={(e) => set("carrierName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Carrier registration (if applicable)</label>
        <input style={ss.inp} value={form.carrierReg} onChange={(e) => set("carrierReg", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Receiver / disposal site</label>
        <input style={ss.inp} value={form.receiverSite} onChange={(e) => set("receiverSite", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Transfer date</label>
        <input type="date" style={ss.inp} value={form.transferDate} onChange={(e) => set("transferDate", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13 }}>
          <input type="checkbox" checked={form.dutySigned} onChange={(e) => set("dutySigned", e.target.checked)} />
          Duty of care checklist completed (descriptions accurate, secure transport, valid carriers)
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave({ ...form, projectName: pm[form.projectId] || "" })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WasteRegister() {
  const [items, setItems] = useState(() => load("waste_register", []));
  const [projects] = useState(() => load("mysafeops_projects", []));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    save("waste_register", items);
  }, [items]);

  const exportCsv = () => {
    const header = ["WTN ref", "Date", "Project", "Description", "EWC", "Qty", "Unit", "Carrier", "Receiver", "Duty signed"];
    const rows = items.map((w) => [
      w.wtnRef,
      w.transferDate,
      w.projectName || "",
      w.description,
      w.ewcCode,
      w.quantity,
      w.unit,
      w.carrierName,
      w.receiverSite,
      w.dutySigned ? "yes" : "no",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `waste_register_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && (
        <WasteForm
          item={modal.data}
          projects={projects}
          onSave={(f) => {
            setItems((p) => {
              const i = p.findIndex((x) => x.id === f.id);
              if (i >= 0) {
                const n = [...p];
                n[i] = f;
                return n;
              }
              return [f, ...p];
            });
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Waste register</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            Waste transfer notes, duty of care, EWC codes — UK Environment Agency expectations (local record only)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add transfer
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No waste transfers recorded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((w) => (
            <div key={w.id} style={ss.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>{w.wtnRef || "No ref"}</strong> · {w.transferDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{w.description?.slice(0, 120) || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: w })}>
                    Edit
                  </button>
                  <button
                    type="button"
                    style={{ ...ss.btn, color: "#A32D2D" }}
                    onClick={() => {
                      if (confirm("Delete this record?")) setItems((p) => p.filter((x) => x.id !== w.id));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
