import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const KEY = "permit_recent_history_v1";
const MAX = 12;

function normalizeRow(permit) {
  if (!permit?.id) return null;
  return {
    id: String(permit.id),
    type: String(permit.type || "general"),
    location: String(permit.location || "").trim(),
    projectId: String(permit.projectId || "").trim(),
    issuedTo: String(permit.issuedTo || "").trim(),
    issuedBy: String(permit.issuedBy || "").trim(),
    linkedRamsId: String(permit.linkedRamsId || "").trim(),
    at: permit.updatedAt || permit.createdAt || new Date().toISOString(),
  };
}

export function listPermitRecentHistory() {
  const rows = load(KEY, []);
  return Array.isArray(rows) ? rows.slice(0, MAX) : [];
}

export function pushPermitRecentHistory(permit) {
  const row = normalizeRow(permit);
  if (!row) return;
  const prev = listPermitRecentHistory().filter((x) => x.id !== row.id);
  save(KEY, [row, ...prev].slice(0, MAX));
}

export function recentPermitsFromHistory(permits = [], limit = 12) {
  const history = listPermitRecentHistory();
  const byId = new Map((permits || []).map((p) => [p.id, p]));
  const out = [];
  history.forEach((h) => {
    const full = byId.get(h.id);
    if (full) out.push(full);
  });
  if (out.length < limit) {
    (permits || []).forEach((p) => {
      if (out.length >= limit) return;
      if (!out.some((x) => x.id === p.id)) out.push(p);
    });
  }
  return out.slice(0, limit);
}

export function formatRecentPermitAge(iso, now = new Date()) {
  if (!iso) return "";
  const diff = now.getTime() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export function buildRepeatPermitDraft(source, { sameTypeNewLocation = false, newLocation = "" } = {}) {
  if (!source) return null;
  const copy = JSON.parse(JSON.stringify(source));
  const location = sameTypeNewLocation
    ? String(newLocation || "").trim() || copy.location
    : copy.location;
  return {
    ...copy,
    id: undefined,
    status: "draft",
    closedAt: undefined,
    approvedAt: undefined,
    activatedAt: undefined,
    suspendedAt: undefined,
    shareToken: undefined,
    auditLog: [],
    versionHistory: [],
    notificationLog: [],
    workflow: { state: "draft", history: [] },
    signatures: [],
    location,
    createdAt: new Date().toISOString(),
    startDateTime: new Date().toISOString(),
  };
}
