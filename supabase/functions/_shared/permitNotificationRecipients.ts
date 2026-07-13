// Keep in sync with src/utils/permitNotificationRecipients.js

export function normalizePersonKey(v: unknown) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "")
    .trim();
}

export function stripRoleFromLabel(v: unknown) {
  const text = String(v || "");
  const idx = text.indexOf(" — ");
  return idx >= 0 ? text.slice(0, idx).trim() : text.trim();
}

export function normalizeEmail(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

export function buildRosterLinkedEmailSet(
  permit: { issuedTo?: unknown; issuedBy?: unknown },
  roster: Array<{ name?: unknown; email?: unknown }> = []
) {
  const who = [permit?.issuedTo, permit?.issuedBy]
    .map(stripRoleFromLabel)
    .filter(Boolean)
    .map(normalizePersonKey);
  const emails = new Set<string>();
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
