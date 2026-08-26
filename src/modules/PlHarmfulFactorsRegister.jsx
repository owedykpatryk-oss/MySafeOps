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
  czynnikRodzaj,
  findCzynnik,
  listCzynnikRodzaje,
  ocenPomiar,
  OKRES_PRZECHOWYWANIA,
  PL_CZYNNIKI,
  podsumujRejestr,
} from "../utils/plCzynnikiLibrary";
import { printKartaBadan, printRejestrCzynnikow } from "../utils/plCzynnikiPrintHtml";

const STORAGE_KEY = "pl_czynniki_szkodliwe";
const ss = ms;
const genId = () => `czyn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const STATUS_TONE = {
  "po-terminie": "#b91c1c",
  wkrotce: "#b45309",
  aktualny: "#15803d",
  odstapiono: "var(--color-text-secondary)",
  "brak-terminu": "var(--color-text-secondary)",
};

const STATUS_LABEL = {
  "po-terminie": "Pomiar po terminie",
  wkrotce: "Pomiar w ciągu 30 dni",
  aktualny: "Termin aktualny",
  odstapiono: "Odstąpiono od pomiarów",
  "brak-terminu": "Termin nieustalony",
};

/** Kolejny numer karty badań w roku. */
function nextRef(existing, isoDate = todayLocalISO()) {
  const year = isoDate.slice(0, 4);
  const pattern = new RegExp(`^KB/${year}/(\\d+)$`);
  let max = 0;
  for (const row of existing || []) {
    const m = pattern.exec(String(row?.ref || "").trim());
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return `KB/${year}/${String(max + 1).padStart(2, "0")}`;
}

/** Snapshot z biblioteki — wartość dopuszczalna zostaje taka, jaka obowiązywała przy pomiarze. */
function rowFromLibrary(key, existing) {
  const src = findCzynnik(key);
  if (!src) return null;
  return {
    id: genId(),
    libraryKey: src.key,
    nazwa: src.nazwa,
    rodzaj: src.rodzaj,
    jednostka: src.jednostka,
    wartoscDopuszczalna: src.wartoscDopuszczalna,
    ref: nextRef(existing),
    stanowisko: "",
    komorka: "",
    liczbaOsob: "",
    wynik: "",
    dataPomiaru: todayLocalISO(),
    metoda: "",
    laboratorium: "",
    numerSprawozdania: "",
    nastepnyPomiarRecznie: "",
    odstapiono: false,
    srodki: "",
    uwagi: src.uwagi || "",
    createdAt: new Date().toISOString(),
  };
}

function LibraryPicker({ onPick, onClose }) {
  const [rodzaj, setRodzaj] = useState("");
  const rodzaje = listCzynnikRodzaje();
  const visible = rodzaj ? PL_CZYNNIKI.filter((c) => c.rodzaj === rodzaj) : PL_CZYNNIKI;

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 640 }}>
        <h3 style={ss.h3}>Dodaj czynnik do rejestru</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>
          Czynnik trafia do rejestru z orientacyjną wartością dopuszczalną — potwierdź ją w aktualnym rozporządzeniu NDS/NDN.
        </p>
        <label style={ss.lbl} htmlFor="czyn-rodzaj">Rodzaj czynnika</label>
        <select id="czyn-rodzaj" style={ss.inp} value={rodzaj} onChange={(e) => setRodzaj(e.target.value)}>
          <option value="">Wszystkie rodzaje</option>
          {rodzaje.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, maxHeight: 360, overflowY: "auto" }}>
          {visible.map((c) => (
            <button
              key={c.key}
              type="button"
              style={{ ...ss.card, padding: 10, textAlign: "left", cursor: "pointer" }}
              onClick={() => onPick(c.key)}
            >
              <strong style={{ fontSize: 13 }}>{c.nazwa}</strong>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                {czynnikRodzaj(c.rodzaj)?.label} · dopuszczalna {c.wartoscDopuszczalna} {c.jednostka}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 4 }}>
                {c.typoweStanowiska.join(" · ")}
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

function MeasurementForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(item);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const ocena = ocenPomiar(form);

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 760 }}>
        <h3 style={ss.h3}>{form.nazwa}</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>{czynnikRodzaj(form.rodzaj)?.label}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={ss.lbl} htmlFor="czyn-ref">Numer karty</label>
            <input id="czyn-ref" style={ss.inp} value={form.ref} onChange={(e) => set("ref", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-stanowisko">Stanowisko pracy *</label>
            <input id="czyn-stanowisko" style={ss.inp} value={form.stanowisko} onChange={(e) => set("stanowisko", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-komorka">Komórka / budowa</label>
            <input id="czyn-komorka" style={ss.inp} value={form.komorka} onChange={(e) => set("komorka", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="czyn-wynik">Wynik pomiaru</label>
            <input id="czyn-wynik" style={ss.inp} value={form.wynik} onChange={(e) => set("wynik", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-dopuszczalna">Wartość dopuszczalna</label>
            <input
              id="czyn-dopuszczalna"
              style={ss.inp}
              value={form.wartoscDopuszczalna}
              onChange={(e) => set("wartoscDopuszczalna", e.target.value)}
            />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-jednostka">Jednostka</label>
            <input id="czyn-jednostka" style={ss.inp} value={form.jednostka} onChange={(e) => set("jednostka", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-osoby">Liczba osób narażonych</label>
            <input id="czyn-osoby" style={ss.inp} value={form.liczbaOsob} onChange={(e) => set("liczbaOsob", e.target.value)} />
          </div>
        </div>

        <div style={{ ...ss.card, padding: 10, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 12 }}>{ocena.krotnoscLabel}</strong>
            <span style={{ fontSize: 12, fontWeight: 600, color: ocena.przekroczenie ? "#b91c1c" : "#15803d" }}>
              {ocena.krotnosc === null ? "Wpisz wynik i wartość dopuszczalną" : ocena.przekroczenie ? "Przekroczenie" : "W granicach"}
            </span>
          </div>
          <div style={{ ...ss.hint, marginTop: 4 }}>
            {ocena.odstepMiesiace
              ? `Z krotności wynika pomiar co ${ocena.odstepMiesiace} mies. — kolejny termin ${ocena.nastepnyPomiar || "—"}.`
              : "Termin kolejnego pomiaru ustal ręcznie."}
          </div>
          {ocena.wymagaRejestruNarazenia && (
            <div style={{ ...ss.hint, marginTop: 4, color: "#b45309" }}>
              Czynnik wymaga prowadzenia rejestru prac i rejestru pracowników narażonych.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="czyn-data">Data pomiaru *</label>
            <input id="czyn-data" type="date" style={ss.inp} value={form.dataPomiaru} onChange={(e) => set("dataPomiaru", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-nastepny">Kolejny pomiar (ręcznie)</label>
            <input
              id="czyn-nastepny"
              type="date"
              style={ss.inp}
              value={form.nastepnyPomiarRecznie}
              onChange={(e) => set("nastepnyPomiarRecznie", e.target.value)}
            />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-lab">Laboratorium</label>
            <input id="czyn-lab" style={ss.inp} value={form.laboratorium} onChange={(e) => set("laboratorium", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <div>
            <label style={ss.lbl} htmlFor="czyn-metoda">Metoda / norma badawcza</label>
            <input id="czyn-metoda" style={ss.inp} value={form.metoda} onChange={(e) => set("metoda", e.target.value)} />
          </div>
          <div>
            <label style={ss.lbl} htmlFor="czyn-sprawozdanie">Numer sprawozdania</label>
            <input
              id="czyn-sprawozdanie"
              style={ss.inp}
              value={form.numerSprawozdania}
              onChange={(e) => set("numerSprawozdania", e.target.value)}
            />
          </div>
        </div>

        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="czyn-srodki">Środki ograniczające narażenie</label>
        <textarea
          id="czyn-srodki"
          style={{ ...ss.inp, minHeight: 56 }}
          value={form.srodki}
          onChange={(e) => set("srodki", e.target.value)}
          placeholder="Odciąg miejscowy, praca na mokro, rotacja, ŚOI, skrócenie czasu ekspozycji…"
        />

        <label style={{ ...ss.lbl, marginTop: 10 }} htmlFor="czyn-uwagi">Uwagi</label>
        <textarea id="czyn-uwagi" style={{ ...ss.inp, minHeight: 44 }} value={form.uwagi} onChange={(e) => set("uwagi", e.target.value)} />

        <label style={{ ...ss.lbl, display: "flex", gap: 8, alignItems: "center", marginTop: 10 }} htmlFor="czyn-odstapiono">
          <input
            id="czyn-odstapiono"
            type="checkbox"
            checked={Boolean(form.odstapiono)}
            onChange={(e) => set("odstapiono", e.target.checked)}
          />
          Odstąpiono od pomiarów — dwa kolejne wyniki poniżej 0,1 wartości dopuszczalnej
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Anuluj</button>
          <button
            type="button"
            style={ss.btnP}
            onClick={() => {
              const check = validateRequiredFields(form, ["stanowisko", "dataPomiaru"], {
                stanowisko: "Stanowisko pracy",
                dataPomiaru: "Data pomiaru",
              });
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

export default function PlHarmfulFactorsRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(STORAGE_KEY, []));
  const [modal, setModal] = useState(null);
  const liveItems = useMemo(() => liveOrgArrayRows(items), [items]);
  const orgName = getOrgSettings()?.orgName || "";
  const summary = useMemo(() => podsumujRejestr(liveItems), [liveItems]);

  const persist = (next) => {
    setItems(next);
    save(STORAGE_KEY, next);
  };

  const addFromLibrary = (key) => {
    const row = rowFromLibrary(key, items);
    if (!row) return;
    persist([row, ...items]);
    pushAudit({ action: "pl_czynnik_add", entity: "pl-czynniki", detail: row.nazwa });
    setModal({ type: "form", data: row });
  };

  const saveRow = (row) => {
    persist(items.map((i) => (i.id === row.id ? row : i)));
    pushAudit({ action: "pl_czynnik_update", entity: "pl-czynniki", detail: row.nazwa });
    setModal(null);
  };

  const handleExportCsv = () => {
    const rows = liveItems.map((r) => {
      const ocena = ocenPomiar(r);
      return [
        r.ref || "",
        r.stanowisko || "",
        r.nazwa,
        czynnikRodzaj(r.rodzaj)?.label || "",
        `${r.wynik ?? ""} ${r.jednostka || ""}`.trim(),
        String(r.wartoscDopuszczalna ?? ""),
        ocena.krotnosc === null ? "" : ocena.krotnosc.toFixed(2),
        r.dataPomiaru || "",
        ocena.nastepnyPomiar || "",
        STATUS_LABEL[ocena.status] || "",
      ];
    });
    exportCsv(
      ["Numer karty", "Stanowisko", "Czynnik", "Rodzaj", "Wynik", "Dopuszczalna", "Krotność", "Data pomiaru", "Kolejny pomiar", "Stan"],
      rows,
      `czynniki_szkodliwe_${todayLocalISO()}.csv`
    );
  };

  return (
    <>
      <PageHero
        badgeText="CSZ"
        title="Czynniki szkodliwe i pomiary"
        lead="Rejestr czynników szkodliwych i karty badań — z terminem kolejnego pomiaru liczonym z krotności wartości dopuszczalnej."
        exportModuleId="pl-czynniki"
        exportModuleLabel="Rejestr czynników szkodliwych"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {liveItems.length > 0 && (
              <>
                <button type="button" style={ss.btn} onClick={handleExportCsv}>Eksport CSV</button>
                <button type="button" style={ss.btn} onClick={() => printRejestrCzynnikow(liveItems, { orgName })}>
                  Drukuj rejestr
                </button>
              </>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "library" })}>
              + Dodaj czynnik
            </button>
          </div>
        }
      />
      <RegisterModuleShell moduleId="pl-czynniki" smartContext={{ items: liveItems }}>
        {liveItems.length === 0 ? (
          <EmptyState
            title="Brak wpisów w rejestrze"
            description="Dodaj czynnik z biblioteki — pyły, hałas, drgania, chemia, czynniki rakotwórcze."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(summary.przekroczenia > 0 || summary.poTerminie > 0 || summary.wkrotce > 0) && (
              <div style={ss.hint}>
                {[
                  summary.przekroczenia > 0 ? `${summary.przekroczenia} przekroczeń wartości dopuszczalnej` : "",
                  summary.poTerminie > 0 ? `${summary.poTerminie} pomiarów po terminie` : "",
                  summary.wkrotce > 0 ? `${summary.wkrotce} pomiarów w ciągu 30 dni` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {liveItems.map((r) => {
              const ocena = ocenPomiar(r);
              return (
                <div key={r.id} style={{ ...ss.card, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{r.nazwa}</strong>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {[r.ref, r.stanowisko, r.komorka, r.dataPomiaru].filter(Boolean).join(" · ")}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2, color: ocena.przekroczenie ? "#b91c1c" : "var(--color-text-secondary)" }}>
                        {r.wynik ? `${r.wynik} ${r.jednostka || ""} · ${ocena.krotnoscLabel}` : "Brak wyniku pomiaru"}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_TONE[ocena.status] }}>
                      {STATUS_LABEL[ocena.status]}
                      {ocena.nastepnyPomiar && ocena.status !== "odstapiono" ? ` · ${ocena.nastepnyPomiar}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: r })}>
                      Edytuj
                    </button>
                    <button type="button" style={ss.btn} onClick={() => printKartaBadan(r, { orgName })}>
                      Karta badań
                    </button>
                    {caps?.canDelete !== false && (
                      <button
                        type="button"
                        style={ss.btn}
                        onClick={() => {
                          if (!window.confirm("Usunąć wpis z rejestru? Rejestr przechowuje się 40 lat.")) return;
                          softDeleteToRecycleBin({
                            moduleId: "pl-czynniki",
                            moduleLabel: "Czynniki szkodliwe",
                            itemId: r.id,
                            itemLabel: r.nazwa,
                            payload: r,
                          });
                          persist(replaceWithTombstone(items, r.id));
                          pushAudit({ action: "pl_czynnik_delete", entity: "pl-czynniki", detail: r.nazwa });
                        }}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={ss.hint}>{OKRES_PRZECHOWYWANIA}</div>
          </div>
        )}
      </RegisterModuleShell>

      {modal?.type === "library" && <LibraryPicker onPick={addFromLibrary} onClose={() => setModal(null)} />}
      {modal?.type === "form" && <MeasurementForm item={modal.data} onSave={saveRow} onClose={() => setModal(null)} />}
    </>
  );
}
