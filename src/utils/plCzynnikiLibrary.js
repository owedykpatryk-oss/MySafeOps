/**
 * Czynniki szkodliwe w środowisku pracy — rejestr, karty badań i harmonogram pomiarów.
 *
 * To osobny obowiązek od oceny ryzyka zawodowego: ORZ mówi, jakie ryzyko występuje na
 * stanowisku, a rejestr czynników szkodliwych dokumentuje zmierzone wartości i pilnuje,
 * kiedy pomiar trzeba powtórzyć. Rejestr i karty badań przechowuje się przez 40 lat od
 * ostatniego wpisu, dlatego wpisy są tu traktowane jako zapis archiwalny, a nie notatka.
 *
 * Częstotliwość pomiarów wynika wprost z krotności wartości dopuszczalnej — dlatego
 * `nastepnyPomiar()` liczy termin sam, zamiast zostawiać to pamięci behapowca.
 */
import { todayLocalISO } from "./localDate";

/** Rodzaje czynników — decydują o progach częstotliwości i o brzmieniu karty badań. */
export const CZYNNIK_RODZAJE = [
  { key: "chemiczny", label: "Czynnik chemiczny", limit: "NDS" },
  { key: "pyl", label: "Pył", limit: "NDS" },
  { key: "rakotworczy", label: "Czynnik rakotwórczy lub mutagenny", limit: "NDS" },
  { key: "azbest", label: "Azbest", limit: "NDS" },
  { key: "halas", label: "Hałas", limit: "NDN" },
  { key: "drgania", label: "Drgania mechaniczne", limit: "NDN" },
  { key: "biologiczny", label: "Czynnik biologiczny", limit: "—" },
  { key: "mikroklimat", label: "Mikroklimat", limit: "—" },
];

const RODZAJ_BY_KEY = Object.fromEntries(CZYNNIK_RODZAJE.map((r) => [r.key, r]));

/** @param {string} key */
export function czynnikRodzaj(key) {
  return RODZAJ_BY_KEY[String(key || "")] || null;
}

/**
 * Biblioteka czynników spotykanych na budowie i w serwisie zakładów spożywczych.
 * Wartości dopuszczalne podano orientacyjnie — obowiązujące wartości bierze się
 * z aktualnego rozporządzenia w sprawie NDS i NDN, bo są okresowo zmieniane.
 * @type {Array<{ key: string, nazwa: string, rodzaj: string, jednostka: string, wartoscDopuszczalna: string, typoweStanowiska: string[], uwagi?: string }>}
 */
