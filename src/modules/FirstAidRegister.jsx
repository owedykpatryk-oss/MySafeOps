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
import RegisterFormPrintButton from "../components/RegisterFormPrintButton";
import RegisterListPagingFooter from "../components/RegisterListPagingFooter";
import { buildRegisterModuleStats } from "../utils/registerModuleStatsBuilder";
import { D1ModuleSyncBanner } from "../components/D1ModuleSyncBanner";
import { exportCsv } from "../utils/exportCsv";
import { validateRequiredFields } from "../utils/registerPersistGuard";

import { todayLocalISO } from "../utils/localDate";
const genId = () => `fa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const today = todayLocalISO;

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
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 500 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{item ? "Edit first aider" : "First aider / kit"}</h2>
        <label style={ss.lbl} htmlFor="first-aid-name">Name</label>
        <input style={ss.inp} value={form.name} onChange={(e) => set("name", e.target.value)}  id="first-aid-name" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="first-aid-qualification">Qualification</label>
        <input style={ss.inp} value={form.qualification} onChange={(e) => set("qualification", e.target.value)}  id="first-aid-qualification" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="first-aid-cert-expiry">Certificate expiry</label>
        <input type="date" style={ss.inp} value={form.certExpiry || ""} onChange={(e) => set("certExpiry", e.target.value)}  id="first-aid-cert-expiry" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="first-aid-phone">Contact</label>
        <input style={ss.inp} inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}  id="first-aid-phone" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="first-aid-kit-location">First aid kit location (if this row is for a kit)</label>
        <input style={ss.inp} value={form.kitLocation} onChange={(e) => set("kitLocation", e.target.value)} placeholder="Leave blank if person only"  id="first-aid-kit-location" />
        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="first-aid-notes">Notes</label>
        <textarea style={{ ...ss.inp, minHeight: 48, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)}  id="first-aid-notes" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={ss.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={ss.btnP} onClick={() => {
            const check = validateRequiredFields(form, ["name"], { name: "Name" });
            if (!check.ok) { window.alert(check.message); return; }
            onSave(form);
          }}>
            Save
          </button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

export default function FirstAidRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load("first_aid_register", []));
  const [modal, setModal] = useState(null);
  const listPg = useRegisterListPaging(50);
  const { d1Hydrating, d1OutboxPending } = useD1OrgArraySync({
    storageKey: "first_aid_register",
    namespace: "first_aid_register",
    value: items,
    setValue: setItems,
    load,
    save,
  });

  const liveItems = liveOrgArrayRows(items);

  const handleExportCsv = () => {
    const h = ["Name", "Qualification", "Cert expiry", "Phone", "Kit location", "Notes"];
    const rows = liveItems.map((r) => [r.name, r.qualification, r.certExpiry, r.phone, r.kitLocation, r.notes]);
    exportCsv(h, rows, `first_aid_${today()}.csv`);
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
            <PageHero exportModuleId="first-aid"
        badgeText="FA"
        title="First aid"
        lead="Trained personnel and kit locations (HSE-style site cover)."
        right={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {liveItems.length > 0 && (
            <button type="button" style={ss.btn} onClick={handleExportCsv}>
              Export CSV
            </button>
          )}
          <button type="button" style={ss.btnP} onClick={() => setModal({ type: "form" })}>
            + Add
          </button>
        </div>}
      />

      <D1ModuleSyncBanner hydrating={d1Hydrating} outboxPending={d1OutboxPending} />

      <RegisterModuleShell
        moduleId="first-aid"
        smartContext={{ items: liveItems }}
        stats={buildRegisterModuleStats("first-aid", liveItems)}
      >

{liveItems.length === 0 ? (
        <EmptyState
          icon="🩹"
          title="No first aiders listed yet"
          description="Record trained first aiders and kit locations for site cover."
          actionLabel="+ Add"
          onAction={() => setModal({ type: "form" })}
          variant="dashed"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listPg.visible(liveItems).map((r) => (
            <div key={r.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{r.name || "Unnamed"}</strong> · {r.qualification}
                  {r.certExpiry && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Cert expires {r.certExpiry}</div>}
                  {r.phone && <div style={{ fontSize: 12 }}>{r.phone}</div>}
                  {r.kitLocation && <div style={{ fontSize: 12, marginTop: 4 }}>Kit: {r.kitLocation}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <RegisterFormPrintButton moduleId="first-aid" record={r} />
                  <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                    Edit
                  </button>
                  {caps.deleteRecords && (
                    <button
                      type="button"
                      style={{ ...ss.btn, color: "#A32D2D" }}
                      onClick={() => {
                        if (
                          softDeleteToRecycleBin({
                            moduleId: "first-aid",
                            moduleLabel: "First aid register",
                            itemType: "first_aider",
                            itemLabel: r.name || r.qualification || r.id,
                            sourceKey: "first_aid_register",
                            payload: r,
                          })
                        ) {
                          setItems((p) => replaceWithTombstone(p, r.id));
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

      </RegisterModuleShell>    </div>
  );
}
