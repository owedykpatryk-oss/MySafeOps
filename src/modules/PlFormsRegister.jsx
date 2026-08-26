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
import { todayLocalISO } from "../utils/localDate";
import { findPlForm, listPlFormGroups, PL_FORMS, plFormMissingFields } from "../utils/plFormsLibrary";
import { printPlForm } from "../utils/plFormsPrintHtml";
import { exportPlFormPdf } from "../utils/plFormsPdf";
import { autofillFromIncident, autofillFromOrzCard, autofillFromWorker, buildPlFormValues, nextPlFormRef } from "../utils/plFormsAutofill";

const STORAGE_KEY = "pl_forms_records";
const ss = ms;
const genId = () => `druk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function blankRecord(formKey, existing = []) {
  const def = findPlForm(formKey);
  if (!def) return null;
  return {
    id: genId(),
    formKey: def.key,
    formLabel: def.label,
    grupa: def.grupa,
    ref: nextPlFormRef(def.key, existing),
    osoba: "",
    projectName: "",
    values: buildPlFormValues(def.key),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Nazwisko z druku, żeby lista była czytelna bez otwierania każdego wpisu. */
function personFromValues(values) {
  return String(values?.imieNazwisko || "").trim();
}

function FormPicker({ onPick, onClose }) {
  const [grupa, setGrupa] = useState("");
  const grupy = listPlFormGroups();
  const visible = grupa ? PL_FORMS.filter((f) => f.grupa === grupa) : PL_FORMS;

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 620 }}>
        <h3 style={ss.h3}>Wybierz druk</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>
          Druk zapisuje się w rejestrze i drukuje na A4 z danymi pracodawcy oraz miejscem na podpisy.
        </p>
        <label style={ss.lbl} htmlFor="pl-form-grupa">Grupa</label>
        <select id="pl-form-grupa" style={ss.inp} value={grupa} onChange={(e) => setGrupa(e.target.value)}>
          <option value="">Wszystkie grupy</option>
          {grupy.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, maxHeight: 340, overflowY: "auto" }}>
          {visible.map((f) => (
            <button
              key={f.key}
              type="button"
              style={{ ...ss.card, padding: 10, textAlign: "left", cursor: "pointer" }}
              onClick={() => onPick(f.key)}
            >
              <strong style={{ fontSize: 13 }}>{f.label}</strong>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{f.opis}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 4 }}>{f.podstawa}</div>
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

function FieldInput({ field, value, onChange }) {
  const id = `pl-form-${field.key}`;
  if (field.kind === "check") {
    return (
      <label style={{ ...ss.lbl, display: "flex", gap: 8, alignItems: "center", marginTop: 8 }} htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  return (
    <div style={{ gridColumn: field.wide || field.kind === "textarea" ? "1 / -1" : "auto" }}>
      <label style={ss.lbl} htmlFor={id}>
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.kind === "textarea" ? (
        <textarea id={id} style={{ ...ss.inp, minHeight: 64 }} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === "select" ? (
        <select id={id} style={ss.inp} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">— wybierz —</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.kind === "date" ? "date" : "text"}
          style={ss.inp}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && <div style={{ ...ss.hint, marginTop: 2 }}>{field.hint}</div>}
    </div>
  );
}

function RecordForm({ item, sources, onSave, onClose }) {
  const def = findPlForm(item.formKey);
  const [form, setForm] = useState(item);
  const [filled, setFilled] = useState("");
  if (!def) return null;

  const setValue = (key, v) => setForm((p) => ({ ...p, values: { ...p.values, [key]: v } }));
  const missing = plFormMissingFields(def.key, form.values);

  /** Autouzupełnianie dopisuje tylko puste pola, więc nie kasuje tego, co już wpisano ręcznie. */
  const applyFill = (fn, label) => {
    setForm((p) => ({ ...p, values: fn(def.key, p.values) }));
    setFilled(label);
  };

  const orzForForm = def.key === "skierowanie_badania" ? sources.orzCards : [];
  const incidentsForForm = def.grupa === "Wypadki" ? sources.incidents : [];

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 780 }}>
        <h3 style={ss.h3}>{def.label}</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>{def.podstawa}</p>

        <div style={{ ...ss.card, padding: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 12 }}>Wypełnij z danych, które już masz</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            <div>
              <label style={ss.lbl} htmlFor="pl-form-src-worker">Pracownik</label>
              <select
                id="pl-form-src-worker"
                style={ss.inp}
                value=""
                onChange={(e) => {
                  const w = sources.workers.find((x) => x.id === e.target.value);
                  if (w) applyFill((k, v) => autofillFromWorker(k, w, v), `dane pracownika: ${w.name}`);
                }}
              >
                <option value="">— wybierz pracownika —</option>
                {sources.workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name || "bez nazwiska"}{w.role ? ` · ${w.role}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={ss.lbl} htmlFor="pl-form-src-project">Budowa</label>
              <select
                id="pl-form-src-project"
                style={ss.inp}
                value=""
                onChange={(e) => {
                  const proj = sources.projects.find((x) => x.id === e.target.value);
                  if (proj) {
                    setForm((p) => ({ ...p, projectName: p.projectName || proj.name || "" }));
                    setFilled(`budowa: ${proj.name}`);
                  }
                }}
              >
                <option value="">— wybierz budowę —</option>
                {sources.projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.name || "bez nazwy"}</option>
                ))}
              </select>
            </div>
            {orzForForm.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl} htmlFor="pl-form-src-orz">Karta oceny ryzyka zawodowego</label>
                <select
                  id="pl-form-src-orz"
                  style={ss.inp}
                  value=""
                  onChange={(e) => {
                    const card = orzForForm.find((x) => x.id === e.target.value);
                    if (card) applyFill((k, v) => autofillFromOrzCard(k, card, v), `czynniki z karty ORZ: ${card.stanowisko}`);
                  }}
                >
                  <option value="">— przenieś czynniki szkodliwe z karty ORZ —</option>
                  {orzForForm.map((c) => (
                    <option key={c.id} value={c.id}>{c.stanowisko}</option>
                  ))}
                </select>
              </div>
            )}
            {incidentsForForm.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ss.lbl} htmlFor="pl-form-src-incident">Zdarzenie z rejestru</label>
                <select
                  id="pl-form-src-incident"
                  style={ss.inp}
                  value=""
                  onChange={(e) => {
                    const inc = incidentsForForm.find((x) => x.id === e.target.value);
                    if (inc) applyFill((k, v) => autofillFromIncident(k, inc, v), `zdarzenie: ${inc.ref || inc.location || "bez opisu"}`);
                  }}
                >
                  <option value="">— przenieś datę, miejsce i opis zdarzenia —</option>
                  {incidentsForForm.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {[String(inc.occurredAt || "").slice(0, 10), inc.ref, inc.location].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {filled && <div style={{ ...ss.hint, marginTop: 6 }}>Uzupełniono puste pola — {filled}.</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={ss.lbl} htmlFor="pl-form-ref">Numer druku</label>
            <input id="pl-form-ref" style={ss.inp} value={form.ref} onChange={(e) => setForm((p) => ({ ...p, ref: e.target.value }))} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="pl-form-project">Budowa / projekt</label>
            <input
              id="pl-form-project"
              style={ss.inp}
              value={form.projectName}
              onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ maxHeight: 420, overflowY: "auto", marginTop: 10 }}>
          {def.sections.map((s) => (
            <div key={s.title} style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 13 }}>{s.title}</strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                {s.fields.map((f) => (
                  <FieldInput key={f.key} field={f} value={form.values[f.key]} onChange={(v) => setValue(f.key, v)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {missing.length > 0 && (
          <div style={{ ...ss.hint, marginTop: 10 }}>Do uzupełnienia: {missing.join(", ")}.</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Anuluj</button>
          <button
            type="button"
            style={ss.btnP}
            onClick={() => onSave({ ...form, osoba: personFromValues(form.values), updatedAt: new Date().toISOString() })}
          >
            Zapisz
          </button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

export default function PlFormsRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(STORAGE_KEY, []));
  const [modal, setModal] = useState(null);
  const liveItems = useMemo(() => liveOrgArrayRows(items), [items]);
  const orgName = getOrgSettings()?.orgName || "";
  const [pdfBusy, setPdfBusy] = useState("");

  // Źródła autouzupełniania — te same rejestry, w których dane już są.
  const sources = useMemo(
    () => ({
      workers: liveOrgArrayRows(load("mysafeops_workers", [])),
      projects: liveOrgArrayRows(load("mysafeops_projects", [])),
      orzCards: liveOrgArrayRows(load("orz_cards", [])),
      incidents: liveOrgArrayRows(load("mysafeops_incidents", [])),
    }),
    []
  );

  const persist = (next) => {
    setItems(next);
    save(STORAGE_KEY, next);
  };

  const addForm = (formKey) => {
    const rec = blankRecord(formKey, items);
    if (!rec) return;
    persist([rec, ...items]);
    pushAudit({ action: "pl_form_add", entity: "pl-druki", detail: rec.formLabel });
    setModal({ type: "form", data: rec });
  };

  const saveRecord = (rec) => {
    persist(items.map((i) => (i.id === rec.id ? rec : i)));
    pushAudit({ action: "pl_form_update", entity: "pl-druki", detail: rec.formLabel });
    setModal(null);
  };

  const handleExportCsv = () => {
    const rows = liveItems.map((r) => [
      r.formLabel,
      r.grupa || "",
      r.ref || "",
      r.osoba || "",
      r.projectName || "",
      (r.updatedAt || r.createdAt || "").slice(0, 10),
      plFormMissingFields(r.formKey, r.values).length ? "niekompletny" : "kompletny",
    ]);
    exportCsv(
      ["Druk", "Grupa", "Numer", "Osoba", "Budowa", "Aktualizacja", "Stan"],
      rows,
      `druki_bhp_${todayLocalISO()}.csv`
    );
  };

  const niekompletne = liveItems.filter((r) => plFormMissingFields(r.formKey, r.values).length > 0).length;

  return (
    <>
      <PageHero
        badgeText="DRUKI"
        title="Druki BHP"
        lead="Skierowania na badania, karty szkoleń, ewidencja ŚOI i komplet druków powypadkowych — wypełnij i wydrukuj na A4."
        exportModuleId="pl-druki"
        exportModuleLabel="Rejestr druków BHP"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {liveItems.length > 0 && (
              <button type="button" style={ss.btn} onClick={handleExportCsv}>Eksport CSV</button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "picker" })}>
              + Nowy druk
            </button>
          </div>
        }
      />
      <RegisterModuleShell moduleId="pl-druki" smartContext={{ items: liveItems }}>
        {liveItems.length === 0 ? (
          <EmptyState
            title="Brak druków"
            description="Dodaj skierowanie na badania, kartę szkolenia wstępnego albo druk powypadkowy."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {niekompletne > 0 && (
              <div style={ss.hint}>{niekompletne} druk(ów) ma nieuzupełnione pola wymagane.</div>
            )}
            {liveItems.map((r) => {
              const missing = plFormMissingFields(r.formKey, r.values);
              return (
                <div key={r.id} style={{ ...ss.card, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{r.formLabel}</strong>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {[r.ref, r.osoba, r.projectName].filter(Boolean).join(" · ") || "Bez danych"}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: missing.length ? "#b45309" : "#15803d" }}>
                      {missing.length ? `${missing.length} pól do uzupełnienia` : "Kompletny"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                      Edytuj
                    </button>
                    <button
                      type="button"
                      style={ss.btn}
                      onClick={() => printPlForm(r, { orgName, projectName: r.projectName })}
                    >
                      Drukuj
                    </button>
                    <button
                      type="button"
                      style={ss.btn}
                      disabled={pdfBusy === r.id}
                      onClick={async () => {
                        setPdfBusy(r.id);
                        try {
                          const res = await exportPlFormPdf(r);
                          if (!res.ok) window.alert("Nie udało się wygenerować PDF — sprawdź blokadę pobierania w przeglądarce.");
                          else pushAudit({ action: "pl_form_pdf", entity: "pl-druki", detail: r.formLabel });
                        } finally {
                          setPdfBusy("");
                        }
                      }}
                    >
                      {pdfBusy === r.id ? "Generuję…" : "PDF"}
                    </button>
                    {caps?.canDelete !== false && (
                      <button
                        type="button"
                        style={ss.btn}
                        onClick={() => {
                          if (!window.confirm("Usunąć druk?")) return;
                          softDeleteToRecycleBin({
                            moduleId: "pl-druki",
                            moduleLabel: "Druki BHP",
                            itemId: r.id,
                            itemLabel: r.formLabel,
                            payload: r,
                          });
                          persist(replaceWithTombstone(items, r.id));
                          pushAudit({ action: "pl_form_delete", entity: "pl-druki", detail: r.formLabel });
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

      {modal?.type === "picker" && <FormPicker onPick={addForm} onClose={() => setModal(null)} />}
      {modal?.type === "form" && (
        <RecordForm item={modal.data} sources={sources} onSave={saveRecord} onClose={() => setModal(null)} />
      )}
    </>
  );
}
