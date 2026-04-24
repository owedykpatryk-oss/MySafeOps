import { useEffect, useRef, useState } from "react";
import { getOrgId, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { supabase } from "../lib/supabase";
import { d1GetKv, d1PutKv, isD1Configured } from "../lib/d1SyncClient";

/**
 * Hydrate an org-scoped JSON array from D1 (when VITE_D1_API_URL + Supabase + org), keep localStorage as cache,
 * debounced PUT with optimistic versioning, 409 → refetch from server.
 *
 * @param {object} p
 * @param {string} p.storageKey – orgStorage key (e.g. "method_statements")
 * @param {string} p.namespace – D1 KV namespace (often same as storageKey)
 * @param {string} [p.d1DataKey="main"]
 * @param {Array} p.value – current array state
 * @param {function} p.setValue – React setState for the array
 * @param {function} p.load – loadOrgScoped(base, fallback)
 * @param {function} p.save – saveOrgScoped(base, value)
 * @param {number} [p.debounceMs=800]
 * @returns {{ d1Ready: boolean, d1Syncing: boolean }}
 */
export function useD1OrgArraySync({
  storageKey,
  namespace,
  d1DataKey = "main",
  value,
  setValue,
  load,
  save,
  debounceMs = 800,
}) {
  const [d1Ready, setD1Ready] = useState(() => !isD1Configured());
  const [d1OrgEpoch, setD1OrgEpoch] = useState(0);
  const d1VersionRef = useRef(0);
  const d1DebounceRef = useRef(null);

  useEffect(() => {
    save(storageKey, value);
  }, [storageKey, value, save]);

  useEffect(() => {
    const onOrgChange = () => {
      setValue(load(storageKey, []));
      setD1Ready(!isD1Configured());
      setD1OrgEpoch((n) => n + 1);
    };
    window.addEventListener(ORG_CHANGED_EVENT, onOrgChange);
    return () => window.removeEventListener(ORG_CHANGED_EVENT, onOrgChange);
  }, [storageKey, load, setValue]);

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
    (async () => {
      const r = await d1GetKv(supabase, orgSlug, namespace, d1DataKey);
      if (cancelled) return;
      if (!r.ok) {
        d1VersionRef.current = 0;
        setD1Ready(true);
        return;
      }
      d1VersionRef.current = r.version || 0;
      if (Array.isArray(r.value)) {
        setValue(r.value);
        save(storageKey, r.value);
        setD1Ready(true);
        return;
      }
      const local = load(storageKey, []);
      setValue(local);
      if (local.length > 0) {
        const put = await d1PutKv(supabase, orgSlug, namespace, d1DataKey, local, null);
        if (put.ok) d1VersionRef.current = put.version || 0;
      }
      if (!cancelled) setD1Ready(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, d1OrgEpoch, storageKey, namespace, d1DataKey, load, save, setValue]);

  useEffect(() => {
    if (!d1Ready) return;
    if (!isD1Configured() || !supabase) return;
    const orgSlug = getOrgId();
    if (!orgSlug || orgSlug === "default") return;
    if (d1DebounceRef.current) clearTimeout(d1DebounceRef.current);
    d1DebounceRef.current = setTimeout(async () => {
      const v = d1VersionRef.current;
      const useVersion = v > 0 ? v : undefined;
      const put = await d1PutKv(supabase, orgSlug, namespace, d1DataKey, value, useVersion);
      if (put.ok) {
        d1VersionRef.current = put.version || 0;
      } else if (put.error === "version_conflict") {
        const r = await d1GetKv(supabase, orgSlug, namespace, d1DataKey);
        if (r.ok && Array.isArray(r.value)) {
          d1VersionRef.current = r.version || 0;
          setValue(r.value);
          save(storageKey, r.value);
        }
      }
    }, debounceMs);
    return () => {
      if (d1DebounceRef.current) {
        clearTimeout(d1DebounceRef.current);
        d1DebounceRef.current = null;
      }
    };
  }, [value, d1Ready, storageKey, namespace, d1DataKey, save, setValue, debounceMs]);

  const d1Syncing = isD1Configured() && !d1Ready;
  return { d1Ready, d1Syncing };
}
