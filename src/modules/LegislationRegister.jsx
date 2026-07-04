import { useState, useMemo } from "react";
import { useD1OrgArraySync } from "../hooks/useD1OrgArraySync";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { UK_LEGISLATION_LIBRARY, seedLegislationRegister } from "../utils/ukLegislationLibrary";
import PageHero from "../components/PageHero";
import RegisterModuleShell from "../components/RegisterModuleShell";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";

const KEY = "legislation_register";
const genId = () => `leg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const ss = ms;

function Form({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    () =>
      item || {
        id: genId(),
        refId: "",
        shortName: "",
        fullName: "",
        sectors: [],
        summary: "",
        url: "",
        applicable: true,
        lastReviewed: "",
        nextReview: "",
        notes: "",
        createdAt: new Date().toISOString(),
      }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", position: "fixed", inset: 0, zIndex: 50, overflow: "auto" }}>
      <div style={{ ...ss.card, width: "100%", maxWidth: 560, marginTop: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit legislation entry" : "Add legislation"}</h2>
        <label style={ss.lbl}>Short name</label>
        <input style={ss.inp} value={form.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder="e.g. LOLER 1998" />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Full title</label>
        <input style={ss.inp} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Summary / relevance to your work</label>
        <textarea style={{ ...ss.inp, minHeight: 50 }} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Legislation URL</label>
        <input style={ss.inp} value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.legislation.gov.uk/..." />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={!!form.applicable} onChange={(e) => set("applicable", e.target.checked)} />
          Applicable to our organisation
        </label>
        <label style={{ ...ss.lbl, marginTop: 10 }}>Last reviewed</label>
        <input type="date" style={ss.inp} value={form.lastReviewed} onChange={(e) => set("lastReviewed", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Next review</label>
        <input type="date" style={ss.inp} value={form.nextReview} onChange={(e) => set("nextReview", e.target.value)} />
        <label style={{ ...ss.lbl, marginTop: 10 }}>Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 40 }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Cancel</button>
          <button type="button" style={ss.btnP} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function LegislationRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(KEY, []));
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("all");
  const listPg = useRegisterListPaging();
  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: KEY,
    namespace: KEY,
    value: items,
    setValue: setItems,
    load,
    save,
  });

  const filtered = useMemo(() => {
    if (filter === "applicable") return items.filter((i) => i.applicable);
    if (filter === "review") {
      const now = new Date();
      return items.filter((i) => i.nextReview && new Date(i.nextReview) <= now);
    }
    return items;
  }, [items, filter]);

  const persist = (next) => {
    setItems(next);
    save(KEY, next);
  };

  const seedLibrary = () => {
    const existingRefs = new Set(items.map((i) => i.refId || i.shortName));
    const toAdd = seedLegislationRegister().filter((s) => !existingRefs.has(s.refId));
    if (!toAdd.length) {
      window.alert("UK legislation library already loaded.");
      return;
    }
    persist([...items, ...toAdd]);
    pushAudit({ action: "seed", entityType: "legislation_register", entityId: "uk_library" });
  };

  return (
    <div>
      <PageHero
        title="Legislation register"
        lead="UK HSE and food safety law applicability — link to RAMS regs column and compliance reviews."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={ss.btn} onClick={seedLibrary}>Load UK library</button>
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>+ Add entry</button>
          </div>
        }
      />
      <D1ModuleSyncBanner hydrating={d1Hydrating} outboxPending={d1OutboxPending} />
      <RegisterModuleShell
        moduleId="legislation"
        smartContext={{ items }}
        stats={buildRegisterModuleStats("legislation", items)}
        filters={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["all", "All"], ["applicable", "Applicable"], ["review", "Review due"]].map(([k, lbl]) => (
              <button key={k} type="button" style={{ ...ss.btn, ...(filter === k ? ss.btnP : {}) }} onClick={() => setFilter(k)}>{lbl}</button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div style={{ ...ss.card, textAlign: "center", color: "var(--color-text-secondary)", padding: 24 }}>
            No legislation entries. Click <strong>Load UK library</strong> to seed {UK_LEGISLATION_LIBRARY.length} common UK refs.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listPg.visible(filtered).map((item) => (
              <div key={item.id} style={{ ...ss.card, padding: 12, opacity: item.applicable ? 1 : 0.65 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.shortName || item.fullName}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{item.summary || item.fullName}</div>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, marginTop: 4, display: "inline-block" }}>View on legislation.gov.uk</a>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    {item.applicable ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#EAF3DE", color: "#27500A" }}>Applicable</span> : null}
                    {item.nextReview && new Date(item.nextReview) <= new Date() ? (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#FAEEDA", color: "#633806" }}>Review due</span>
                    ) : null}
                  </div>
                </div>
                {caps.canEditRegisters !== false ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" style={{ ...ss.btn, fontSize: 12 }} onClick={() => setModal({ type: "form", data: item })}>Edit</button>
                    {caps.deleteRecords ? (
                      <button
                        type="button"
                        style={{ ...ss.btn, fontSize: 12, color: "#791F1F" }}
                        onClick={() => {
                          if (softDeleteToRecycleBin({ moduleId: "legislation", moduleLabel: "Legislation", itemType: "leg_entry", itemLabel: item.shortName, sourceKey: KEY, payload: item })) {
                            persist(items.filter((x) => x.id !== item.id));
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
            {listPg.hasMore(filtered) ? <button type="button" style={ss.btn} onClick={listPg.showMore}>Show more</button> : null}
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
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
