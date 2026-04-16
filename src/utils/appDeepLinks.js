/**
 * Workspace SPA lives at `/app`; primary nav uses the `view` query param.
 * @param {string} viewId
 * @param {Record<string, string | number | null | undefined>} [extra] — merged into query (e.g. permitId)
 */
export function workspaceDeepLink(viewId, extra = {}) {
  const q = new URLSearchParams({ view: String(viewId || "dashboard") });
  Object.entries(extra).forEach(([k, v]) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    q.set(k, s);
  });
  return `/app?${q.toString()}`;
}
