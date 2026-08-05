import { useEffect, useRef, useState } from "react";

import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { getOrgId, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import {
  COUNTRY_WORKSPACE_CHANGED_EVENT,
  getCachedActiveCountryWorkspace,
} from "../utils/countryWorkspaces";
import {
  mergeManagementStates,
  normaliseManagementState,
  saveManagementState,
} from "../utils/managementOverview";

const initialStatus = {
  phase: "local",
  updatedAt: "",
  updatedBy: "",
  message: "Saved on this device",
};

export function useManagementWorkspaceSync({ enabled, state, setState }) {
  const { supabase, user, ready: authReady } = useSupabaseAuth();
  const userId = user?.id || "";
  const [status, setStatus] = useState(initialStatus);
  const [orgEpoch, setOrgEpoch] = useState(0);
  const stateRef = useRef(state);
  const syncRef = useRef({ ready: false, orgId: "", workspaceId: "", version: 0, serialised: "" });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const handleOrgChange = () => setOrgEpoch((value) => value + 1);
    window.addEventListener(ORG_CHANGED_EVENT, handleOrgChange);
    // The document is per country, so a country switch must re-point the sync the same
    // way an organisation switch does.
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, handleOrgChange);
    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, handleOrgChange);
      window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, handleOrgChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !authReady || !supabase || !userId) {
      syncRef.current = { ready: false, orgId: "", workspaceId: "", version: 0, serialised: "" };
      setStatus(initialStatus);
      return undefined;
    }

    let cancelled = false;
    let channel = null;

    const applyRemote = (row, { mergeLocal = false } = {}) => {
      if (!row || cancelled) return;
      const remote = normaliseManagementState(row.state);
      const local = stateRef.current;
      const localIsDirty = syncRef.current.serialised
        && JSON.stringify(normaliseManagementState(local)) !== syncRef.current.serialised;
      const next = mergeLocal || localIsDirty ? mergeManagementStates(remote, local) : remote;
      syncRef.current = {
        ready: true,
        orgId: row.org_id,
        workspaceId: row.workspace_id,
        version: Number(row.version) || 1,
        serialised: JSON.stringify(remote),
      };
      setState(next);
      saveManagementState(next);
      setStatus({
        phase: mergeLocal || localIsDirty ? "merging" : "synced",
        updatedAt: row.updated_at || "",
        updatedBy: row.updated_by || "",
        message: mergeLocal || localIsDirty ? "Changes merged — saving" : "Shared workspace up to date",
      });
    };

    const fetchWorkspace = async (workspaceId) => {
      const { data, error } = await supabase
        .from("management_workspaces")
        .select("org_id,workspace_id,state,version,updated_at,updated_by")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    const initialise = async () => {
      setStatus({ ...initialStatus, phase: "loading", message: "Loading shared workspace…" });
      const slug = getOrgId();
      if (!slug || slug === "default") throw new Error("Organisation is not ready for cloud sync.");

      const country = getCachedActiveCountryWorkspace(slug);
      if (!country?.id) throw new Error("Select a country workspace to share management planning.");

      const { data: organisation, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (orgError) throw orgError;
      if (!organisation?.id) throw new Error("Organisation could not be resolved.");

      let row = await fetchWorkspace(country.id);
      if (!row) {
        const initialState = normaliseManagementState(stateRef.current);
        const { data: created, error: createError } = await supabase
          .from("management_workspaces")
          .insert({ org_id: organisation.id, workspace_id: country.id, state: initialState, updated_by: userId })
          .select("org_id,workspace_id,state,version,updated_at,updated_by")
          .maybeSingle();
        if (createError && createError.code !== "23505") throw createError;
        row = created || await fetchWorkspace(country.id);
      }
      if (!row) throw new Error("Shared management workspace is unavailable.");
      applyRemote(row);

      channel = supabase
        .channel(`management-workspace:${country.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "management_workspaces", filter: `workspace_id=eq.${country.id}` },
          (payload) => {
            const incoming = payload.new;
            if (!incoming?.version || Number(incoming.version) <= syncRef.current.version) return;
            applyRemote(incoming);
          }
        )
        .subscribe();
    };

    initialise().catch((error) => {
      if (cancelled) return;
      setStatus({ ...initialStatus, phase: "error", message: error?.message || "Cloud sync unavailable" });
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, authReady, supabase, userId, orgEpoch, setState]);

  useEffect(() => {
    if (!enabled || !syncRef.current.ready || !supabase || !userId) return undefined;
    const next = normaliseManagementState(state);
    const serialised = JSON.stringify(next);
    if (serialised === syncRef.current.serialised) return undefined;

    const timer = window.setTimeout(async () => {
      const { orgId, workspaceId, version } = syncRef.current;
      setStatus((current) => ({ ...current, phase: "saving", message: "Saving shared changes…" }));
      const { data, error } = await supabase
        .from("management_workspaces")
        .update({ state: next, updated_by: userId })
        .eq("workspace_id", workspaceId)
        .eq("version", version)
        .select("org_id,workspace_id,state,version,updated_at,updated_by")
        .maybeSingle();

      if (error) {
        setStatus((current) => ({ ...current, phase: "error", message: error.message || "Shared save failed" }));
        return;
      }
      if (!data) {
        const { data: latest, error: latestError } = await supabase
          .from("management_workspaces")
          .select("org_id,workspace_id,state,version,updated_at,updated_by")
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (latestError || !latest) {
          setStatus((current) => ({ ...current, phase: "error", message: "A newer version exists; refresh required" }));
          return;
        }
        const merged = mergeManagementStates(latest.state, next);
        syncRef.current = { ready: true, orgId, workspaceId, version: Number(latest.version), serialised: JSON.stringify(normaliseManagementState(latest.state)) };
        setState(merged);
        saveManagementState(merged);
        setStatus({ phase: "merging", updatedAt: latest.updated_at || "", updatedBy: latest.updated_by || "", message: "Concurrent changes merged — saving" });
        return;
      }

      syncRef.current = {
        ready: true,
        orgId,
        workspaceId,
        version: Number(data.version),
        serialised: JSON.stringify(normaliseManagementState(data.state)),
      };
      setStatus({ phase: "synced", updatedAt: data.updated_at || "", updatedBy: data.updated_by || "", message: "Shared workspace up to date" });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [enabled, state, setState, supabase, userId]);

  return status;
}
