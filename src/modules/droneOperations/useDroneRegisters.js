import { useEffect, useState } from "react";
import { loadOrgScoped, saveOrgScoped, getOrgId, ORG_DATA_CHANGED_EVENT } from "../../utils/orgStorage.js";
import { getCachedActiveCountryWorkspace } from "../../utils/countryWorkspaces.js";
import { d1GetKv, isD1Configured } from "../../lib/d1SyncClient.js";
import { supabase } from "../../lib/supabase.js";

const KEYS = {
  projects: "mysafeops_projects",
  workers: "mysafeops_workers",
  assets: "plant_register",
  rams: "rams_builder_docs",
  documents: "mysafeops_r2_uploads",
};
export function loadDroneRegisters() {
  return Object.fromEntries(
    Object.entries(KEYS).map(([name, key]) => [name, loadOrgScoped(key, []).filter((r) => !r.deletedAt)])
  );
}
export async function readStoredDroneMissions() {
  const org = getOrgId(),
    country = getCachedActiveCountryWorkspace();
  const key = country?.id && !country.is_primary ? `country:${country.id}:main` : "main";
  const result = await d1GetKv(supabase, org, "drone_missions", key);
  if (getOrgId() !== org || getCachedActiveCountryWorkspace()?.id !== country?.id)
    throw new Error("Workspace changed; reopen the mission.");
  return result;
}
export async function refreshDroneRegisters() {
  if (!isD1Configured()) return loadDroneRegisters();
  const org = getOrgId(),
    country = getCachedActiveCountryWorkspace();
  const key = country?.id && !country.is_primary ? `country:${country.id}:main` : "main";
  const rows = await Promise.all(
    Object.entries(KEYS).map(async ([name, ns]) => {
      const result = await d1GetKv(supabase, org, ns, key);
      if (!result?.ok) throw new Error("Could not refresh linked register.");
      if (getOrgId() !== org || getCachedActiveCountryWorkspace()?.id !== country?.id)
        throw new Error("Workspace changed; reopen the mission.");
      const value = Array.isArray(result?.value) ? result.value : [];
      saveOrgScoped(ns, value, { bypassBillingGuard: true });
      return [name, value.filter((r) => !r.deletedAt)];
    })
  );
  return Object.fromEntries(rows);
}
export function useDroneRegisters() {
  const [registers, setRegisters] = useState(loadDroneRegisters);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const read = () => setRegisters(loadDroneRegisters());
    window.addEventListener(ORG_DATA_CHANGED_EVENT, read);
    refreshDroneRegisters()
      .then((r) => {
        if (alive) setRegisters(r);
      })
      .catch(() => {
        if (alive) setError("Linked registers could not be refreshed. Reconnect before approval.");
      });
    return () => {
      alive = false;
      window.removeEventListener(ORG_DATA_CHANGED_EVENT, read);
    };
  }, []);
  return { registers, setRegisters, registerError: error };
}
