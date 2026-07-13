export function normalizePersonKey(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "")
    .trim();
}

export function stripRoleFromLabel(v) {
  const text = String(v || "");
  const idx = text.indexOf(" — ");
  return idx >= 0 ? text.slice(0, idx).trim() : text.trim();
}

export function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * Worker roster emails that match the permit holder or issuer by name.
 * Used server-side to allow field-worker notifications without an open relay.
 */
export function buildRosterLinkedEmailSet(permit, roster = []) {
  const who = [permit?.issuedTo, permit?.issuedBy]
    .map(stripRoleFromLabel)
    .filter(Boolean)
    .map(normalizePersonKey);
  const emails = new Set();
  if (!who.length) return emails;
  for (const worker of roster) {
    const workerName = normalizePersonKey(worker?.name);
    const email = normalizeEmail(worker?.email);
    if (workerName && who.includes(workerName) && email.includes("@")) {
      emails.add(email);
    }
  }
  return emails;
}

export function isPermitNotificationRecipientAllowed(email, { memberAllowlist, rosterLinked }) {
  const e = normalizeEmail(email);
  if (!e.includes("@")) return false;
  if (memberAllowlist.has(e)) return true;
  if (rosterLinked?.has(e)) return true;
  return false;
}
