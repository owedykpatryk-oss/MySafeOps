/**
 * D1 KV namespace write policy — keep in sync with Supabase RPC user_can_write_org_kv.
 * Admin/supervisor: any valid namespace. Operative: operational namespaces only.
 */

/** @type {ReadonlySet<string>} */
export const D1_ADMIN_ONLY_WRITE_NAMESPACES = new Set([
  "mysafeops_workers",
  "mysafeops_projects",
  "training_matrix",
  "cdm_packs",
  "mysafeops_timesheets",
]);

const NAMESPACE_RE = /^[a-zA-Z0-9_.-]{1,128}$/;

export function isValidD1Namespace(namespace) {
  const ns = String(namespace || "").trim();
  return ns.length > 0 && NAMESPACE_RE.test(ns);
}

/**
 * @param {string | null | undefined} role
 * @param {string} namespace
 */
export function canRoleWriteD1Namespace(role, namespace) {
  const ns = String(namespace || "").trim();
  if (!isValidD1Namespace(ns)) return false;
  const r = String(role || "").toLowerCase();
  if (r === "admin" || r === "supervisor") return true;
  if (r === "operative") return !D1_ADMIN_ONLY_WRITE_NAMESPACES.has(ns);
  return false;
}
