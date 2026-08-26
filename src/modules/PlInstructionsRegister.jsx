import { useMemo, useState } from "react";
import ModuleOverlay from "../components/ModuleOverlay";
import { useApp } from "../context/AppContext";
import { pushAudit } from "../utils/auditLog";
import { ms } from "../utils/moduleStyles";
import { loadOrgScoped as load, saveOrgScoped as save } from "../utils/orgStorage";
import { softDeleteToRecycleBin } from "../utils/recycleBin";
import { liveOrgArrayRows, replaceWithTombstone } from "../utils/d1ArrayMerge";
import PageHero from "../components/PageHero";
import EmptyState from "../components/EmptyState";
import RegisterModuleShell from "../components/RegisterModuleShell";
import { exportCsv } from "../utils/exportCsv";
import { getOrgSettings } from "../utils/orgSettingsStorage";
import { validateRequiredFields } from "../utils/registerPersistGuard";
import { todayLocalISO } from "../utils/localDate";
import {
  findPlInstrukcja,
  instrukcjaAcknowledgementSummary,
  listPlInstrukcjaGroups,
  PL_INSTRUKCJE,
} from "../utils/plInstrukcjeLibrary";
import { printInstrukcja } from "../utils/plInstrukcjePrintHtml";

const STORAGE_KEY = "pl_instrukcje";
const ss = ms;
const genId = () => `instr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/** Kolejny numer instrukcji w roku — jedna seria dla całego rejestru. */
function nextRef(existing, isoDate = todayLocalISO()) {
  const year = isoDate.slice(0, 4);
  const pattern = new RegExp(`^IS/${year}/(\\d+)$`);
  let max = 0;
  for (const row of existing || []) {
    const m = pattern.exec(String(row?.ref || "").trim());
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return `IS/${year}/${String(max + 1).padStart(2, "0")}`;
}

/** Snapshot biblioteki — wydana instrukcja nie zmienia się przy aktualizacji biblioteki. */
function instrukcjaFromLibrary(key, existing) {
  const src = findPlInstrukcja(key);
  if (!src) return null;
  return {
    id: genId(),
    libraryKey: src.key,
    tytul: src.tytul,
    grupa: src.grupa,
    opis: src.opis,
    uprawnienia: [...src.uprawnienia],
    soi: [...src.soi],
    uwagiOgolne: [...src.uwagiOgolne],
    przedPraca: [...src.przedPraca],
    wTrakcie: [...src.wTrakcie],
    poPracy: [...src.poPracy],
    zabronione: [...src.zabronione],
    awaria: [...src.awaria],
    podstawa: [...src.podstawa],
    pytania: [...(src.pytania || [])],
    ref: nextRef(existing),
    komorka: "",
    dataWydania: todayLocalISO(),
    zatwierdzil: "",
    uwagi: "",
    zapoznani: [],
    createdAt: new Date().toISOString(),
  };
}

function LibraryPicker({ onPick, onClose }) {
  const [grupa, setGrupa] = useState("");
  const grupy = listPlInstrukcjaGroups();
  const visible = grupa ? PL_INSTRUKCJE.filter((i) => i.grupa === grupa) : PL_INSTRUKCJE;

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 620 }}>
        <h3 style={ss.h3}>Dodaj instrukcję z biblioteki</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>
          Instrukcja trafia do rejestru jako kopia — możesz ją dostosować do swojego sprzętu i zakładu.
        </p>
        <label style={ss.lbl} htmlFor="instr-grupa">Grupa</label>
        <select id="instr-grupa" style={ss.inp} value={grupa} onChange={(e) => setGrupa(e.target.value)}>
          <option value="">Wszystkie grupy</option>
          {grupy.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, maxHeight: 340, overflowY: "auto" }}>
          {visible.map((i) => (
            <button
              key={i.key}
              type="button"
              style={{ ...ss.card, padding: 10, textAlign: "left", cursor: "pointer" }}
              onClick={() => onPick(i.key)}
            >
              <strong style={{ fontSize: 13 }}>{i.tytul}</strong>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{i.opis}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 4 }}>
                {i.zabronione.length} czynności zabronionych · {i.soi.length} ŚOI
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Zamknij</button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

function InstructionForm({ item, workers, onSave, onClose }) {
  const [form, setForm] = useState(item);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const ack = instrukcjaAcknowledgementSummary(form);

  const addWorker = (workerId) => {
    const w = workers.find((x) => x.id === workerId);
    if (!w) return;
    const name = String(w.name || "").trim();
    if (!name) return;
    setForm((p) => {
      if ((p.zapoznani || []).some((r) => r.imieNazwisko === name)) return p;
      return {
        ...p,
        zapoznani: [...(p.zapoznani || []), { imieNazwisko: name, stanowisko: String(w.role || "").trim(), data: "" }],
      };
    });
  };

  const markSigned = (index, date) => {
    setForm((p) => ({
      ...p,
      zapoznani: (p.zapoznani || []).map((r, i) => (i === index ? { ...r, data: date } : r)),
    }));
  };

  const removeWorker = (index) => {
    setForm((p) => ({ ...p, zapoznani: (p.zapoznani || []).filter((_, i) => i !== index) }));
  };

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 760 }}>
        <h3 style={ss.h3}>{form.tytul}</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>{form.opis}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={ss.lbl} htmlFor="instr-ref">Numer instrukcji</label>
            <input id="instr-ref" style={ss.inp} value={form.ref} onChange={(e) => set("ref", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="instr-data">Data wydania</label>
            <input id="instr-data" type="date" style={ss.inp} value={form.dataWydania} onChange={(e) => set("dataWydania", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="instr-komorka">Komórka / budowa</label>
            <input id="instr-komorka" style={ss.inp} value={form.komorka} onChange={(e) => set("komorka", e.target.value)} />
          </div>
        </div>

        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="instr-zatwierdzil">Zatwierdził</label>
        <input id="instr-zatwierdzil" style={ss.inp} value={form.zatwierdzil} onChange={(e) => set("zatwierdzil", e.target.value)} />

        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="instr-uwagi">Uwagi zakładowe</label>
        <textarea
          id="instr-uwagi"
          style={{ ...ss.inp, minHeight: 56 }}
          value={form.uwagi}
          onChange={(e) => set("uwagi", e.target.value)}
          placeholder="Odstępstwa, numer maszyny, dodatkowe zasady obowiązujące w tym zakładzie…"
        />

        <div style={{ ...ss.card, padding: 10, marginTop: 12 }}>
          <strong style={{ fontSize: 12 }}>Zapoznanie pracowników</strong>
          <div style={{ ...ss.hint, marginTop: 2 }}>
            {ack.total === 0
              ? "Dodaj pracowników, którym instrukcja została przekazana."
              : `${ack.signed} z ${ack.total} potwierdziło zapoznanie.`}
          </div>
          {workers.length > 0 && (
            <select
              style={{ ...ss.inp, marginTop: 8 }}
              value=""
              onChange={(e) => addWorker(e.target.value)}
              aria-label="Dodaj pracownika do listy zapoznania"
            >
              <option value="">— dodaj pracownika —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || "bez nazwiska"}{w.role ? ` · ${w.role}` : ""}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {(form.zapoznani || []).map((r, i) => (
              <div key={`${r.imieNazwisko}-${i}`} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, flex: 1, minWidth: 140 }}>
                  {r.imieNazwisko}
                  {r.stanowisko ? ` · ${r.stanowisko}` : ""}
                </span>
                <input
                  type="date"
                  style={{ ...ss.inp, width: 150 }}
                  value={r.data || ""}
                  onChange={(e) => markSigned(i, e.target.value)}
                  aria-label={`Data zapoznania — ${r.imieNazwisko}`}
                />
                <button type="button" style={ss.btn} onClick={() => removeWorker(i)}>Usuń</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Anuluj</button>
          <button
            type="button"
            style={ss.btnP}
            onClick={() => {
              const check = validateRequiredFields(form, ["dataWydania"], { dataWydania: "Data wydania" });
              if (!check.ok) {
                window.alert(check.message);
                return;
              }
              onSave(form);
            }}
          >
            Zapisz
          </button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

export default function PlInstructionsRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(STORAGE_KEY, []));
  const [modal, setModal] = useState(null);
  const liveItems = useMemo(() => liveOrgArrayRows(items), [items]);
  const orgName = getOrgSettings()?.orgName || "";
  const workers = useMemo(() => liveOrgArrayRows(load("mysafeops_workers", [])), []);

  const persist = (next) => {
    setItems(next);
    save(STORAGE_KEY, next);
  };

  const addFromLibrary = (key) => {
    const rec = instrukcjaFromLibrary(key, items);
    if (!rec) return;
    persist([rec, ...items]);
    pushAudit({ action: "pl_instrukcja_add", entity: "pl-instrukcje", detail: rec.tytul });
    setModal({ type: "form", data: rec });
  };

  const saveInstruction = (rec) => {
    persist(items.map((i) => (i.id === rec.id ? rec : i)));
    pushAudit({ action: "pl_instrukcja_update", entity: "pl-instrukcje", detail: rec.tytul });
    setModal(null);
  };

  const handleExportCsv = () => {
    const rows = liveItems.map((r) => {
      const ack = instrukcjaAcknowledgementSummary(r);
      return [r.ref || "", r.tytul, r.grupa || "", r.komorka || "", r.dataWydania || "", `${ack.signed}/${ack.total}`];
    });
    exportCsv(
      ["Numer", "Instrukcja", "Grupa", "Komórka", "Data wydania", "Zapoznanie"],
      rows,
      `instrukcje_stanowiskowe_${todayLocalISO()}.csv`
    );
  };

  const zalegle = liveItems.filter((r) => instrukcjaAcknowledgementSummary(r).pending > 0).length;

  return (
    <>
      <PageHero
        badgeText="IS"
        title="Instrukcje stanowiskowe BHP"
        lead="Gotowe instrukcje dla maszyn i rodzajów prac — z czynnościami zabronionymi, postępowaniem awaryjnym i listą zapoznania do podpisu."
        exportModuleId="pl-instrukcje"
        exportModuleLabel="Rejestr instrukcji stanowiskowych"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {liveItems.length > 0 && (
              <button type="button" style={ss.btn} onClick={handleExportCsv}>Eksport CSV</button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "library" })}>
              + Dodaj instrukcję
            </button>
          </div>
        }
      />
      <RegisterModuleShell moduleId="pl-instrukcje" smartContext={{ items: liveItems }}>
        {liveItems.length === 0 ? (
          <EmptyState
            title="Brak instrukcji"
            description="Dodaj instrukcję z biblioteki — szlifierka, rusztowanie, wózek widłowy, prace na wysokości i inne."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {zalegle > 0 && (
              <div style={ss.hint}>{zalegle} instrukcja(-e) czeka na potwierdzenie zapoznania przez pracowników.</div>
            )}
            {liveItems.map((r) => {
              const ack = instrukcjaAcknowledgementSummary(r);
              return (
                <div key={r.id} style={{ ...ss.card, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{r.tytul}</strong>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {[r.ref, r.grupa, r.komorka, r.dataWydania].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: ack.total === 0 ? "var(--color-text-secondary)" : ack.complete ? "#15803d" : "#b45309",
                      }}
                    >
                      {ack.total === 0 ? "Bez przypisania" : `Zapoznanie ${ack.signed}/${ack.total}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                      Edytuj
                    </button>
                    <button type="button" style={ss.btn} onClick={() => printInstrukcja(r, { orgName })}>
                      Drukuj
                    </button>
                    {caps?.canDelete !== false && (
                      <button
                        type="button"
                        style={ss.btn}
                        onClick={() => {
                          if (!window.confirm("Usunąć instrukcję?")) return;
                          softDeleteToRecycleBin({
                            moduleId: "pl-instrukcje",
                            moduleLabel: "Instrukcje stanowiskowe",
                            itemId: r.id,
                            itemLabel: r.tytul,
                            payload: r,
                          });
                          persist(replaceWithTombstone(items, r.id));
                          pushAudit({ action: "pl_instrukcja_delete", entity: "pl-instrukcje", detail: r.tytul });
                        }}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </RegisterModuleShell>

      {modal?.type === "library" && <LibraryPicker onPick={addFromLibrary} onClose={() => setModal(null)} />}
      {modal?.type === "form" && (
        <InstructionForm item={modal.data} workers={workers} onSave={saveInstruction} onClose={() => setModal(null)} />
      )}
    </>
  );
}
