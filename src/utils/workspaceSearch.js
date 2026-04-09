import { loadOrgScoped as load } from "./orgStorage";
import { MORE_TABS, NAV_TAB_IDS } from "../navigation/appModules";
import { PERMIT_TYPES } from "../modules/permits/permitTypes";

function normaliseQ(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** @typedef {{ key: string, kind: string, label: string, subtitle?: string, viewId: string, permitId?: string }} WorkspaceSearchHit */

/**
 * Build flat search hits for workspace command palette (modules + local data).
 * @param {string} rawQuery
 * @returns {WorkspaceSearchHit[]}
 */
export function buildWorkspaceSearchHits(rawQuery) {
  const q = normaliseQ(rawQuery);
  if (!q) return [];

  /** @type {WorkspaceSearchHit[]} */
  const hits = [];

  const moduleIds = new Set();
  for (const t of NAV_TAB_IDS) {
    if (t.id === "more") continue;
    moduleIds.add(t.id);
    const label = (t.label || "").toLowerCase();
    const id = t.id.toLowerCase().replace(/-/g, " ");
    if (label.includes(q) || id.includes(q)) {
      hits.push({
        key: `mod-${t.id}`,
        kind: "Open",
        label: t.label,
        subtitle: "Screen",
        viewId: t.id,
      });
    }
  }
  for (const t of MORE_TABS) {
    if (moduleIds.has(t.id)) continue;
    const label = (t.label || "").toLowerCase();
    const id = t.id.toLowerCase().replace(/-/g, " ");
    if (label.includes(q) || id.includes(q)) {
      hits.push({
        key: `mod-${t.id}`,
        kind: "Open",
        label: t.label,
        subtitle: "Screen",
        viewId: t.id,
      });
    }
  }

  const dataQueryMin = 2;
  if (q.length < dataQueryMin) {
    hits.sort((a, b) => (a.label > b.label ? 1 : a.label < b.label ? -1 : 0));
    return hits;
  }

  const workers = load("mysafeops_workers", []);
  workers.forEach((w) => {
    const blob = [w.name, w.email, w.role].filter(Boolean).join(" ").toLowerCase();
    if (blob.includes(q)) {
      hits.push({
        key: `w-${w.id}`,
        kind: "Worker",
        label: w.name || "Unnamed worker",
        subtitle: w.email || w.role || "Workers",
        viewId: "workers",
      });
    }
  });

  const projects = load("mysafeops_projects", []);
  projects.forEach((p) => {
    const blob = [p.name, p.address, p.site].filter(Boolean).join(" ").toLowerCase();
    if (blob.includes(q)) {
      hits.push({
        key: `p-${p.id}`,
        kind: "Project",
        label: p.name || "Unnamed project",
        subtitle: p.address || "Projects / timesheets",
        viewId: "workers",
      });
    }
  });

  const rams = load("rams_builder_docs", []);
  rams.forEach((r) => {
    const blob = [r.title, r.jobRef, r.location, r.leadEngineer].filter(Boolean).join(" ").toLowerCase();
    if (blob.includes(q)) {
      hits.push({
        key: `r-${r.id}`,
        kind: "RAMS",
        label: r.title || "Untitled RAMS",
        subtitle: [r.jobRef, r.location].filter(Boolean).join(" · ") || "RAMS builder",
        viewId: "rams",
      });
    }
  });

  const permits = load("permits_v2", []);
  permits.forEach((p) => {
    const typeLabel = (PERMIT_TYPES[p.type] || PERMIT_TYPES.general)?.label || "";
    const blob = [p.location, p.description, p.issuedTo, p.issuedBy, p.type, typeLabel, p.linkedRamsId, p.status, p.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (blob.includes(q)) {
      hits.push({
        key: `ptw-${p.id}`,
        kind: "Permit",
        label: p.description?.slice(0, 72) || p.type || "Permit",
        subtitle: [p.location, p.issuedTo].filter(Boolean).join(" · ") || "Permits",
        viewId: "permits",
        permitId: p.id,
      });
    }
  });

  const snags = load("snags", []);
  snags.forEach((s) => {
    const blob = [s.title, s.description, s.siteName, s.location].filter(Boolean).join(" ").toLowerCase();
    if (blob.includes(q)) {
      hits.push({
        key: `s-${s.id}`,
        kind: "Snag",
        label: s.title || s.description?.slice(0, 60) || "Snag",
        subtitle: s.siteName || s.location || "Snags",
        viewId: "snags",
      });
    }
  });

  const kindOrder = { Open: 0, Worker: 1, Project: 2, RAMS: 3, Permit: 4, Snag: 5 };
  hits.sort((a, b) => {
    const ko = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
    if (ko !== 0) return ko;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });

  return hits.slice(0, 80);
}