export const PL_CZYNNIKI = [
  {
    key: "pyl_krzemionka",
    nazwa: "Pył zawierający krystaliczną krzemionkę (frakcja respirabilna)",
    rodzaj: "rakotworczy",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "0,1",
    typoweStanowiska: ["Cięcie i szlifowanie betonu", "Rozbiórki", "Bruzdowanie", "Prace posadzkarskie"],
    uwagi: "Krzemionka krystaliczna z procesu pracy jest klasyfikowana jako czynnik rakotwórczy — obowiązuje rejestr prac i rejestr pracowników narażonych.",
  },
  {
    key: "pyl_drzewny",
    nazwa: "Pył drewna (w tym drewna twardego)",
    rodzaj: "rakotworczy",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "3,0",
    typoweStanowiska: ["Cięcie i obróbka drewna", "Stolarnia", "Konstrukcje drewniane"],
    uwagi: "Pył drewna twardego jest czynnikiem rakotwórczym — częstotliwość pomiarów jak dla czynników rakotwórczych.",
  },
  {
    key: "pyl_ogolny",
    nazwa: "Pyły niesklasyfikowane inaczej (frakcja wdychalna)",
    rodzaj: "pyl",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "10",
    typoweStanowiska: ["Prace wykończeniowe", "Szlifowanie gładzi", "Sprzątanie po pracach"],
  },
  {
    key: "halas",
    nazwa: "Hałas — poziom ekspozycji odniesiony do 8-godzinnego dobowego wymiaru czasu pracy",
    rodzaj: "halas",
    jednostka: "dB",
    wartoscDopuszczalna: "85",
    typoweStanowiska: ["Prace narzędziami udarowymi", "Zagęszczanie gruntu", "Hala produkcyjna", "Warsztat"],
    uwagi: "Próg działania to 80 dB — od niego pracodawca udostępnia ochronniki słuchu.",
  },
  {
    key: "drgania_miejscowe",
    nazwa: "Drgania mechaniczne o działaniu miejscowym (kończyny górne)",
    rodzaj: "drgania",
    jednostka: "m/s²",
    wartoscDopuszczalna: "2,8",
    typoweStanowiska: ["Młoty i wiertarki udarowe", "Szlifierki", "Zagęszczarki prowadzone ręcznie"],
  },
  {
    key: "drgania_ogolne",
    nazwa: "Drgania mechaniczne o działaniu ogólnym",
    rodzaj: "drgania",
    jednostka: "m/s²",
    wartoscDopuszczalna: "0,8",
    typoweStanowiska: ["Operatorzy maszyn budowlanych", "Kierowcy wozideł", "Operatorzy wózków jezdniowych"],
  },
  {
    key: "spaliny_diesla",
    nazwa: "Spaliny emitowane z silników Diesla (mierzone jako węgiel elementarny)",
    rodzaj: "rakotworczy",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "0,05",
    typoweStanowiska: ["Praca maszyn w wykopie", "Garaże i hale zamknięte", "Tunele"],
  },
  {
    key: "dymy_spawalnicze",
    nazwa: "Dymy spawalnicze — frakcja wdychalna",
    rodzaj: "rakotworczy",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "5,0",
    typoweStanowiska: ["Spawanie elektryczne", "Cięcie plazmowe", "Prace ślusarskie"],
    uwagi: "Dymy spawalnicze zostały sklasyfikowane jako czynnik rakotwórczy — objęte rejestrem prac.",
  },
  {
    key: "azbest_wlokna",
    nazwa: "Włókna azbestu",
    rodzaj: "azbest",
    jednostka: "wł./cm³",
    wartoscDopuszczalna: "0,1",
    typoweStanowiska: ["Demontaż pokryć azbestowych", "Rozbiórki obiektów z azbestem"],
    uwagi: "Pomiary co najmniej raz na 3 miesiące; obowiązuje rejestr pracowników narażonych.",
  },
  {
    key: "rozpuszczalniki",
    nazwa: "Rozpuszczalniki organiczne (mieszanina)",
    rodzaj: "chemiczny",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "wg karty charakterystyki",
    typoweStanowiska: ["Malowanie i lakierowanie", "Klejenie wykładzin", "Odtłuszczanie"],
  },
  {
    key: "wodorotlenek_sodu",
    nazwa: "Wodorotlenek sodu (ług) — aerozol",
    rodzaj: "chemiczny",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "0,5",
    typoweStanowiska: ["Mycie i dezynfekcja w strefie produkcyjnej", "Obieg CIP"],
  },
  {
    key: "amoniak",
    nazwa: "Amoniak",
    rodzaj: "chemiczny",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "14",
    typoweStanowiska: ["Maszynownia chłodnicza", "Serwis instalacji amoniakalnej"],
  },
  {
    key: "chlor",
    nazwa: "Chlor",
    rodzaj: "chemiczny",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "1,5",
    typoweStanowiska: ["Dezynfekcja podchlorynem", "Stacja uzdatniania wody"],
  },
  {
    key: "co",
    nazwa: "Tlenek węgla",
    rodzaj: "chemiczny",
    jednostka: "mg/m³",
    wartoscDopuszczalna: "23",
    typoweStanowiska: ["Prace w wykopach i pomieszczeniach zamkniętych", "Sprzęt spalinowy"],
  },
  {
    key: "mikroklimat_zimny",
    nazwa: "Mikroklimat zimny",
    rodzaj: "mikroklimat",
    jednostka: "wskaźnik IREQ",
    wartoscDopuszczalna: "wg oceny",
    typoweStanowiska: ["Chłodnie i mroźnie", "Prace zewnętrzne zimą"],
  },
  {
    key: "czynniki_biologiczne",
    nazwa: "Szkodliwe czynniki biologiczne (grupa 2 lub 3)",
    rodzaj: "biologiczny",
    jednostka: "—",
    wartoscDopuszczalna: "wg oceny narażenia",
    typoweStanowiska: ["Prace w kanalizacji", "Prace przy odpadach", "Oczyszczalnie ścieków"],
    uwagi: "Dla czynników biologicznych nie ustala się NDS — prowadzi się ocenę narażenia i rejestr prac.",
  },
];

const BY_KEY = Object.fromEntries(PL_CZYNNIKI.map((c) => [c.key, c]));

/** @param {string} key */
export function findCzynnik(key) {
  return BY_KEY[String(key || "")] || null;
}

/** Grupy czynników do filtrowania w bibliotece. */
export function listCzynnikRodzaje() {
  const used = new Set(PL_CZYNNIKI.map((c) => c.rodzaj));
  return CZYNNIK_RODZAJE.filter((r) => used.has(r.key));
}

/** Czynniki objęte rejestrem prac i rejestrem pracowników narażonych. */
export function czynnikWymagaRejestruNarazenia(rodzaj) {
  return rodzaj === "rakotworczy" || rodzaj === "azbest" || rodzaj === "biologiczny";
}

/**
 * Krotność wartości dopuszczalnej — podstawa całego harmonogramu pomiarów.
 * @param {number|string} wynik
 * @param {number|string} dopuszczalna
 * @returns {number|null} null, gdy którejkolwiek wartości nie da się odczytać liczbowo
 */
