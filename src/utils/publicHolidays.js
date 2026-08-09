/**
 * Public holidays per market, computed rather than listed.
 *
 * A hardcoded table goes stale every January and nobody notices until a crew is planned to
 * work on Boxing Day. Everything here is derived from the year: fixed dates, nth-weekday
 * rules and Easter.
 *
 * Scope is deliberately national. Australian state holidays (Labour Day, King's Birthday,
 * show days) differ by state and cannot be inferred from the market alone — those stay a
 * manual entry on the team.
 */

const pad = (value) => String(value).padStart(2, "0");
const iso = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/** Meeus/Jones/Butcher algorithm for the Gregorian calendar. */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

function shiftIso(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function weekdayOf(isoDate) {
  return new Date(`${isoDate}T12:00:00`).getDay();
}

/** The nth given weekday of a month; pass -1 for the last one. */
function nthWeekday(year, month, weekday, nth) {
  if (nth < 0) {
    const lastDay = new Date(year, month, 0).getDate();
    for (let day = lastDay; day > 0; day -= 1) {
      if (weekdayOf(iso(year, month, day)) === weekday) return iso(year, month, day);
    }
    return "";
  }
  let seen = 0;
  for (let day = 1; day <= 31; day += 1) {
    const candidate = iso(year, month, day);
    if (new Date(`${candidate}T12:00:00`).getMonth() + 1 !== month) break;
    if (weekdayOf(candidate) === weekday) {
      seen += 1;
      if (seen === nth) return candidate;
    }
  }
  return "";
}

/**
 * UK and AU move a holiday that lands on a weekend to the next working day; where two
 * holidays sit together (Christmas, Boxing Day) they take the next two.
 */
function substitute(dates, taken) {
  return dates.map((entry) => {
    const day = weekdayOf(entry.date);
    if (day !== 0 && day !== 6) {
      taken.add(entry.date);
      return entry;
    }
    let moved = shiftIso(entry.date, day === 6 ? 2 : 1);
    while (taken.has(moved) || weekdayOf(moved) === 0 || weekdayOf(moved) === 6) {
      moved = shiftIso(moved, 1);
    }
    taken.add(moved);
    return { ...entry, date: moved, substitute: true };
  });
}

function ukHolidays(year) {
  const easter = easterSunday(year);
  const taken = new Set();
  const fixedEarly = substitute([{ date: iso(year, 1, 1), name: "New Year's Day" }], taken);
  const moveable = [
    { date: shiftIso(easter, -2), name: "Good Friday" },
    { date: shiftIso(easter, 1), name: "Easter Monday" },
    { date: nthWeekday(year, 5, 1, 1), name: "Early May bank holiday" },
    { date: nthWeekday(year, 5, 1, -1), name: "Spring bank holiday" },
    { date: nthWeekday(year, 8, 1, -1), name: "Summer bank holiday" },
  ];
  moveable.forEach((entry) => taken.add(entry.date));
  const christmas = substitute(
    [
      { date: iso(year, 12, 25), name: "Christmas Day" },
      { date: iso(year, 12, 26), name: "Boxing Day" },
    ],
    taken,
  );
  return [...fixedEarly, ...moveable, ...christmas];
}

function auHolidays(year) {
  const easter = easterSunday(year);
  const taken = new Set();
  const early = substitute(
    [
      { date: iso(year, 1, 1), name: "New Year's Day" },
      { date: iso(year, 1, 26), name: "Australia Day" },
    ],
    taken,
  );
  const moveable = [
    { date: shiftIso(easter, -2), name: "Good Friday" },
    { date: shiftIso(easter, 1), name: "Easter Monday" },
    // Anzac Day is not substituted in most states, so it simply falls where it falls.
    { date: iso(year, 4, 25), name: "Anzac Day" },
  ];
  moveable.forEach((entry) => taken.add(entry.date));
  const christmas = substitute(
    [
      { date: iso(year, 12, 25), name: "Christmas Day" },
      { date: iso(year, 12, 26), name: "Boxing Day" },
    ],
    taken,
  );
  return [...early, ...moveable, ...christmas];
}

function plHolidays(year) {
  const easter = easterSunday(year);
  // Poland does not move a holiday off a weekend. A holiday falling on a Saturday entitles
  // employees to another day off, but the employer picks the date, so it cannot be computed.
  return [
    { date: iso(year, 1, 1), name: "Nowy Rok" },
    { date: iso(year, 1, 6), name: "Trzech Króli" },
    { date: easter, name: "Wielkanoc" },
    { date: shiftIso(easter, 1), name: "Poniedziałek Wielkanocny" },
    { date: iso(year, 5, 1), name: "Święto Pracy" },
    { date: iso(year, 5, 3), name: "Święto Konstytucji 3 Maja" },
    { date: shiftIso(easter, 49), name: "Zielone Świątki" },
    { date: shiftIso(easter, 60), name: "Boże Ciało" },
    { date: iso(year, 8, 15), name: "Wniebowzięcie NMP" },
    { date: iso(year, 11, 1), name: "Wszystkich Świętych" },
    { date: iso(year, 11, 11), name: "Święto Niepodległości" },
    { date: iso(year, 12, 25), name: "Boże Narodzenie" },
    { date: iso(year, 12, 26), name: "Drugi dzień Bożego Narodzenia" },
  ];
}

const BUILDERS = { uk: ukHolidays, au: auHolidays, pl: plHolidays };

/**
 * @param {"uk"|"au"|"pl"} marketId
 * @param {number} year
 * @returns {{date: string, name: string, substitute?: boolean}[]} sorted by date
 */
export function publicHolidays(marketId, year) {
  const build = BUILDERS[marketId] || BUILDERS.uk;
  if (!Number.isInteger(year)) return [];
  return build(year)
    .filter((entry) => entry.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Holidays between two ISO dates, spanning year boundaries.
 *
 * @param {"uk"|"au"|"pl"} marketId
 * @param {string} fromIso
 * @param {string} toIso
 */
export function publicHolidaysBetween(marketId, fromIso, toIso) {
  const from = String(fromIso || "").slice(0, 10);
  const to = String(toIso || "").slice(0, 10);
  if (!from || !to || to < from) return [];
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4));
  const rows = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    rows.push(...publicHolidays(marketId, year).filter((entry) => entry.date >= from && entry.date <= to));
  }
  return rows;
}
