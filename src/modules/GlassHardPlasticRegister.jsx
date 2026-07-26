import { useState } from "react";
import ModuleOverlay from "../components/ModuleOverlay";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

import { todayLocalISO } from "../utils/localDate";
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
        dateIn: todayLocalISO(),
        dateOut: "",
        breakageReported: false,
        breakageNotes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit G&HP entry" : "Glass & hard plastic register entry"}</h2>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Food factory requirement — log brittle items brought into production/high-care areas.</p>
        <label style={ss.lbl} htmlFor="glass-hard-plastic-item-description">Item description</label>
        <input style={ss.inp} value={form.itemDescription} onChange={(e) => set("itemDescription", e.target.value)} placeholder="e.g. Torx driver, glass thermometer"  id="glass-hard-plastic-item-description" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="glass-hard-plastic-zone">Zone / area</label>
        <input style={ss.inp} value={form.zone} onChange={(e) => set("zone", e.target.value)} placeholder="High-care / production line 2"  id="glass-hard-plastic-zone" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="glass-hard-plastic-brought-by">Brought on site by</label>
        <input style={ss.inp} value={form.broughtBy} onChange={(e) => set("broughtBy", e.target.value)}  id="glass-hard-plastic-brought-by" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="glass-hard-plastic-date-in">Date in</label>
        <input type="date" style={ss.inp} value={form.dateIn} onChange={(e) => set("dateIn", e.target.value)}  id="glass-hard-plastic-date-in" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="glass-hard-plastic-date-out">Date out (optional)</label>
        <input type="date" style={ss.inp} value={form.dateOut} onChange={(e) => set("dateOut", e.target.value)}  id="glass-hard-plastic-date-out" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={!!form.breakageReported} onChange={(e) => set("breakageReported", e.target.checked)} />
          Breakage reported
        </label>
        {form.breakageReported ? (
          <>
            <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="glass-hard-plastic-breakage-notes">Breakage / quarantine notes</label>
            <textarea style={{ ...ss.inp, minHeight: 60 }} value={form.breakageNotes} onChange={(e) => set("breakageNotes", e.target.value)}  id="glass-hard-plastic-breakage-notes" />
          </>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Cancel</button>
          <button type="button" style={ss.btnP} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </ModuleOverlay>
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

  const persist = (next) => {
    setItems(next);
    save(KEY, next);
  };

  const liveItems = liveOrgArrayRows(items);

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
      <RegisterModuleShell moduleId="ghp-register" smartContext={{ items: liveItems }} stats={buildRegisterModuleStats("ghp-register", liveItems)}>
        {liveItems.length === 0 ? (
          <EmptyState
            icon="🫙"
            title="No G&HP items logged yet"
            description="Log brittle items brought into production and high-care zones for food safety / BRC."
            actionLabel="+ Add entry"
            onAction={() => setModal({ type: "form" })}
            variant="dashed"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listPg.visible(liveItems).map((item) => (
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
                            persist(replaceWithTombstone(items, item.id));
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
            <RegisterListPagingFooter
              hasMore={listPg.hasMore(liveItems)}
              remaining={listPg.remaining(liveItems)}
              showing={Math.min(listPg.cap, liveItems.length)}
              total={liveItems.length}
              onShowMore={listPg.showMore}
              buttonStyle={ss.btn}
            />
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
