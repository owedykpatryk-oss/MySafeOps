import { d1PutKv, isD1Configured } from "../lib/d1SyncClient";
import { D1_BACKUP_PUSH_NAMESPACES } from "../lib/d1ImportNamespaces";
import { validateBackupBundle } from "./backup";

/**
 * Push array-shaped keys from a MySafeOps backup bundle into D1 (org_sync_kv, data_key "main").
 * Overwrites remote values (no optimistic version check) — same semantics as `d1-import-backup.mjs`.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {object} bundle — `{ version?: 1, keys: { "namespace_slug": "[...]" } }`
 * @param {{ orgSlug?: string }} [opts]
 * @returns {Promise<{ ok: boolean, pushed: number, errors: { namespace: string, error: string }[] }>}
 */
export async function pushBackupBundleToD1(supabase, bundle, opts = {}) {
  const errors = [];
  if (!isD1Configured()) {
    return { ok: false, pushed: 0, errors: [{ namespace: "_", error: "d1_not_configured" }] };
  }
  const v = validateBackupBundle(bundle);
  if (!v.ok) {
    return { ok: false, pushed: 0, errors: [{ namespace: "_", error: v.message }] };
  }
  const orgSlug = String(opts.orgSlug || "").trim();
  if (!orgSlug || orgSlug === "default") {
    return { ok: false, pushed: 0, errors: [{ namespace: "_", error: "no_org_slug" }] };
  }

  const suffix = `_${orgSlug}`;
  let pushed = 0;

  for (const [storageKey, rawVal] of Object.entries(bundle.keys)) {
    if (typeof rawVal !== "string") continue;
    if (!storageKey.endsWith(suffix)) continue;
    const ns = storageKey.slice(0, -suffix.length);
    if (!D1_BACKUP_PUSH_NAMESPACES.has(ns)) continue;
    let parsed;
    try {
      parsed = JSON.parse(rawVal);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;

    const put = await d1PutKv(supabase, orgSlug, ns, "main", parsed, undefined);
    if (!put.ok) {
      errors.push({ namespace: ns, error: String(put.error || "put_failed") });
    } else {
      pushed += 1;
    }
  }

  return { ok: errors.length === 0, pushed, errors };
}
