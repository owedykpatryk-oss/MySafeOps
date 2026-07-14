/**
 * Lightweight register stats for More module tiles (local org storage).
 */
import { loadOrgScoped, getOrgId } from "./orgStorage";
import { MODULE_PDF_REGISTRY } from "../navigation/moduleCatalogMeta";
import { MORE_SECTIONS, MORE_TABS } from "../navigation/appModules";
import { todayIsoDate } from "./projectDashboard";

export const HSE_SECTION_TITLE = "Health, safety & environment";
export const SITE_SECTION_TITLE = "Site operations";

const LABEL_BY_ID = Object.fromEntries(MORE_TABS.map((t) => [t.id, t.label]));

export function getSectionModuleIds(sectionTitle) {
  const section = MORE_SECTIONS.find((s) => s.title === sectionTitle);
  return section?.ids || [];
}

export function getHseModuleIds() {
  return getSectionModuleIds(HSE_SECTION_TITLE);
}

export function getModuleLabel(moduleId) {
  return LABEL_BY_ID[moduleId] || moduleId;
}

/** Placeholder before idle HSE stats scan on the dashboard. */
export function emptyHseDashboardSummary() {
  const moduleIds = getHseModuleIds();
  return {
    summary: { healthScore: 0, records: 0, tracked: 0, empty: 0, active: 0, attention: 0 },
    statsMap: {},
    attentionModules: [],
    emptyModules: [],
    moduleIds,
  };
}

/** Dashboard-ready HSE summary with attention module list. */
export function buildHseDashboardSummary() {
  const ids = getHseModuleIds();
  const statsMap = getRegisterStatsMap(ids);
  const summary = summarizeSectionStats(statsMap, ids);

  const attentionModules = ids
    .filter((id) => statsMap[id]?.status === "attention")
    .map((id) => ({
      id,
      label: getModuleLabel(id),
      attentionCount: statsMap[id].attentionCount,
      count: statsMap[id].count,
    }))
    .sort((a, b) => b.attentionCount - a.attentionCount);

  const emptyModules = ids
    .filter((id) => statsMap[id]?.status === "empty")
    .map((id) => ({ id, label: getModuleLabel(id) }));

  return { summary, statsMap, attentionModules, emptyModules, moduleIds: ids };
}

const DATE_KEYS = [
  "dueDate",
  "expiryDate",
  "nextInspection",
  "deadline",
  "certExpiry",
  "reviewDate",
  "validUntil",
  "inspectedAt",
  "testDate",
  "assessedDate",
  "inspectionDate",
  "motDue",
  "insuranceExpiry",
  "nextServiceDue",
  "taxDue",
  "signedOffAt",
];

const ATTENTION_STATUSES = new Set(["open", "pending", "overdue", "expired", "draft", "action_required", "reported"]);

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function itemTimestamp(item) {
  for (const k of ["updatedAt", "createdAt", "recordedAt", "occurredAt", "checkedAt", "date", "surveyDate", "openedAt"]) {
    const d = parseDate(item[k]);
    if (d) return d.getTime();
  }
  return 0;
}

export function itemNeedsAttention(item) {
  if (!item || typeof item !== "object") return false;
  const st = String(item.status || "").toLowerCase();
  if (ATTENTION_STATUSES.has(st)) return true;
  if (st.includes("overdue") || st.includes("expir")) return true;
  for (const k of DATE_KEYS) {
    const d = parseDate(item[k]);
    if (d && d < new Date()) return true;
  }
  return false;
}

/** @type {Record<string, (items: object[]) => { attentionCount: number } | null>} */
const MODULE_STAT_HANDLERS = {
  "daily-briefing": (items) => {
    const today = todayIsoDate();
    const todayRows = items.filter((b) => String(b.date || "").slice(0, 10) === today);
    let attentionCount = 0;
    if (items.length > 0 && todayRows.length === 0) attentionCount += 1;
    todayRows.forEach((b) => {
      const present = (b.attendees || []).filter((a) => a.present);
      if (present.some((a) => !a.sig)) attentionCount += 1;
    });
    return { attentionCount };
  },
  training: (items) => {
    const now = new Date();
    let attentionCount = 0;
    items.forEach((row) => {
      const d = parseDate(row.expiryDate || row.certExpiry || row.validUntil);
      if (d && d < now) attentionCount += 1;
      else if (d) {
        const days = Math.ceil((d - now) / 86400000);
        if (days <= 30) attentionCount += 1;
      }
    });
    return { attentionCount };
  },
  inspections: (items) => {
    const now = new Date();
    let attentionCount = 0;
    items.forEach((row) => {
      const d = parseDate(row.nextInspection || row.nextInspectionDate || row.dueDate);
      if (d && d < now) attentionCount += 1;
      else if (d) {
        const days = Math.ceil((d - now) / 86400000);
        if (days <= 14) attentionCount += 1;
      }
    });
    return { attentionCount };
  },
  incidents: (items) => {
    let attentionCount = 0;
    items.forEach((row) => {
      const st = String(row.status || "").toLowerCase();
      if (st === "open" || st === "reported" || st === "investigating") attentionCount += 1;
    });
    return { attentionCount };
  },
};

