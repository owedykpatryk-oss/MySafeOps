/** Route scanned codes to induction instead of the last workspace view. */
export function buildInductionLink(baseUrl, siteId, orgId) {
  const url = new URL(baseUrl);
  url.searchParams.set("view", "induction");
  url.searchParams.set("site", String(siteId));
  url.searchParams.set("org", String(orgId));
  return url.href;
}
