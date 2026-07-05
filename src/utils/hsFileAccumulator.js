/**
 * Health & Safety File inventory — auto-gather issued documents per project (CDM handover aid).
 */
import { filterByProject } from "./projectDashboard";

const RAMS_OK = new Set(["approved", "issued"]);
const PERMIT_OK = new Set(["active", "closed", "issued", "approved"]);

function row(title, type, id, status, updatedAt) {
  return {
    type,
    title: String(title || type).trim() || type,
    id: id || "",
    status: status || "",
    updatedAt: updatedAt || "",
  };
}

/**
 * @param {string} projectId
 * @param {Record<string, unknown[]>} [data]
 */
export function buildHealthSafetyFileInventory(projectId, data = {}) {
  if (!projectId) return { items: [], counts: {}, total: 0 };

  const items = [];

  for (const doc of filterByProject(projectId, data.rams || [])) {
    const status = String(doc.documentStatus || doc.status || "draft").toLowerCase();
    if (!RAMS_OK.has(status)) continue;
    items.push(
      row(doc.title || doc.documentNo, "RAMS", doc.id, status, doc.updatedAt || doc.createdAt)
    );
  }

  for (const p of filterByProject(projectId, data.permits || [])) {
    const status = String(p.status || "draft").toLowerCase();
    if (!PERMIT_OK.has(status)) continue;
    items.push(row(p.description || p.type || "Permit", "PTW", p.id, status, p.updatedAt || p.createdAt));
  }

  for (const ms of filterByProject(projectId, data.methodStatements || [])) {
    items.push(row(ms.title, "Method statement", ms.id, ms.status, ms.updatedAt || ms.createdAt));
  }

  for (const s of filterByProject(projectId, data.surveys || [])) {
    items.push(row(s.title || s.jobRef, "Survey report", s.id, s.status, s.updatedAt || s.createdAt));
  }

  for (const c of filterByProject(projectId, data.cdmPacks || [])) {
    items.push(row(c.projectTitle || "CDM pack", "CDM / CPP", c.id, c.status, c.updatedAt || c.createdAt));
  }

  for (const b of filterByProject(projectId, data.dailyBriefings || [])) {
    items.push(row(b.location || "Daily briefing", "Briefing", b.id, b.date, b.createdAt));
  }

  for (const i of filterByProject(projectId, data.inspections || [])) {
    items.push(row(i.name || i.type, "Inspection", i.id, i.result, i.inspectedAt || i.createdAt));
  }

  items.sort((a, b) => {
    const ta = new Date(a.updatedAt || 0).getTime();
    const tb = new Date(b.updatedAt || 0).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  const counts = items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});

  return { items, counts, total: items.length };
}