function buildSparklineFromItems(items, days = 7) {
  const buckets = Array(days).fill(0);
  const bucketDates = [];
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    bucketDates.push(d.toISOString().slice(0, 10));
  }
  for (const item of items) {
    const ts = itemTimestamp(item);
    if (!ts) continue;
    const diffDays = Math.floor((now - ts) / 86400000);
    if (diffDays >= 0 && diffDays < days) buckets[days - 1 - diffDays] += 1;
  }
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return { buckets, max: Math.max(...buckets, 1), total, bucketDates };
}

/** @returns {{ moduleId: string, count: number|null, attentionCount: number, status: 'empty'|'active'|'attention'|'unknown', lastUpdated: string|null, sparkline: { buckets: number[], max: number, total: number } | null }} */
export function getModuleRegisterStat(moduleId) {
  const cfg = MODULE_PDF_REGISTRY[moduleId];
  if (!cfg) {
    return { moduleId, count: null, attentionCount: 0, status: "unknown", lastUpdated: null, sparkline: null };
  }

  const data = loadOrgScoped(cfg.key, []);
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) {
    return { moduleId, count: 0, attentionCount: 0, status: "empty", lastUpdated: null, sparkline: null };
  }
  let attentionCount = 0;
  let lastTs = 0;

  const custom = MODULE_STAT_HANDLERS[moduleId]?.(items);
  if (custom) {
    attentionCount = custom.attentionCount;
  }

  items.forEach((item) => {
    if (!custom && itemNeedsAttention(item)) attentionCount += 1;
    lastTs = Math.max(lastTs, itemTimestamp(item));
  });

  const count = items.length;
  let status = "empty";
  if (count > 0) status = attentionCount > 0 ? "attention" : "active";

  return {
    moduleId,
    count,
    attentionCount,
    status,
    lastUpdated: lastTs ? new Date(lastTs).toISOString() : null,
    sparkline: buildSparklineFromItems(items),
  };
}

let cachedStatsKey = "";
/** @type {Record<string, ReturnType<typeof getModuleRegisterStat>> | null} */
let cachedStatsMap = null;

export function invalidateRegisterStatsCache() {
  cachedStatsKey = "";
  cachedStatsMap = null;
}

export function getRegisterStatsMap(moduleIds) {
  const ids = moduleIds || [];
  const key = `${getOrgId()}:${ids.join(",")}`;
  if (cachedStatsMap && cachedStatsKey === key) {
    return cachedStatsMap;
  }
  /** @type {Record<string, ReturnType<typeof getModuleRegisterStat>>} */
  const map = {};
  ids.forEach((id) => {
    map[id] = getModuleRegisterStat(id);
  });
  cachedStatsKey = key;
  cachedStatsMap = map;
  return map;
}

export function summarizeSectionStats(statsMap, moduleIds) {
  let empty = 0;
  let active = 0;
  let attention = 0;
  let tracked = 0;
  let records = 0;

  (moduleIds || []).forEach((id) => {
    const s = statsMap[id];
    if (!s || s.count === null) return;
    tracked += 1;
    records += s.count;
    if (s.status === "empty") empty += 1;
    else if (s.status === "attention") attention += 1;
    else if (s.status === "active") active += 1;
  });

  const healthScore = tracked ? Math.round(((active + attention * 0.45) / tracked) * 100) : 0;

  return { tracked, empty, active, attention, records, healthScore };
}

export function filterTabsByRegisterStat(tabs, statsMap, filter) {
  if (!filter || filter === "all") return tabs;
  return tabs.filter((t) => {
    const s = statsMap[t.id];
    if (!s || s.count === null) return false;
    if (filter === "empty") return s.status === "empty";
    if (filter === "attention") return s.status === "attention";
    if (filter === "active") return s.status === "active";
    return true;
  });
}

const STATUS_SORT = { attention: 0, empty: 1, active: 2, unknown: 9 };

export function sortTabsByRegisterPriority(tabs, statsMap) {
  return [...tabs].sort((a, b) => {
    const sa = statsMap[a.id]?.status || "unknown";
    const sb = statsMap[b.id]?.status || "unknown";
    const diff = (STATUS_SORT[sa] ?? 9) - (STATUS_SORT[sb] ?? 9);
    if (diff !== 0) return diff;
    const ca = statsMap[a.id]?.count ?? 0;
    const cb = statsMap[b.id]?.count ?? 0;
    if (ca !== cb) return ca - cb;
    return a.label.localeCompare(b.label);
  });
}

export function formatRegisterRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function registerStatMetaLine(stat) {
  if (!stat || stat.count === null) return "";
  if (stat.status === "empty") return "No records yet";
  const parts = [`${stat.count} record${stat.count === 1 ? "" : "s"}`];
  if (stat.attentionCount > 0) parts.push(`${stat.attentionCount} need attention`);
  const rel = formatRegisterRelativeTime(stat.lastUpdated);
  if (rel) parts.push(rel);
  return parts.join(" · ");
}
