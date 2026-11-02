const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Legacy object paths belong to the primary workspace. New country paths are explicit. */
export function storageScope(key) {
  const parts = String(key || "").split("/");
  const orgs = parts.filter((part) => /^org_[\w-]+$/.test(part));
  if (orgs.length !== 1) return null;
  const orgPart = orgs[0];
  const next = parts[parts.indexOf(orgPart) + 1] || "";
  const countryId = next.startsWith("country_") ? next.slice(8) : null;
  if (countryId !== null && !UUID.test(countryId)) return null;
  const orgSlug = orgPart.slice(4);
  return { orgSlug, countryId, dataKey: countryId ? `country:${countryId}:main` : "main", id: `${orgSlug}:${countryId || "main"}` };
}
