import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `ppe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

const PPE_ITEMS = ["Hard hat", "Safety boots", "Hi-vis", "Gloves", "Eye protection", "Hearing protection", "Harness / lanyard", "Respiratory", "Other"];

function Form({ item, workers, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        workerId: "",
        workerName: "",
        item: "Hard hat",
        issuedDate: today(),
        conditionOk: true,
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const wm = Object.fromEntries(workers.map((w) => [w.id, w.name]));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit PPE record" : "Issue / check PPE"}</h2>
        <label style={ss.lbl}>Worker</label>
        <select style={ss.inp} value={form.workerId} onChange={(e) => set("workerId", e.target.value)}>
          <option value="">—</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>PPE item</label>
        <select style={ss.inp} value={form.item} onChange={(e) => set("item", e.target.value)}>
          {PPE_ITEMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date</label>
        <input type="date" style={ss.inp} value={form.issuedDate} onChange={(e) => set("issuedDate", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={form.conditionOk} onChange={(e) => set("conditionOk", e.target.checked)} />
          Condition acceptable / fit for use
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => onSave({ ...form, workerName: wm[form.workerId] || form.workerName || "" })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PPERegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("ppe_register", []));
  const [workers] = useState(() => load("mysafeops_workers", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("ppe_register", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Date", "Worker", "Item", "OK", "Notes"];
    const rows = items.map((r) => [r.issuedDate, r.workerName, r.item, r.conditionOk ? "yes" : "no", r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `ppe_register_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const persist = (f, isNew) => {
    setItems((p) => {
      const i = p.findIndex((x) => x.id === f.id);
      if (i >= 0) {
        const n = [...p];
        n[i] = f;
        return n;
      }
      return [f, ...p];
    });
    pushAudit({ action: isNew ? "ppe_create" : "ppe_update", entity: "ppe", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} workers={workers} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="PPE"
        title="PPE register"
        lead="Issue checks and condition records (local only)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add record
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No PPE records yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.hasMore(items) ? (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Showing {Math.min(listPg.cap, items.length)} of {items.length} records
            </div>
          ) : null}
          {listPg.visible(items).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.item}</strong> · {r.issuedDate}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{r.workerName || "—"} · {r.conditionOk ? "OK" : "Issue noted"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Edit
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (confirm("Delete?")) {
                          setItems((p) => p.filter((x) => x.id !== r.id));
                          pushAudit({ action: "ppe_delete", entity: "ppe", detail: r.id });
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {listPg.hasMore(items) ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button type="button" style={ss.btn} onClick={listPg.showMore}>
                Show more ({listPg.remaining(items)} remaining)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
