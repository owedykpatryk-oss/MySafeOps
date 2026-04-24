import { orgScopedKey, getOrgId } from "./orgStorage";
import { supabase } from "../lib/supabase";
import { d1AppendServerAudit, isD1Configured } from "../lib/d1SyncClient";

const MAX = 500;

const auditStorageKey = () => orgScopedKey("mysafeops_audit");

function mirrorAuditToD1(row) {
  if (!isD1Configured() || !supabase) return;
  const org = getOrgId();
  if (!org || org === "default") return;
  void d1AppendServerAudit(supabase, org, row).catch(() => {});
}

export function pushAudit(entry) {
  const row = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(auditStorageKey()) || "[]");
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.unshift(row);
  localStorage.setItem(auditStorageKey(), JSON.stringify(list.slice(0, MAX)));
  if (typeof queueMicrotask === "function") {
    queueMicrotask(() => mirrorAuditToD1(row));
  } else {
    setTimeout(() => mirrorAuditToD1(row), 0);
  }
  return row;
}

export function readAudit() {
  try {
    const list = JSON.parse(localStorage.getItem(auditStorageKey()) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearAudit() {
  localStorage.removeItem(auditStorageKey());
}
