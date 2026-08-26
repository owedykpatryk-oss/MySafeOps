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
import { assessOrzCard, findOrzCard, listOrzBranze, PL_ORZ_CARDS } from "../utils/plOrzLibrary";
import { printOrzCard } from "../utils/plOrzPrintHtml";

const STORAGE_KEY = "orz_cards";
const ss = ms;
const genId = () => `orz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const LEVEL_TONE = { małe: "#15803d", średnie: "#b45309", duże: "#b91c1c" };

/** Snapshot biblioteki — karta zapisana w rejestrze nie zmienia się przy aktualizacji biblioteki. */
function cardFromLibrary(key) {
  const src = findOrzCard(key);
  if (!src) return null;
  return {
    id: genId(),
    libraryKey: src.key,
    stanowisko: src.stanowisko,
    branza: src.branza,
    opis: src.opis,
    badania: [...src.badania],
    szkolenia: [...src.szkolenia],
    uprawnienia: [...src.uprawnienia],
    soi: [...src.soi],
    zagrozenia: src.zagrozenia.map((z) => ({ ...z, srodki: [...z.srodki] })),
    komorka: "",
    dataOceny: todayLocalISO(),
    oceniajacy: "",
    uwagi: "",
    createdAt: new Date().toISOString(),
  };
}

function LibraryPicker({ onPick, onClose }) {
  const [branza, setBranza] = useState("");
  const branze = listOrzBranze();
  const visible = branza ? PL_ORZ_CARDS.filter((c) => c.branza === branza) : PL_ORZ_CARDS;

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 620 }}>
        <h3 style={ss.h3}>Dodaj kartę ORZ z biblioteki</h3>
        <p style={{ ...ss.hint, marginTop: 0 }}>
          Karta trafia do rejestru jako kopia — możesz ją potem uzupełnić o dane budowy i uwagi.
        </p>
        <label style={ss.lbl} htmlFor="orz-branza">Branża</label>
        <select id="orz-branza" style={ss.inp} value={branza} onChange={(e) => setBranza(e.target.value)}>
          <option value="">Wszystkie branże</option>
          {branze.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, maxHeight: 340, overflowY: "auto" }}>
          {visible.map((c) => {
            const assessed = assessOrzCard(c);
            return (
              <button
                key={c.key}
                type="button"
                style={{ ...ss.card, textAlign: "left", cursor: "pointer" }}
                onClick={() => onPick(c.key)}
              >
                <strong>{c.stanowisko}</strong>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {c.branza} · {c.zagrozenia.length} zagrożeń · najwyższe ryzyko:{" "}
                  <span style={{ color: LEVEL_TONE[assessed.najwyzszePoziomRyzyka] }}>
                    {assessed.najwyzszePoziomRyzyka}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" style={ss.btn} onClick={onClose}>Zamknij</button>
        </div>
      </div>
    </ModuleOverlay>
  );
}

function CardForm({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...item }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const assessed = assessOrzCard(form);

  return (
    <ModuleOverlay onClose={onClose}>
      <div className="app-module-overlay__panel" style={{ ...ss.card, maxWidth: 640 }}>
        <h3 style={ss.h3}>{form.stanowisko}</h3>
        <label style={ss.lbl} htmlFor="orz-komorka">Komórka organizacyjna / budowa</label>
        <input
          id="orz-komorka"
          style={ss.inp}
          value={form.komorka || ""}
          onChange={(e) => set("komorka", e.target.value)}
          placeholder="np. Budowa S5 — brygada zbrojarska"
        />
        <label style={ss.lbl} htmlFor="orz-data">Data oceny</label>
        <input id="orz-data" type="date" style={ss.inp} value={form.dataOceny || ""} onChange={(e) => set("dataOceny", e.target.value)} />
        <label style={ss.lbl} htmlFor="orz-oceniajacy">Ocenę sporządził</label>
        <input
          id="orz-oceniajacy"
          style={ss.inp}
          value={form.oceniajacy || ""}
          onChange={(e) => set("oceniajacy", e.target.value)}
          placeholder="Imię i nazwisko, funkcja"
        />
        <label style={ss.lbl} htmlFor="orz-uwagi">Uwagi do stanowiska</label>
        <textarea
          id="orz-uwagi"
          style={{ ...ss.inp, minHeight: 70 }}
          value={form.uwagi || ""}
          onChange={(e) => set("uwagi", e.target.value)}
          placeholder="Warunki szczególne, dodatkowe zagrożenia, ustalenia z pracownikiem…"
        />

        <div style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13 }}>Zagrożenia i poziom ryzyka</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
            {assessed.zagrozenia.map((z, i) => (
              <div key={`${z.czynnik}-${i}`} style={{ ...ss.card, padding: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 12 }}>{z.czynnik}</strong>
                  <span style={{ fontSize: 12, fontWeight: 600, color: LEVEL_TONE[z.poziom] }}>{z.poziom}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{z.skutki}</div>
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
              const check = validateRequiredFields(form, ["dataOceny"], { dataOceny: "Data oceny" });
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

export default function OccupationalRiskRegister() {
  const { caps } = useApp();
  const [items, setItems] = useState(() => load(STORAGE_KEY, []));
  const [modal, setModal] = useState(null);
  const liveItems = useMemo(() => liveOrgArrayRows(items), [items]);
  const orgName = getOrgSettings()?.orgName || "";

  const persist = (next) => {
    setItems(next);
    save(STORAGE_KEY, next);
  };

  const addFromLibrary = (key) => {
    const card = cardFromLibrary(key);
    if (!card) return;
    persist([card, ...items]);
    pushAudit({ action: "orz_card_add", entity: "orz", detail: card.stanowisko });
    setModal({ type: "form", data: card });
  };

  const saveCard = (card) => {
    persist(items.map((i) => (i.id === card.id ? card : i)));
    pushAudit({ action: "orz_card_update", entity: "orz", detail: card.stanowisko });
    setModal(null);
  };

  const handleExportCsv = () => {
    const rows = liveItems.flatMap((card) =>
      assessOrzCard(card).zagrozenia.map((z) => [
        card.stanowisko,
        card.komorka || "",
        card.dataOceny || "",
        z.czynnik,
        z.zrodlo,
        z.skutki,
        z.prawdopodobienstwo,
        z.ciezkosc,
        z.poziom,
        z.srodki.join(" | "),
      ])
    );
    exportCsv(
      ["Stanowisko", "Komórka", "Data oceny", "Zagrożenie", "Źródło", "Skutki", "Prawdopodobieństwo", "Ciężkość", "Ryzyko", "Środki profilaktyczne"],
      rows,
      `ocena_ryzyka_zawodowego_${todayLocalISO()}.csv`
    );
  };

  const dużeRyzyko = liveItems.filter((c) => assessOrzCard(c).najwyzszePoziomRyzyka === "duże").length;

  return (
    <>
      <PageHero
        badgeText="ORZ"
        title="Ocena ryzyka zawodowego"
        lead="Karty ORZ dla stanowisk pracy wg skali trójstopniowej PN-N-18002 — z oświadczeniem pracownika do podpisu."
        exportModuleId="orz"
        exportModuleLabel="Rejestr ocen ryzyka zawodowego"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {liveItems.length > 0 && (
              <button type="button" style={ss.btn} onClick={handleExportCsv}>Eksport CSV</button>
            )}
            <button type="button" style={ss.btnP} onClick={() => setModal({ type: "library" })}>
              + Dodaj kartę ORZ
            </button>
          </div>
        }
      />
      <RegisterModuleShell
        moduleId="orz"
        smartContext={{ items: liveItems }}
        stats={
          liveItems.length > 0
            ? [
                { label: "Karty ORZ", value: liveItems.length, tone: "neutral" },
                { label: "Ryzyko duże", value: dużeRyzyko, tone: dużeRyzyko > 0 ? "bad" : "good" },
              ]
            : []
        }
      >
        {liveItems.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Brak kart oceny ryzyka zawodowego"
            description="Dodaj kartę dla stanowiska z biblioteki, uzupełnij dane budowy i wydrukuj z oświadczeniem dla pracownika."
            actionLabel="+ Dodaj kartę ORZ"
            onAction={() => setModal({ type: "library" })}
            variant="dashed"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {liveItems.map((card) => {
              const assessed = assessOrzCard(card);
              return (
                <div key={card.id} style={{ ...ss.card, contentVisibility: "auto", containIntrinsicSize: "0 72px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{card.stanowisko}</strong>
                      {card.komorka ? ` · ${card.komorka}` : ""}
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Ocena: {card.dataOceny || "—"} · {assessed.zagrozenia.length} zagrożeń · najwyższe ryzyko:{" "}
                        <span style={{ color: LEVEL_TONE[assessed.najwyzszePoziomRyzyka], fontWeight: 600 }}>
                          {assessed.najwyzszePoziomRyzyka || "—"}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" style={ss.btn} onClick={() => printOrzCard(card, { orgName })}>
                        Drukuj kartę
                      </button>
                      <button type="button" style={ss.btn} onClick={() => setModal({ type: "form", data: card })}>
                        Edytuj
                      </button>
                      {caps.deleteRecords && (
                        <button
                          type="button"
                          style={{ ...ss.btn, color: "#A32D2D" }}
                          onClick={() => {
                            if (
                              softDeleteToRecycleBin({
                                moduleId: "orz",
                                moduleLabel: "Ocena ryzyka zawodowego",
                                itemType: "orz_card",
                                itemLabel: card.stanowisko || card.id,
                                sourceKey: STORAGE_KEY,
                                payload: card,
                              })
                            ) {
                              persist(replaceWithTombstone(items, card.id));
                              pushAudit({ action: "orz_card_delete", entity: "orz", detail: card.id });
                            }
                          }}
                        >
                          Usuń
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </RegisterModuleShell>

      {modal?.type === "library" && (
        <LibraryPicker
          onPick={(key) => {
            addFromLibrary(key);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "form" && (
        <CardForm item={modal.data} onSave={saveCard} onClose={() => setModal(null)} />
      )}
    </>
  );
}