export function krotnosc(wynik, dopuszczalna) {
  // Number("") to zero, a nie NaN — bez tego pusty wynik udawałby pomiar w granicach
  // i wyliczałby termin kolejnego badania z niczego.
  const rawW = String(wynik ?? "").trim().replace(",", ".");
  const rawD = String(dopuszczalna ?? "").trim().replace(",", ".");
  if (!rawW || !rawD) return null;
  const w = Number(rawW);
  const d = Number(rawD);
  if (!Number.isFinite(w) || !Number.isFinite(d) || d <= 0) return null;
  return w / d;
}

/**
 * Odstęp do kolejnego pomiaru w miesiącach, wynikający z krotności i rodzaju czynnika.
 * Zwraca null, gdy krotności nie da się policzyć — wtedy termin ustala się ręcznie.
 * @param {string} rodzaj
 * @param {number|null} k krotność wartości dopuszczalnej
 * @returns {number|null}
 */
export function odstepPomiaruMiesiace(rodzaj, k) {
  if (k === null || !Number.isFinite(k)) return null;
  if (rodzaj === "azbest") {
    // Azbest ma własny rytm: co 3 miesiące, z możliwością wydłużenia do 6 przy niskich wynikach.
    return k > 0.5 ? 3 : 6;
  }
  if (rodzaj === "rakotworczy") {
    if (k > 0.5) return 3;
    if (k > 0.1) return 6;
    return 12;
  }
  if (k > 0.5) return 12;
  if (k > 0.1) return 24;
  // Poniżej 0,1 wartości dopuszczalnej przepis pozwala odstąpić od pomiarów przy dwóch
  // kolejnych takich wynikach — tu nadal proponujemy termin, decyzję o odstąpieniu
  // podejmuje pracodawca i zapisuje w uwagach.
  return 24;
}

/** Dodaje miesiące do daty ISO, bez zależności od strefy czasowej. */
function addMonthsIso(iso, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").slice(0, 10));
  if (!m) return "";
  const next = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  next.setMonth(next.getMonth() + Number(months || 0));
  const pad = (n) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/**
 * Pełna ocena wpisu: krotność, przekroczenie, termin kolejnego pomiaru i stan terminu.
 * @param {{ rodzaj?: string, wynik?: string|number, wartoscDopuszczalna?: string|number, dataPomiaru?: string, nastepnyPomiarRecznie?: string, odstapiono?: boolean }} row
 * @param {string} [today]
 */
export function ocenPomiar(row, today = todayLocalISO()) {
  const rodzaj = String(row?.rodzaj || "");
  const k = krotnosc(row?.wynik, row?.wartoscDopuszczalna);
  const przekroczenie = k !== null && k > 1;
  const odstep = odstepPomiaruMiesiace(rodzaj, k);
  const wyliczony = odstep === null ? "" : addMonthsIso(row?.dataPomiaru, odstep);
  const nastepny = String(row?.nastepnyPomiarRecznie || "").trim() || wyliczony;

  let status = "brak-terminu";
  let dni = null;
  if (row?.odstapiono) {
    status = "odstapiono";
  } else if (nastepny) {
    const a = new Date(`${today}T00:00:00`);
    const b = new Date(`${nastepny}T00:00:00`);
    dni = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (dni < 0) status = "po-terminie";
    else if (dni <= 30) status = "wkrotce";
    else status = "aktualny";
  }

  return {
    krotnosc: k,
    krotnoscLabel: k === null ? "—" : `${k.toFixed(2)} × wartości dopuszczalnej`,
    przekroczenie,
    odstepMiesiace: odstep,
    nastepnyPomiar: nastepny,
    dniDoPomiaru: dni,
    status,
    wymagaRejestruNarazenia: czynnikWymagaRejestruNarazenia(rodzaj),
  };
}

/** Podsumowanie rejestru — do nagłówka modułu i do alertów. */
export function podsumujRejestr(rows, today = todayLocalISO()) {
  const list = Array.isArray(rows) ? rows : [];
  let przekroczenia = 0;
  let poTerminie = 0;
  let wkrotce = 0;
  for (const row of list) {
    const ocena = ocenPomiar(row, today);
    if (ocena.przekroczenie) przekroczenia += 1;
    if (ocena.status === "po-terminie") poTerminie += 1;
    if (ocena.status === "wkrotce") wkrotce += 1;
  }
  return { total: list.length, przekroczenia, poTerminie, wkrotce };
}

/** Okres przechowywania rejestru i kart badań — pokazywany w module i na wydruku. */
export const OKRES_PRZECHOWYWANIA =
  "Rejestr czynników szkodliwych i karty badań i pomiarów przechowuje się przez 40 lat od daty ostatniego wpisu.";
