/**
 * Automatyczne wypełnianie polskich druków BHP danymi, które aplikacja już ma.
 *
 * Druk BHP w większości to przepisywanie tego samego: kto, na jakim stanowisku, na jakiej
 * budowie i jakie czynniki występują. Te dane siedzą już w rejestrze pracowników, w karcie
 * oceny ryzyka zawodowego i w rejestrze zdarzeń — tutaj są przenoszone do pól druku,
 * żeby zostało do wpisania tylko to, czego nikt wcześniej nie zapisał.
 *
 * Autouzupełnianie nigdy nie nadpisuje wartości już wpisanej ręcznie.
 */
import { findPlForm, plFormFields } from "./plFormsLibrary";
import { assessOrzCard } from "./plOrzLibrary";
import { todayLocalISO } from "./localDate";

/** Prefiks numeru druku — czytelny w segregatorze i w rejestrze. */
const REF_PREFIX = {
  skierowanie_badania: "SK",
  karta_szkolenia_wstepnego: "KSW",
  zaswiadczenie_okresowe: "ZSO",
  karta_odziezy: "KEW",
  zgloszenie_wypadku_pracownika: "ZGW",
  zgloszenie_wypadku_niepracownika: "ZGN",
  protokol_powypadkowy: "PW",
  karta_wypadku: "KW",
  karta_wypadku_w_drodze: "KWD",
  statystyczna_karta: "ZKW",
};

/**
 * Kolejny numer druku w formacie PREFIKS/ROK/NN — liczony w obrębie jednego rodzaju druku.
 * @param {string} formKey
 * @param {Array<{ formKey?: string, ref?: string }>} existing
 * @param {string} [isoDate]
 */
export function nextPlFormRef(formKey, existing = [], isoDate = todayLocalISO()) {
  const prefix = REF_PREFIX[formKey] || "DR";
  const year = String(isoDate || "").slice(0, 4) || String(new Date().getFullYear());
  const pattern = new RegExp(`^${prefix}/${year}/(\\d+)$`);
  let max = 0;
  for (const row of existing) {
    if (row?.formKey !== formKey) continue;
    const m = pattern.exec(String(row?.ref || "").trim());
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return `${prefix}/${year}/${String(max + 1).padStart(2, "0")}`;
}

/** Scala tylko puste pola — ręczny wpis zawsze wygrywa. */
function mergeBlank(values, patch) {
  const out = { ...values };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") continue;
    const current = out[k];
    const empty = current === undefined || current === null || String(current).trim() === "";
    if (empty) out[k] = v;
  }
  return out;
}

/** Pola daty, które mają sens jako „dzisiaj" przy zakładaniu druku. */
const TODAY_FIELDS = ["dataWystawienia", "dataZgloszenia", "dataSporzadzenia", "dataWydania", "dataOceny"];

/**
 * Dane pracownika → pola osobowe druku.
 * @param {string} formKey
 * @param {{ name?: string, role?: string, pesel?: string, company?: string }} worker
 * @param {Record<string, unknown>} [values]
 */
export function autofillFromWorker(formKey, worker, values = {}) {
  if (!findPlForm(formKey) || !worker) return values;
  const keys = new Set(plFormFields(formKey).map((f) => f.key));
  const patch = {};
  if (keys.has("imieNazwisko")) patch.imieNazwisko = String(worker.name || "").trim();
  if (keys.has("stanowisko")) patch.stanowisko = String(worker.role || "").trim();
  if (keys.has("pesel")) patch.pesel = String(worker.pesel || "").trim();
  if (keys.has("podmiotZlecajacy")) patch.podmiotZlecajacy = String(worker.company || "").trim();

  // Druki higieniczne nie mają jednego poszkodowanego, tylko listę osób wchodzących do strefy,
  // więc kolejny wybrany pracownik dopisuje się do listy zamiast nadpisywać poprzedniego.
  if (keys.has("osobyWchodzace")) {
    const line = [worker.name, worker.role].filter(Boolean).map(String).map((v) => v.trim()).join(" — ");
    if (line) {
      const current = String(values.osobyWchodzace || "").trim();
      const already = current.split("\n").some((row) => row.trim() === line);
      return { ...mergeBlank(values, patch), osobyWchodzace: already || !current ? current || line : `${current}\n${line}` };
    }
  }

  return mergeBlank(values, patch);
}

/**
 * Karta ORZ → skierowanie na badania. Czynniki z oceny ryzyka trafiają do opisu warunków
 * pracy, bo to dokładnie ta sama lista, którą lekarz medycyny pracy chce zobaczyć.
 * @param {string} formKey
 * @param {object} orzCard
 * @param {Record<string, unknown>} [values]
 */
