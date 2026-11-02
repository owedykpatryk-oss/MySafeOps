/** @vitest-environment jsdom */
import { expect, it, vi } from "vitest";
import { installWorkspaceStorageEvents } from "./workspaceStorageEvents";
import { ORG_CHANGED_EVENT } from "./orgId";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "./countryWorkspaces";

it("invalidates cross-tab organisation/country changes and ignores other organisations", () => {
  localStorage.setItem("mysafeops_orgId", "b");
  const org = vi.fn(); const country = vi.fn(); const commit = vi.fn((fn) => fn());
  window.addEventListener(ORG_CHANGED_EVENT, org);
  window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, country);
  const stop = installWorkspaceStorageEvents(commit);
  try {
    for (const key of ["mysafeops_orgId", "mysafeops_active_country_workspace_snapshot_b", "mysafeops_active_country_workspace_snapshot_other", "rams_builder_docs_b"])
      window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }));
    expect(org).toHaveBeenCalledTimes(1);
    expect(country).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent("storage", { key: null, storageArea: localStorage }));
    expect(org).toHaveBeenCalledTimes(2);
    expect(country).toHaveBeenCalledTimes(2);
  } finally {
    stop(); window.removeEventListener(ORG_CHANGED_EVENT, org); window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, country); localStorage.clear();
  }
});
