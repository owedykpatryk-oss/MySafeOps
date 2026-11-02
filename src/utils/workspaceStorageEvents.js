import { getOrgId, ORG_CHANGED_EVENT, ORG_ID_KEY } from "./orgId";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "./countryWorkspaces";

/** Bridge native cross-tab changes to the same invalidation used by the switcher. */
export function installWorkspaceStorageEvents(commit = (fn) => fn()) {
  const handle = (event) => {
    if (event.storageArea && event.storageArea !== localStorage) return;
    const orgChanged = event.key === null || event.key === ORG_ID_KEY;
    const countryChanged = event.key === null
      || event.key === `mysafeops_active_country_workspace_${getOrgId()}`
      || event.key === `mysafeops_active_country_workspace_snapshot_${getOrgId()}`;
    if (!orgChanged && !countryChanged) return;
    commit(() => {
      if (orgChanged) window.dispatchEvent(new CustomEvent(ORG_CHANGED_EVENT, { detail: { orgId: getOrgId() } }));
      if (countryChanged) window.dispatchEvent(new CustomEvent(COUNTRY_WORKSPACE_CHANGED_EVENT));
    });
  };
  window.addEventListener("storage", handle);
  return () => window.removeEventListener("storage", handle);
}
