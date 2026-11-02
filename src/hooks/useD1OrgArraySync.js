import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getOrgId, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { supabase } from "../lib/supabase";
import { d1GetKv, d1PutKv, isD1Configured, isD1RateLimitedError, isD1TransientError } from "../lib/d1SyncClient";
import {
  clearD1WriteForbidden,
  isForbiddenD1Write,
  notifyD1WriteForbidden,
} from "../lib/d1WriteForbidden.js";
import {
  d1OutboxDelete,
  d1OutboxPeek,
  d1OutboxArchiveConflict,
  d1OutboxEnqueue,
  d1OutboxHasRecovery,
  d1OutboxHasPending,
  d1OutboxTryFlush,
} from "../lib/d1SyncOutbox.js";
import { D1_OUTBOX_MANUAL_RETRY_EVENT } from "../lib/d1OutboxRetryEvent.js";
import { mergeOrgArrays } from "../utils/d1ArrayMerge.js";
import { COUNTRY_WORKSPACE_CHANGED_EVENT, getCachedActiveCountryWorkspace } from "../utils/countryWorkspaces.js";

const transient = (e) => isD1TransientError(e);

function activeCountryDataKey(d1DataKey) {
  const country = getCachedActiveCountryWorkspace();
  return country?.id && !country.is_primary ? `country:${country.id}:${d1DataKey}` : d1DataKey;
}

function activeSyncScope(namespace, d1DataKey) {
  return `${getOrgId()}|${namespace}|${activeCountryDataKey(d1DataKey)}`;
}

/**
 * Hydrate an org-scoped JSON array from D1 (when VITE_D1_API_URL + Supabase + org), keep localStorage as cache,
 * debounced PUT with optimistic versioning, 409 → refetch from server. Failed PUTs (after retries) are stored in
 * IndexedDB and replayed on next successful hydration, `online`, periodic retry while pending, or
 * `requestD1OutboxManualRetry()` / event `D1_OUTBOX_MANUAL_RETRY_EVENT` (see `src/lib/d1OutboxRetryEvent.js`).
 *
 * @param {object} p
 * @param {string} p.storageKey – orgStorage key (e.g. "method_statements")
 * @param {string} p.namespace – D1 KV namespace (often same as storageKey)
 * @param {string} [p.d1DataKey="main"]
 * @param {Array} p.value – current array state
 * @param {function} p.setValue – React setState for the array
 * @param {function} p.load – loadOrgScoped(base, fallback)
 * @param {function} p.save – saveOrgScoped(base, value)
 * @param {number} [p.debounceMs=1500]
 * @param {(value: Array) => Array} [p.serializeForSync] – slim payload before D1 PUT/outbox (local state unchanged)
 * @returns {{ d1Ready: boolean, d1Hydrating: boolean, d1OutboxPending: boolean, d1Syncing: boolean }}
 */
