/**
 * Per-org dashboard widget visibility and order (localStorage).
 * Pins (More menu) stay separate — see pinnedModules.js.
 */

const STORAGE_KEY = "mysafeops_dashboard_layout_v1";

export const DASHBOARD_WIDGETS = [
  { id: "workplace_today", label: "Workplace today", default: true },
  { id: "action_needed", label: "Action needed", default: true },
  { id: "project_hub", label: "Project hub", default: true },
  { id: "project_command_center", label: "Project command center", default: true },
  { id: "overview_metrics", label: "Overview metrics", default: true },
  { id: "compliance", label: "Compliance & certs", default: true },
  { id: "charts", label: "Charts row", default: true },
  { id: "projects_today", label: "Sites & projects", default: true },
  { id: "shortcuts", label: "Role shortcuts", default: true },
  { id: "getting_started", label: "Getting started", default: true },
  { id: "reminders", label: "Reminders", default: true },
];

export const DEFAULT_WIDGET_ORDER = DASHBOARD_WIDGETS.map((w) => w.id);

const DEFAULT_VISIBILITY = Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.id, w.default]));

export function normalizeDashboardLayout(raw) {
  if (raw?.visibility && Array.isArray(raw.order)) {
    const visibility = { ...DEFAULT_VISIBILITY, ...raw.visibility };
    const known = new Set(DASHBOARD_WIDGETS.map((w) => w.id));
    const order = [
      ...raw.order.filter((id) => known.has(id)),
      ...DEFAULT_WIDGET_ORDER.filter((id) => !raw.order.includes(id)),
    ];
    return { visibility, order };
  }
  if (raw && typeof raw === "object" && !raw.visibility) {
    return {
      visibility: { ...DEFAULT_VISIBILITY, ...raw },
      order: [...DEFAULT_WIDGET_ORDER],
    };
  }
  return { visibility: { ...DEFAULT_VISIBILITY }, order: [...DEFAULT_WIDGET_ORDER] };
}

export function loadDashboardLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeDashboardLayout(null);
    return normalizeDashboardLayout(JSON.parse(raw));
  } catch {
    return normalizeDashboardLayout(null);
  }
}

export function saveDashboardLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDashboardLayout(layout)));
  } catch {
    /* quota */
  }
}

export function isWidgetVisible(layout, id) {
  const norm = normalizeDashboardLayout(layout);
  if (norm.visibility[id] === undefined) return DEFAULT_VISIBILITY[id] !== false;
  return Boolean(norm.visibility[id]);
}

export function getWidgetOrder(layout) {
  return normalizeDashboardLayout(layout).order;
}

export function reorderWidget(layout, dragId, dropId) {
  const norm = normalizeDashboardLayout(layout);
  const order = [...norm.order];
  const from = order.indexOf(dragId);
  const to = order.indexOf(dropId);
  if (from < 0 || to < 0 || from === to) return norm;
  order.splice(from, 1);
  order.splice(to, 0, dragId);
  return { ...norm, order };
}

export function moveWidgetInOrder(layout, id, direction) {
  const norm = normalizeDashboardLayout(layout);
  const order = [...norm.order];
  const idx = order.indexOf(id);
  if (idx < 0) return norm;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= order.length) return norm;
  [order[idx], order[swap]] = [order[swap], order[idx]];
  return { ...norm, order };
}

export function setWidgetVisible(layout, id, visible) {
  const norm = normalizeDashboardLayout(layout);
  return { ...norm, visibility: { ...norm.visibility, [id]: Boolean(visible) } };
}
