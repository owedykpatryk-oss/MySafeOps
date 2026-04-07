const MAX = 500;

const getOrgId = () => localStorage.getItem("mysafeops_orgId") || "default";
const key = () => `mysafeops_audit_${getOrgId()}`;

export function pushAudit(entry) {
  const row = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(key()) || "[]");
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.unshift(row);
  localStorage.setItem(key(), JSON.stringify(list.slice(0, MAX)));
  return row;
}

export function readAudit() {
  try {
    const list = JSON.parse(localStorage.getItem(key()) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearAudit() {
  localStorage.removeItem(key());
}