export function useD1OrgArraySync({
  storageKey,
  namespace,
  d1DataKey = "main",
  value,
  setValue,
  load,
  save,
  debounceMs = 1500,
  serializeForSync = null,
}) {
  const countryDataKey = activeCountryDataKey(d1DataKey);
  const toSyncValue = useCallback((arr) => {
    if (typeof serializeForSync !== "function") return arr;
    try {
      return serializeForSync(arr);
    } catch {
      return arr;
    }
  }, [serializeForSync]);
  const [d1Ready, setD1Ready] = useState(() => !isD1Configured());
  const [d1OrgEpoch, setD1OrgEpoch] = useState(0);
  const [d1OutboxPending, setD1OutboxPending] = useState(false);
  const d1VersionRef = useRef(0);
  const d1ConflictBlockedRef = useRef(false);
  const d1DebounceRef = useRef(null);
  const scopeRef = useRef("");
  const renderScope = `${getOrgId()}|${namespace}|${countryDataKey}`;
  const valueScopeRef = useRef(renderScope);
  const ownsRenderedValue = valueScopeRef.current === renderScope;
  scopeRef.current = ownsRenderedValue ? renderScope : "";

  // Callers may pass inline closures; hydration must not re-run (and re-fetch) on every render.
  const loadRef = useRef(load);
  const saveRef = useRef(save);
  const setValueRef = useRef(setValue);
  const toSyncRef = useRef(toSyncValue);
  loadRef.current = load;
  saveRef.current = save;
  setValueRef.current = setValue;
  toSyncRef.current = toSyncValue;

  // Another tab can change storage before its storage event is delivered. Never
  // attach the previous React state to the newly observed destination scope.
  useLayoutEffect(() => {
    if (ownsRenderedValue) return;
    valueScopeRef.current = renderScope;
    d1VersionRef.current = 0;
    d1ConflictBlockedRef.current = false;
    setValueRef.current(loadRef.current(storageKey, []));
    setD1Ready(!isD1Configured());
    setD1OutboxPending(false);
    setD1OrgEpoch((n) => n + 1);
  }, [ownsRenderedValue, renderScope, storageKey]);

  useEffect(() => {
    // Persist before a PDF export, reload or mobile backgrounding can read stale rows.
    // Only cloud writes are debounced; local evidence must be durable immediately.
    if (!ownsRenderedValue || activeSyncScope(namespace, d1DataKey) !== renderScope) return;
    saveRef.current(storageKey, value);
  }, [storageKey, value, renderScope, namespace, d1DataKey, ownsRenderedValue]);

  useEffect(() => {
    const onOrgChange = () => {
      // Invalidate callbacks synchronously, before React renders/cleans up effects.
      scopeRef.current = "";
      valueScopeRef.current = activeSyncScope(namespace, d1DataKey);
      d1VersionRef.current = 0;
      d1ConflictBlockedRef.current = false;
      setValueRef.current(loadRef.current(storageKey, []));
      setD1Ready(!isD1Configured());
      setD1OutboxPending(false);
      setD1OrgEpoch((n) => n + 1);
    };
    const onCountryChange = () => {
      // Billing/label refreshes also emit this event; only reset on a data-scope change.
      if (scopeRef.current !== activeSyncScope(namespace, d1DataKey)) onOrgChange();
    };
    window.addEventListener(ORG_CHANGED_EVENT, onOrgChange);
    window.addEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onCountryChange);
    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, onOrgChange);
      window.removeEventListener(COUNTRY_WORKSPACE_CHANGED_EVENT, onCountryChange);
    };
  }, [storageKey, namespace, d1DataKey]);

  useEffect(() => {
    let cancelled = false;
    const scope = scopeRef.current;
    (async () => {
      if (!isD1Configured()) {
        if (!cancelled) setD1OutboxPending(false);
        return;
      }
      const orgSlug = getOrgId();
      if (!orgSlug || orgSlug === "default") {
        if (!cancelled) setD1OutboxPending(false);
        return;
      }
      const p = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      if (!cancelled && scopeRef.current === scope && activeSyncScope(namespace, d1DataKey) === scope) setD1OutboxPending(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [d1OrgEpoch, namespace, countryDataKey, d1DataKey]);

  useEffect(() => {
    if (!isD1Configured() || !supabase) {
      setD1Ready(true);
      return;
    }
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") {
      setD1Ready(true);
      return;
    }
    let cancelled = false;
    const scope = scopeRef.current;
    const isCurrent = () => !cancelled && scopeRef.current === scope && activeSyncScope(namespace, d1DataKey) === scope;
    const flushCtxBase = () => ({
      supabase,
      orgSlug,
      namespace,
      d1DataKey: countryDataKey,
      storageKey,
      setValue: setValueRef.current,
      save: saveRef.current,
      versionRef: d1VersionRef,
      isCurrent,
    });
    const refreshPending = async () => {
      const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      if (isCurrent()) setD1OutboxPending(still);
    };
    (async () => {
      // A recovery archive means the list needs human resolution. Reopening the
      // module must not merge it away or upload it using a freshly fetched version.
      let hasRecovery;
      try {
        hasRecovery = await d1OutboxHasRecovery(orgSlug, namespace, countryDataKey);
      } catch {
        // If recovery storage cannot be read, keep this list local for this session.
        hasRecovery = true;
      }
      if (!isCurrent()) return;
      d1ConflictBlockedRef.current = hasRecovery;
      /** @type {{ ok: boolean; error?: string; request_id?: string; retry_after_ms?: number }} */
      let r = { ok: false };
      const delaysMs = [0, 1200, 2800];
      for (let i = 0; i < delaysMs.length; i++) {
        if (!isCurrent()) return;
        if (delaysMs[i] > 0) await new Promise((res) => setTimeout(res, delaysMs[i]));
        if (!isCurrent()) return;
        try {
          r = await d1GetKv(supabase, orgSlug, namespace, countryDataKey);
        } catch {
          r = { ok: false, error: "fetch_failed" };
        }
        if (!isCurrent()) return;
        if (r.ok) break;
        // Do not stampede the Worker — one longer wait, one retry, then local cache.
        if (isD1RateLimitedError(r.error)) {
          const waitMs = Math.min(Number(r.retry_after_ms) || 20_000, 60_000);
          await new Promise((res) => setTimeout(res, waitMs));
          if (!isCurrent()) return;
          try {
            r = await d1GetKv(supabase, orgSlug, namespace, countryDataKey);
          } catch {
            r = { ok: false, error: "fetch_failed" };
          }
          break;
        }
      }
      if (!isCurrent()) return;
      if (!r.ok) {
        d1VersionRef.current = 0;
        if (!d1ConflictBlockedRef.current) {
          const result = await d1OutboxTryFlush(flushCtxBase());
          if (isCurrent() && result === "conflict_saved") d1ConflictBlockedRef.current = true;
        }
        await refreshPending();
        if (isCurrent()) setD1Ready(true);
        return;
      }
      d1VersionRef.current = r.version || 0;
      if (Array.isArray(r.value)) {
        const local = loadRef.current(storageKey, []);
        const pending = await d1OutboxPeek(orgSlug, namespace, countryDataKey);
        if (!isCurrent()) return;
        if (d1ConflictBlockedRef.current || pending) {
          setValueRef.current(local);
        } else {
          const merged = mergeOrgArrays(local, r.value);
          setValueRef.current(merged);
          saveRef.current(storageKey, merged);
        }
        if (!d1ConflictBlockedRef.current) {
          const result = await d1OutboxTryFlush(flushCtxBase());
          if (isCurrent() && result === "conflict_saved") d1ConflictBlockedRef.current = true;
        }
        await refreshPending();
        if (isCurrent()) setD1Ready(true);
        return;
      }
      const local = loadRef.current(storageKey, []);
      setValueRef.current(local);
      if (local.length > 0 && !d1ConflictBlockedRef.current) {
        let put;
        try {
          put = await d1PutKv(supabase, orgSlug, namespace, countryDataKey, toSyncRef.current(local), 0);
        } catch {
          put = { ok: false, error: "fetch_failed" };
        }
        if (!isCurrent()) return;
        if (put.ok) d1VersionRef.current = put.version || 0;
        else if (isForbiddenD1Write(put.error)) notifyD1WriteForbidden(namespace, put.error);
      }
      if (!d1ConflictBlockedRef.current) {
        const result = await d1OutboxTryFlush(flushCtxBase());
        if (isCurrent() && result === "conflict_saved") d1ConflictBlockedRef.current = true;
      }
      await refreshPending();
      if (isCurrent()) setD1Ready(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [d1OrgEpoch, storageKey, namespace, countryDataKey, d1DataKey]);

  useEffect(() => {
    if (!d1Ready) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    let cancelled = false;
    const scope = scopeRef.current;
    const flushCtxBase = () => ({
      supabase,
      orgSlug,
      namespace,
      d1DataKey: countryDataKey,
      storageKey,
      setValue: setValueRef.current,
      save: saveRef.current,
      versionRef: d1VersionRef,
      isCurrent: () => !cancelled && scopeRef.current === scope && activeSyncScope(namespace, d1DataKey) === scope,
    });
    const runFlush = async () => {
      if (d1ConflictBlockedRef.current) return;
      const result = await d1OutboxTryFlush(flushCtxBase());
      if (flushCtxBase().isCurrent() && result === "conflict_saved") d1ConflictBlockedRef.current = true;
      const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      if (flushCtxBase().isCurrent()) setD1OutboxPending(still);
    };
    const onOnline = () => {
      void runFlush();
    };
    const onManualRetry = () => {
      void runFlush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener(D1_OUTBOX_MANUAL_RETRY_EVENT, onManualRetry);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener(D1_OUTBOX_MANUAL_RETRY_EVENT, onManualRetry);
    };
  }, [d1Ready, namespace, countryDataKey, storageKey, d1OrgEpoch, d1DataKey]);

  useEffect(() => {
    if (!d1Ready || !d1OutboxPending) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    let cancelled = false;
    const scope = scopeRef.current;
    const flushCtxBase = () => ({
      supabase,
      orgSlug,
      namespace,
      d1DataKey: countryDataKey,
      storageKey,
      setValue: setValueRef.current,
      save: saveRef.current,
      versionRef: d1VersionRef,
      isCurrent: () => !cancelled && scopeRef.current === scope && activeSyncScope(namespace, d1DataKey) === scope,
    });
    const id = window.setInterval(async () => {
      if (d1ConflictBlockedRef.current) return;
      const result = await d1OutboxTryFlush(flushCtxBase());
      if (flushCtxBase().isCurrent() && result === "conflict_saved") d1ConflictBlockedRef.current = true;
      const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      if (flushCtxBase().isCurrent()) setD1OutboxPending(still);
    }, 45_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [d1Ready, d1OutboxPending, namespace, countryDataKey, storageKey, d1OrgEpoch, d1DataKey]);

  useEffect(() => {
    if (!d1Ready) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    let cancelled = false;
    const scope = scopeRef.current;
    const isCurrent = () => !cancelled && scopeRef.current === scope && activeSyncScope(namespace, d1DataKey) === scope;
    if (d1DebounceRef.current) clearTimeout(d1DebounceRef.current);
    d1DebounceRef.current = setTimeout(async () => {
      if (d1ConflictBlockedRef.current) return;
      const v = d1VersionRef.current;
      const useVersion = v >= 0 ? v : 0;
      const syncPayload = toSyncRef.current(value);
      const queuedAtStart = await d1OutboxPeek(orgSlug, namespace, countryDataKey);
      if (!isCurrent() || d1ConflictBlockedRef.current) return;
      let put;
      try {
        put = await d1PutKv(supabase, orgSlug, namespace, countryDataKey, syncPayload, useVersion);
      } catch {
        put = { ok: false, error: "fetch_failed" };
      }
      if (!put.ok && transient(put.error)) {
        await new Promise((res) => setTimeout(res, 900));
        if (!isCurrent() || d1ConflictBlockedRef.current) return;
        try {
          put = await d1PutKv(supabase, orgSlug, namespace, countryDataKey, syncPayload, useVersion);
        } catch {
          put = { ok: false, error: "fetch_failed" };
        }
      }
      if (!isCurrent()) return;
      if (put.ok) {
        d1VersionRef.current = put.version || 0;
        clearD1WriteForbidden();
        await d1OutboxDelete(orgSlug, namespace, countryDataKey, queuedAtStart);
        const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
        if (isCurrent()) setD1OutboxPending(still);
      } else if (put.error === "version_conflict") {
        let r;
        try {
          r = await d1GetKv(supabase, orgSlug, namespace, countryDataKey);
        } catch {
          r = { ok: false };
        }
        if (!isCurrent()) return;
        if (r.ok && Array.isArray(r.value)) {
          try {
            await d1OutboxArchiveConflict({ orgSlug, namespace, d1DataKey: countryDataKey, value: syncPayload, clientVersion: v }, r);
          } catch {
            // Do not replace local edits when their recovery copy cannot be saved.
            return;
          }
          // The server has diverged. Keep the editor and its local cache intact;
          // adopting the server version would let the next edit overwrite remote work.
          d1ConflictBlockedRef.current = true;
        }
      } else if (isForbiddenD1Write(put.error)) {
        try {
          await d1OutboxEnqueue({ orgSlug, namespace, d1DataKey: countryDataKey, value: syncPayload, clientVersion: v });
          if (isCurrent()) setD1OutboxPending(true);
        } catch { /* Local cache remains available if IndexedDB is blocked. */ }
        if (!isCurrent()) return;
        notifyD1WriteForbidden(namespace, put.error);
      } else {
        try {
          await d1OutboxEnqueue({
            orgSlug,
            namespace,
            d1DataKey: countryDataKey,
            value: syncPayload,
            clientVersion: d1VersionRef.current || 0,
          });
          if (isCurrent()) setD1OutboxPending(true);
        } catch {
          /* IndexedDB unavailable — edits stay local only */
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      if (d1DebounceRef.current) {
        clearTimeout(d1DebounceRef.current);
        d1DebounceRef.current = null;
      }
    };
  }, [value, d1Ready, storageKey, namespace, countryDataKey, debounceMs, d1OrgEpoch, d1DataKey]);

  const d1Hydrating = isD1Configured() && !d1Ready;
  const d1Syncing = d1Hydrating || d1OutboxPending;
  return { d1Ready, d1Hydrating, d1OutboxPending, d1Syncing };
}
