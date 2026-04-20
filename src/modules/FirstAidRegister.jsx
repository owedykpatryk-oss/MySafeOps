import { useEffect, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import PageHero from "../components/PageHero";

const genId = () => `fa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);

const ss = ms;

function Form({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        name: "",
        qualification: "FAW / EFAW",
        certExpiry: "",
        phone: "",
        kitLocation: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 500, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit first aider" : "First aider / kit"}</h2>
        <label style={ss.lbl}>Name</label>
        <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Qualification</label>
        <input style={ss.inp} value={form.qualification} onChange={(e) => set("qualification", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Certificate expiry</label>
        <input type="date" style={ss.inp} value={form.certExpiry || ""} onChange={(e) => set("certExpiry", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Contact</label>
        <input style={ss.inp} inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>First aid kit location (if this row is for a kit)</label>
        <input style={ss.inp} value={form.kitLocation} onChange={(e) => set("kitLocation", e.target.value)} placeholder="Leave blank if person only" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
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

export default function FirstAidRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("first_aid_register", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);

  useEffect(() => {
    save("first_aid_register", items);
  }, [items]);

  const exportCsv = () => {
    const h = ["Name", "Qualification", "Cert expiry", "Phone", "Kit location", "Notes"];
    const rows = items.map((r) => [r.name, r.qualification, r.certExpiry, r.phone, r.kitLocation, r.notes]);
    const csv = [h, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `first_aid_${today()}.csv`;
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
    pushAudit({ action: isNew ? "first_aid_create" : "first_aid_update", entity: "first_aid", detail: f.id });
    setModal(null);
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14 }}>
      {modal?.type === "form" && <Form item={modal.data} onSave={(f) => persist(f, !modal.data)} onClose={() => setModal(null)} />}
            <PageHero
        badgeText="FA"
        title="First aid"
        lead="Trained personnel and kit locations (HSE-style site cover)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.length > 0 && (
            <button type="button" style={ss.btn} onClick={exportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add
          </button>
        </div>}
      />
{items.length === 0 ? (
        <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No first aiders or kit locations listed.</div>
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
                  <strong>{r.name || "Unnamed"}</strong> · {r.qualification}
                  {r.certExpiry && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Cert expires {r.certExpiry}</div>}
                  {r.phone && <div style={{ fontSize: 12 }}>{r.phone}</div>}
                  {r.kitLocation && <div style={{ fontSize: 12, marginTop: 4 }}>Kit: {r.kitLocation}</div>}
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
                          pushAudit({ action: "first_aid_delete", entity: "first_aid", detail: r.id });
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
