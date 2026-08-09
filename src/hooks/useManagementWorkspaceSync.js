import { useEffect, useMemo, useRef, useState } from "react";

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

const RETRY_BASE_MS = 2000;
const MAX_RETRY_MS = 60000;
const MAX_RETRY_STEP = 6;

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
  /** Consecutive failed writes — drives the retry backoff and the "unsaved" wording. */
  const retryRef = useRef(0);

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

    let cancelled = false;
    let timer = 0;
    /**
     * Normalising and serialising the whole document is O(document), and the document now
     * carries archived meetings and a change log. Doing it per keystroke made typing in the
     * meeting notes progressively heavier, so it happens once the typing has settled.
     */
    let next = null;

    const scheduleRetry = () => {
      if (cancelled) return;
      // Back off 2s, 4s, 8s… capped at a minute. Without this a single failed write left the
      // change stranded in localStorage until the manager happened to edit something else.
      retryRef.current = Math.min(retryRef.current + 1, MAX_RETRY_STEP);
      const delay = Math.min(RETRY_BASE_MS * 2 ** (retryRef.current - 1), MAX_RETRY_MS);
      timer = window.setTimeout(save, delay);
    };

    const save = async () => {
      if (cancelled) return;
      if (!next) {
        next = normaliseManagementState(state);
        if (JSON.stringify(next) === syncRef.current.serialised) return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus((current) => ({ ...current, phase: "error", message: "Offline — unsaved changes will retry" }));
        scheduleRetry();
        return;
      }
      const { orgId, workspaceId, version } = syncRef.current;
      setStatus((current) => ({ ...current, phase: "saving", message: "Saving shared changes…" }));
      const { data, error } = await supabase
        .from("management_workspaces")
        .update({ state: next, updated_by: userId })
        .eq("workspace_id", workspaceId)
        .eq("version", version)
        .select("org_id,workspace_id,state,version,updated_at,updated_by")
        .maybeSingle();
      if (cancelled) return;

      if (error) {
        const attempt = retryRef.current + 1;
        setStatus((current) => ({
          ...current,
          phase: "error",
          message: `${error.message || "Shared save failed"} — unsaved, retrying (${attempt})`,
        }));
        scheduleRetry();
        return;
      }
      retryRef.current = 0;
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
    };

    timer = window.setTimeout(save, 900);

    // Coming back online, or back to the tab, is the moment a stranded write can land.
    const retryNow = () => {
      if (cancelled || !retryRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 200);
    };
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", retryNow);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", retryNow);
    };
  }, [enabled, state, setState, supabase, userId]);

  // `currentUserId` lets the UI say "last edit by you" instead of showing a raw user id.
  return useMemo(() => ({ ...status, currentUserId: userId }), [status, userId]);
}
