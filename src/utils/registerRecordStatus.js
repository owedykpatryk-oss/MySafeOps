/** Calendar-day deadlines: a record due today is not overdue. */
export function daysUntilRegisterDue(value, now = new Date()) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(date) - day(now)) / 86400000);
}

/** Compare the inventory, preserving duplicate quantities but ignoring entry order. */
export function highCareToolsMatch(row) {
  const tools = (value) => String(value || "").split(",").map((s) => s.trim()).filter(Boolean).sort();
  const incoming = tools(row?.toolsIn);
  const outgoing = tools(row?.toolsOut);
  return incoming.length === outgoing.length && incoming.every((tool, index) => tool === outgoing[index]);
}

export function cipPassedSwabCount(row) {
  return (row?.swabResults || []).filter((swab) => swab.pass === true).length;
}
