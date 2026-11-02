/** Date-only values are calendar dates; timestamps use the publisher's timezone. */
export function formatPublicationDate(iso, snapshot = {}, time = false) {
  if (!iso) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const value = !dateOnly && /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(iso) ? `${iso}Z` : iso;
  const options = {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: dateOnly ? "UTC" : snapshot.timeZone || "UTC",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return new Intl.DateTimeFormat(snapshot.locale || "en-GB", options).format(new Date(value));
}
