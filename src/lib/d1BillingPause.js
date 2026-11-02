import { isBillingWriteBlocked } from "../utils/billingAccess.js";
import { getOrgId } from "../utils/orgId.js";
import { getCachedActiveCountryWorkspace } from "../utils/countryWorkspaces.js";

const pauses = new Map();
const scopeOf = (key) => /^country:([0-9a-f-]{36}):/i.exec(key || "")?.[1]?.toLowerCase() || "main";
const keyOf = (base, org, key, authorization) => JSON.stringify([base, org, scopeOf(key), authorization]);
export function billingWritePause(base, org, key, authorization, now = Date.now()) {
  const active = getCachedActiveCountryWorkspace(org);
  const activeKey = active?.id && !active.is_primary ? `country:${active.id}:main` : "main";
  if (org === getOrgId() && scopeOf(key) === scopeOf(activeKey) && isBillingWriteBlocked())
    return { ok: false, error: "billing_write_blocked", paused: true };
  const entryKey = keyOf(base, org, key, authorization),
    entry = pauses.get(entryKey);
  if (!entry) return null;
  if (entry.until <= now) {
    pauses.delete(entryKey);
    return null;
  }
  return { ...entry.result, paused: true, retry_after_ms: entry.until - now };
}
export function rememberBillingWriteDenial(base, org, key, authorization, result, now = Date.now()) {
  if (result.error !== "billing_write_blocked") return result;
  for (const [id, entry] of pauses) if (entry.until <= now) pauses.delete(id);
  pauses.set(keyOf(base, org, key, authorization), { org, scope: scopeOf(key), result, until: now + 60000 });
  return result;
}
export function clearBillingWritePause(org, key) {
  for (const [id, entry] of pauses) if (entry.org === org && entry.scope === scopeOf(key)) pauses.delete(id);
}
export function resetBillingWritePausesForTests() {
  pauses.clear();
}
