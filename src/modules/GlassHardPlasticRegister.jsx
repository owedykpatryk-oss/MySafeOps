import { useState } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import PageHero from "../components/PageHero";
import RegisterModuleShell from "../components/RegisterModuleShell";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const KEY = "ghp_register";
const genId = () => `ghp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function Form({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        zone: "",
        itemDescription: "",
        broughtBy: "",
        dateIn: new Date().toISOString().slice(0, 10),
        dateOut: "",
        breakageReported: false,
        breakageNotes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 520, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit G&HP entry" : "Glass & hard plastic register entry"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Food factory requirement — log brittle items brought into production/high-care areas.</p>
        <label style={ss.lbl}>Item description</label>
        <input style={ss.inp} value={form.itemDescription} onChange={(e) => set("itemDescription", e.target.value)} placeholder="e.g. Torx driver, glass thermometer" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Zone / area</label>
        <input style={ss.inp} value={form.zone} onChange={(e) => set("zone", e.target.value)} placeholder="High-care / production line 2" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Brought on site by</label>
        <input style={ss.inp} value={form.broughtBy} onChange={(e) => set("broughtBy", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date in</label>
        <input type="date" style={ss.inp} value={form.dateIn} onChange={(e) => set("dateIn", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Date out (optional)</label>
        <input type="date" style={ss.inp} value={form.dateOut} onChange={(e) => set("dateOut", e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={!!form.breakageReported} onChange={(e) => set("breakageReported", e.target.checked)} />
          Breakage reported
        </label>
        {form.breakageReported ? (
          <>
            <label style={{ ...ss.lbl, marginTop: 10 }}>Breakage / quarantine notes</label>
            <textarea style={{ ...ss.inp, minHeight: 60 }} value={form.breakageNotes} onChange={(e) => set("breakageNotes", e.target.value)} />
          </>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Cancel</button>
          <button type="button" style={ss.btnP} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function GlassHardPlasticRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(KEY, []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging();
  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: KEY,
    namespace: KEY,
    value: items,
    setValue: setItems,
    load,
    save,
  });

  const onSite = items.filter((i) => !i.dateOut);
  const breakage = items.filter((i) => i.breakageReported);

  const persist = (next) => {
    setItems(next);
    save(KEY, next);
  };

  return (
    <div>
      <PageHero
        title="Glass & hard plastic (G&HP)"
        lead="Register brittle items brought into food production and high-care zones — food safety / BRC requirement."
        right={
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add entry
          </button>
        }
      />
      <D1ModuleSyncBanner hydrating={d1Hydrating} outboxPending={d1OutboxPending} />
      <RegisterModuleShell moduleId="ghp-register" smartContext={{ items }} stats={buildRegisterModuleStats("ghp-register", items)}>
        {items.length === 0 ? (
          <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)" }}>No G&HP items logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listPg.visible(items).map((item) => (
              <div key={item.id} style={{ ...ss.card, padding: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.itemDescription || "Item"}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                  {item.zone || "—"} · {item.broughtBy || "—"} · In: {item.dateIn || "—"}
                  {item.breakageReported ? " · ⚠ Breakage reported" : ""}
                  {!item.dateOut ? " · On site" : ""}
                </div>
                {caps.canEditRegisters !== false ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => setModal({ type: "form", data: item })}>Edit</button>
                    {caps.deleteRecords ? (
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 12, color: "#791F1F" }}
                        onClick={() => {
                          if (
                            softDeleteToRecycleBin({
                              moduleId: "ghp-register",
                              moduleLabel: "Glass & hard plastic",
                              itemType: "ghp_entry",
                              itemLabel: item.itemDescription || item.id,
                              sourceKey: KEY,
                              payload: item,
                            })
                          ) {
                            persist(items.filter((x) => x.id !== item.id));
                            pushAudit({ action: "delete", entityType: "ghp_register", entityId: item.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {listPg.hasMore(items) ? (
              <button type="button" style={ss.btn} onClick={listPg.showMore}>Show more</button>
            ) : null}
          </div>
        )}
      </RegisterModuleShell>
      {modal?.type === "form" ? (
        <Form
          item={modal.data}
          onClose={() => setModal(null)}
          onSave={(row) => {
            const next = modal.data ? items.map((x) => (x.id === row.id ? row : x)) : [row, ...items];
            persist(next);
            pushAudit({ action: modal.data ? "update" : "create", entityType: "ghp_register", entityId: row.id });
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
