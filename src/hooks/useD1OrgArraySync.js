import { useCallback, useEffect, useRef, useState } from "react";
import { getOrgId, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { supabase } from "../lib/supabase";
import { d1GetKv, d1PutKv, isD1Configured } from "../lib/d1SyncClient";
import {
  clearD1WriteForbidden,
  isForbiddenD1Write,
  notifyD1WriteForbidden,
} from "../lib/d1WriteForbidden.js";
import {
  d1OutboxDelete,
  d1OutboxEnqueue,
  d1OutboxHasPending,
  d1OutboxTryFlush,
} from "../lib/d1SyncOutbox.js";
import { D1_OUTBOX_MANUAL_RETRY_EVENT } from "../lib/d1OutboxRetryEvent.js";
import { mergeOrgArrays } from "../utils/d1ArrayMerge.js";
import { getCachedActiveCountryWorkspace } from "../utils/countryWorkspaces.js";

const transient = (e) => /^http_(502|503|504|429)$/.test(String(e || ""));

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
  const activeCountry = getCachedActiveCountryWorkspace();
  const countryDataKey = activeCountry?.id && !activeCountry.is_primary ? `country:${activeCountry.id}:${d1DataKey}` : d1DataKey;
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
  const d1DebounceRef = useRef(null);

  useEffect(() => {
    const cacheMs = Math.min(debounceMs, 500);
    let timer = null;
    const key = storageKey;
    const val = value;
    timer = window.setTimeout(() => save(key, val), cacheMs);
    return () => {
      if (timer != null) {
        window.clearTimeout(timer);
        save(key, val);
      }
    };
  }, [storageKey, value, save, debounceMs]);

  useEffect(() => {
    const onOrgChange = () => {
      setValue(load(storageKey, []));
      setD1Ready(!isD1Configured());
      setD1OutboxPending(false);
      setD1OrgEpoch((n) => n + 1);
    };
    window.addEventListener(ORG_CHANGED_EVENT, onOrgChange);
    return () => window.removeEventListener(ORG_CHANGED_EVENT, onOrgChange);
  }, [storageKey, load, setValue]);

  useEffect(() => {
    let cancelled = false;
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
      if (!cancelled) setD1OutboxPending(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [d1OrgEpoch, namespace, countryDataKey]);

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
    const flushCtxBase = () => ({
      supabase,
      orgSlug,
      namespace,
      d1DataKey: countryDataKey,
      storageKey,
      setValue,
      save,
      versionRef: d1VersionRef,
    });
    const refreshPending = async () => {
      const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      if (!cancelled) setD1OutboxPending(still);
    };
    (async () => {
      /** @type {{ ok: boolean; error?: string; request_id?: string }} */
      let r = { ok: false };
      const delaysMs = [0, 1200, 2800];
      for (let i = 0; i < delaysMs.length; i++) {
        if (cancelled) return;
        if (delaysMs[i] > 0) await new Promise((res) => setTimeout(res, delaysMs[i]));
        try {
          r = await d1GetKv(supabase, orgSlug, namespace, countryDataKey);
        } catch {
          r = { ok: false, error: "fetch_failed" };
        }
        if (r.ok) break;
      }
      if (cancelled) return;
      if (!r.ok) {
        d1VersionRef.current = 0;
        await d1OutboxTryFlush(flushCtxBase());
        await refreshPending();
        setD1Ready(true);
        return;
      }
      d1VersionRef.current = r.version || 0;
      if (Array.isArray(r.value)) {
        const local = load(storageKey, []);
        const merged = mergeOrgArrays(local, r.value);
        setValue(merged);
        save(storageKey, merged);
        await d1OutboxTryFlush(flushCtxBase());
        await refreshPending();
        setD1Ready(true);
        return;
      }
      const local = load(storageKey, []);
      setValue(local);
      if (local.length > 0) {
        let put;
        try {
          put = await d1PutKv(supabase, orgSlug, namespace, countryDataKey, toSyncValue(local), null);
        } catch {
          put = { ok: false, error: "fetch_failed" };
        }
        if (put.ok) d1VersionRef.current = put.version || 0;
        else if (isForbiddenD1Write(put.error)) notifyD1WriteForbidden(namespace, put.error);
      }
      await d1OutboxTryFlush(flushCtxBase());
      await refreshPending();
      if (!cancelled) setD1Ready(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [d1OrgEpoch, storageKey, namespace, countryDataKey, load, save, setValue, toSyncValue]);

  useEffect(() => {
    if (!d1Ready) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    const flushCtxBase = () => ({
      supabase,
      orgSlug,
      namespace,
      d1DataKey: countryDataKey,
      storageKey,
      setValue,
      save,
      versionRef: d1VersionRef,
    });
    const runFlush = async () => {
      await d1OutboxTryFlush(flushCtxBase());
      const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      setD1OutboxPending(still);
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
      window.removeEventListener("online", onOnline);
      window.removeEventListener(D1_OUTBOX_MANUAL_RETRY_EVENT, onManualRetry);
    };
  }, [d1Ready, namespace, countryDataKey, storageKey, setValue, save, d1OrgEpoch]);

  useEffect(() => {
    if (!d1Ready || !d1OutboxPending) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    const flushCtxBase = () => ({
      supabase,
      orgSlug,
      namespace,
      d1DataKey: countryDataKey,
      storageKey,
      setValue,
      save,
      versionRef: d1VersionRef,
    });
    const id = window.setInterval(async () => {
      await d1OutboxTryFlush(flushCtxBase());
      const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
      setD1OutboxPending(still);
    }, 45_000);
    return () => window.clearInterval(id);
  }, [d1Ready, d1OutboxPending, namespace, countryDataKey, storageKey, setValue, save, d1OrgEpoch]);

  useEffect(() => {
    if (!d1Ready) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    if (d1DebounceRef.current) clearTimeout(d1DebounceRef.current);
    d1DebounceRef.current = setTimeout(async () => {
      const v = d1VersionRef.current;
      const useVersion = v > 0 ? v : undefined;
      const syncPayload = toSyncValue(value);
      let put;
      try {
        put = await d1PutKv(supabase, orgSlug, namespace, countryDataKey, syncPayload, useVersion);
      } catch {
        put = { ok: false, error: "fetch_failed" };
      }
      if (!put.ok && transient(put.error)) {
        await new Promise((res) => setTimeout(res, 900));
        try {
          put = await d1PutKv(supabase, orgSlug, namespace, countryDataKey, syncPayload, useVersion);
        } catch {
          put = { ok: false, error: "fetch_failed" };
        }
      }
      if (put.ok) {
        d1VersionRef.current = put.version || 0;
        clearD1WriteForbidden();
        await d1OutboxDelete(orgSlug, namespace, countryDataKey);
        const still = await d1OutboxHasPending(orgSlug, namespace, countryDataKey);
        setD1OutboxPending(still);
      } else if (put.error === "version_conflict") {
        let r;
        try {
          r = await d1GetKv(supabase, orgSlug, namespace, countryDataKey);
        } catch {
          r = { ok: false };
        }
        if (r.ok && Array.isArray(r.value)) {
          d1VersionRef.current = r.version || 0;
          const merged = mergeOrgArrays(value, r.value);
          setValue(merged);
          save(storageKey, merged);
        }
      } else if (isForbiddenD1Write(put.error)) {
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
          setD1OutboxPending(true);
        } catch {
          /* IndexedDB unavailable — edits stay local only */
        }
      }
    }, debounceMs);
    return () => {
      if (d1DebounceRef.current) {
        clearTimeout(d1DebounceRef.current);
        d1DebounceRef.current = null;
      }
    };
  }, [value, d1Ready, storageKey, namespace, countryDataKey, save, setValue, debounceMs, toSyncValue]);

  const d1Hydrating = isD1Configured() && !d1Ready;
  const d1Syncing = d1Hydrating || d1OutboxPending;
  return { d1Ready, d1Hydrating, d1OutboxPending, d1Syncing };
}
