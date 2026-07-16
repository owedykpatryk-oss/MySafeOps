/** Org slug in localStorage — no billing or membership imports (breaks audit/storage cycles). */

export const ORG_ID_KEY = "mysafeops_orgId";
export const ORG_CHANGED_EVENT = "mysafeops-org-changed";

export function getOrgId() {
  if (typeof localStorage === "undefined") return "default";
  return localStorage.getItem(ORG_ID_KEY) || "default";
}

export function setOrgId(orgId) {
  const next = String(orgId || "").trim() || "default";
  localStorage.setItem(ORG_ID_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ORG_CHANGED_EVENT, { detail: { orgId: next } }));
  }
}

export function orgScopedKey(baseKey) {
  return `${baseKey}_${getOrgId()}`;
}