export function autofillFromOrzCard(formKey, orzCard, values = {}) {
  if (formKey !== "skierowanie_badania" || !orzCard) return values;
  const card = assessOrzCard(orzCard);
  const grupy = { fizyczne: [], pylowe: [], chemiczne: [], uciazliwe: [] };
  let wysokosc = false;
  let maszyny = false;

  for (const z of card.zagrozenia || []) {
    const text = `${z.czynnik} — ${z.zrodlo}`;
    const hay = `${z.czynnik} ${z.zrodlo}`.toLowerCase();
    if (/wysokoś|wysokos|upadek z/.test(hay)) wysokosc = true;
    // Samo przebywanie w pobliżu maszyn to nie obsługa — pole dotyczy operatora, nie sąsiada.
    if (/obsług|obslug|operator|wózk|wozk|żuraw|zuraw|podest ruchom|maszyn w ruchu|udt/.test(hay)) maszyny = true;
    if (/pył|pyl|krzemionk|azbest/.test(hay)) grupy.pylowe.push(text);
    else if (/chemi|substancj|opar|rozpuszczaln|biologi/.test(hay)) grupy.chemiczne.push(text);
    else if (/hałas|halas|drgani|wibracj|temperatur|oświetlen|oswietlen|mikroklimat|prąd|prad/.test(hay))
      grupy.fizyczne.push(text);
    else grupy.uciazliwe.push(text);
  }

  return mergeBlank(values, {
    stanowisko: card.stanowisko,
    opisStanowiska: card.opis,
    czynnikiFizyczne: grupy.fizyczne.join("\n"),
    czynnikiPylowe: grupy.pylowe.join("\n"),
    czynnikiChemiczne: grupy.chemiczne.join("\n"),
    czynnikiUciazliwe: grupy.uciazliwe.join("\n"),
    wysokosc: wysokosc || undefined,
    maszyny: maszyny || undefined,
  });
}

/**
 * Zdarzenie z rejestru → druk powypadkowy. Zgłoszenie, protokół i karta wypadku opisują
 * to samo zdarzenie, więc data, miejsce i przebieg powinny się przenieść same.
 * @param {string} formKey
 * @param {{ ref?: string, occurredAt?: string, location?: string, description?: string, injuryDetail?: string, personName?: string, witnesses?: string }} incident
 * @param {Record<string, unknown>} [values]
 */
export function autofillFromIncident(formKey, incident, values = {}) {
  if (!findPlForm(formKey) || !incident) return values;
  const keys = new Set(plFormFields(formKey).map((f) => f.key));
  const occurred = String(incident.occurredAt || "");
  const datePart = occurred.slice(0, 10);
  const timePart = occurred.slice(11, 16);
  const patch = {};

  if (keys.has("dataZdarzenia")) {
    // Protokół i karta wypadku proszą o datę i godzinę w jednym polu, zgłoszenie rozdziela je.
    const field = plFormFields(formKey).find((f) => f.key === "dataZdarzenia");
    patch.dataZdarzenia = field?.kind === "date" ? datePart : [datePart, timePart].filter(Boolean).join(" ");
  }
  if (keys.has("godzina")) patch.godzina = timePart;
  if (keys.has("miejsce")) patch.miejsce = String(incident.location || "").trim();
  if (keys.has("przebieg")) patch.przebieg = String(incident.description || "").trim();
  if (keys.has("okolicznosci")) patch.okolicznosci = String(incident.description || "").trim();
  if (keys.has("skutki")) patch.skutki = String(incident.injuryDetail || "").trim();
  if (keys.has("imieNazwisko")) patch.imieNazwisko = String(incident.personName || "").trim();
  if (keys.has("swiadkowie")) patch.swiadkowie = String(incident.witnesses || "").trim();
  if (keys.has("numerProtokolu")) patch.numerProtokolu = String(incident.ref || "").trim();

  return mergeBlank(values, patch);
}

/**
 * Termin ważności szkolenia okresowego liczony z grupy stanowisk — robotnicze co 3 lata,
 * kierownicze i inżynieryjno-techniczne co 5 lat, biurowe co 6. Data liczy się od zakończenia
 * szkolenia, więc wystawiający nie musi jej odliczać w pamięci.
 * @param {string} grupaStanowisk
 * @param {string} dataDo ISO YYYY-MM-DD
 */
export function szkolenieOkresoweWaznoscDo(grupaStanowisk, dataDo) {
  const iso = String(dataDo || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const grupa = String(grupaStanowisk || "").toLowerCase();
  let lata = 5;
  if (grupa.includes("robotnicz")) lata = 3;
  else if (grupa.includes("administracyjno")) lata = 6;
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(y + lata, m - 1, d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/**
 * Wartości startowe nowego druku — daty na dziś i dane organizacji.
 * @param {string} formKey
 * @param {{ orgName?: string, today?: string }} [ctx]
 */
export function initialPlFormValues(formKey, ctx = {}) {
  const fields = plFormFields(formKey);
  const today = ctx.today || todayLocalISO();
  const values = {};
  for (const f of fields) {
    if (f.kind === "date" && TODAY_FIELDS.includes(f.key)) values[f.key] = today;
  }
  return values;
}

/**
 * Pełne przygotowanie druku ze wskazanych źródeł — kolejność ma znaczenie: pracownik daje
 * dane osobowe, karta ORZ warunki pracy, zdarzenie okoliczności.
 * @param {string} formKey
 * @param {{ worker?: object, orzCard?: object, incident?: object, values?: Record<string, unknown>, today?: string }} sources
 */
export function buildPlFormValues(formKey, sources = {}) {
  let values = { ...initialPlFormValues(formKey, { today: sources.today }), ...(sources.values || {}) };
  if (sources.worker) values = autofillFromWorker(formKey, sources.worker, values);
  if (sources.orzCard) values = autofillFromOrzCard(formKey, sources.orzCard, values);
  if (sources.incident) values = autofillFromIncident(formKey, sources.incident, values);
  if (formKey === "zaswiadczenie_okresowe") {
    const waznosc = szkolenieOkresoweWaznoscDo(values.grupaStanowisk, values.dataDo);
    if (waznosc) values = mergeBlank(values, { waznoscDo: waznosc });
  }
  return values;
}
