/**
 * FESS RAMS template library — browse/search MC reference jobs and PDFs.
 */
import { FESS_JOB_STARTERS, getFessJobStarter, listFessJobStarters } from "./fessJobStarters";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { FESS_CLIENT_SITE_TEMPLATES } from "./fessClientSites";

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/**
 * @returns {Array<{
 *   id: string,
 *   type: "starter" | "reference_pdf",
 *   label: string,
 *   client: string,
 *   siteHint: string,
 *   jobRefPrefix: string,
 *   starterKey: string,
 *   sourceFile?: string,
 *   searchText: string,
 * }>}
 */
export function buildFessRamsTemplateCatalog() {
  if (!canUseFessExclusiveFeatures()) return [];
  const catalog = [];

  for (const starter of FESS_JOB_STARTERS) {
    const searchBits = [
      starter.label,
      starter.client,
      starter.siteHint,
      starter.title,
      starter.jobRefPrefix,
      ...(starter.hazardTokens || []),
      ...(starter.sourceFiles || []),
    ];
    catalog.push({
      id: starter.key,
      type: "starter",
      label: starter.label,
      client: starter.client,
      siteHint: starter.siteHint,
      jobRefPrefix: starter.jobRefPrefix,
      starterKey: starter.key,
      sourceFileCount: (starter.sourceFiles || []).length,
      searchText: searchBits.join(" ").toLowerCase(),
    });

    for (const file of starter.sourceFiles || []) {
      const fileSlug = slug(file);
      catalog.push({
        id: `${starter.key}__${fileSlug}`,
        type: "reference_pdf",
        label: file.replace(/\.pdf$/i, ""),
        client: starter.client,
        siteHint: starter.siteHint,
        jobRefPrefix: starter.jobRefPrefix,
        starterKey: starter.key,
        sourceFile: file,
        searchText: [file, starter.label, starter.client, starter.siteHint].join(" ").toLowerCase(),
      });
    }
  }

  return catalog;
}

/**
 * @param {string} [query]
 * @param {{ client?: string, siteHint?: string, type?: string }} [filters]
 */
export function searchFessRamsTemplates(query = "", filters = {}) {
  const q = String(query || "").trim().toLowerCase();
  const clientFilter = String(filters.client || "").trim().toLowerCase();
  const siteFilter = String(filters.siteHint || "").trim().toLowerCase();
  const typeFilter = String(filters.type || "").trim();

  return buildFessRamsTemplateCatalog().filter((entry) => {
    if (typeFilter && entry.type !== typeFilter) return false;
    if (clientFilter && !entry.client.toLowerCase().includes(clientFilter)) return false;
    if (siteFilter && !entry.siteHint.toLowerCase().includes(siteFilter)) return false;
    if (q && !entry.searchText.includes(q)) return false;
    return true;
  });
}

/** Unique clients from catalog. */
export function listFessTemplateClients() {
  return [...new Set(FESS_JOB_STARTERS.map((s) => s.client))].sort();
}

/** Site hints mapped to FESS site template ids. */
export function listFessTemplateSiteFilters() {
  return FESS_CLIENT_SITE_TEMPLATES.map((t) => ({
    siteTemplateId: t.id,
    label: t.name,
    client: t.client,
    suggestedStarterKey: t.suggestedJobStarterKey,
  }));
}

/**
 * Resolve starter key from template library entry id.
 * @param {string} templateId
 */
export function resolveFessTemplateStarterKey(templateId) {
  const id = String(templateId || "").trim();
  if (!id) return "";
  if (getFessJobStarter(id)) return id;
  const entry = buildFessRamsTemplateCatalog().find((e) => e.id === id);
  return entry?.starterKey || "";
}

/**
 * Summary stats for UI header.
 */
export function getFessTemplateLibraryStats() {
  const starters = listFessJobStarters();
  const pdfCount = starters.reduce((n, s) => n + (s.sourceFiles || []).length, 0);
  return {
    starterCount: starters.length,
    referencePdfCount: pdfCount,
    siteCount: FESS_CLIENT_SITE_TEMPLATES.length,
    clientCount: listFessTemplateClients().length,
  };
}
