const formatters = new Map();
export function localIso(value, zone) {
  if (!formatters.has(zone))
    formatters.set(
      zone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    );
  const p = Object.fromEntries(
    formatters
      .get(zone)
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function zonedToUtc(value, zone, occurrence = "") {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || "")) throw new Error("Choose a valid date and time.");
  const base = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(base)) throw new Error("Choose a valid date and time.");
  const offsets = new Set(
    [-36, -12, 0, 12, 36].map((h) => {
      const sample = base + h * 3600000;
      return Date.parse(`${localIso(sample, zone)}:00Z`) - sample;
    })
  );
  const candidates = [...offsets]
    .map((offset) => base - offset)
    .filter((t) => localIso(t, zone) === value)
    .sort((a, b) => a - b);
  if (!candidates.length) throw new Error(`This local time does not exist in ${zone}.`);
  const choice = occurrence === "BST" ? "earlier" : occurrence === "GMT" ? "later" : occurrence;
  if (candidates.length > 1 && !["earlier", "later"].includes(choice))
    throw new Error(`This local time is ambiguous in ${zone}: choose the earlier or later occurrence.`);
  return new Date(choice === "later" ? candidates.at(-1) : candidates[0]).toISOString();
}
