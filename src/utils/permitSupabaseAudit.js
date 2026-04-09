import { supabase } from "../lib/supabase";
import { getOrgId } from "./orgStorage";
import { describePermitAuditEvent, permitAuditDetailSnapshot } from "../modules/permits/permitAuditLog";

/**
 * @param {object | undefined} prevPermit
 * @param {object} nextPermit
 * @param {string} [orgSlug]
 */
export async function logPermitAuditToSupabase(prevPermit, nextPermit, orgSlug) {
  if (!supabase || !nextPermit?.id) return;
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return;

  const { action, fromStatus, toStatus } = describePermitAuditEvent(prevPermit, nextPermit);
  const slug = String(orgSlug || getOrgId() || "default").slice(0, 200);

  const { error } = await supabase.from("org_permit_audit").insert({
    user_id: user.id,
    org_slug: slug,
    permit_id: String(nextPermit.id),
    action,
    from_status: fromStatus || null,
    to_status: toStatus || null,
    detail: permitAuditDetailSnapshot(nextPermit),
  });
  if (error) {
    console.warn("[permits] cloud audit skipped:", error.message);
  }
}

/**
 * @param {object} permit — row being removed locally
 * @param {string} [orgSlug]
 */
export async function logPermitDeletedToSupabase(permit, orgSlug) {
  if (!supabase || !permit?.id) return;
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return;

  const slug = String(orgSlug || getOrgId() || "default").slice(0, 200);

  const { error } = await supabase.from("org_permit_audit").insert({
    user_id: user.id,
    org_slug: slug,
    permit_id: String(permit.id),
    action: "deleted",
    from_status: permit.status != null ? String(permit.status) : null,
    to_status: null,
    detail: permitAuditDetailSnapshot(permit),
  });
  if (error) {
    console.warn("[permits] cloud audit (delete) skipped:", error.message);
  }
}

/**
 * Fetch a page of cloud audit rows for current user + org.
 * @param {{ orgSlug?: string, permitId?: string, page?: number, pageSize?: number, fromDate?: string, toDate?: string, actions?: string[] }} [opts]
 * @returns {Promise<{ rows: any[], hasMore: boolean }>}
 */
export async function fetchPermitAuditPage(opts = {}) {
  if (!supabase) return { rows: [], hasMore: false };
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { rows: [], hasMore: false };

  const page = Math.max(1, Number(opts.page || 1));
  const pageSize = Math.max(5, Math.min(100, Number(opts.pageSize || 20)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const slug = String(opts.orgSlug || getOrgId() || "default").slice(0, 200);

  let q = supabase
    .from("org_permit_audit")
    .select("id, permit_id, action, from_status, to_status, detail, occurred_at")
    .eq("user_id", user.id)
    .eq("org_slug", slug)
    .order("occurred_at", { ascending: false })
    .range(from, to);

  if (opts.permitId) {
    q = q.eq("permit_id", String(opts.permitId));
  }
  if (opts.fromDate) {
    q = q.gte("occurred_at", `${opts.fromDate}T00:00:00.000Z`);
  }
  if (opts.toDate) {
    q = q.lte("occurred_at", `${opts.toDate}T23:59:59.999Z`);
  }
  if (Array.isArray(opts.actions) && opts.actions.length > 0) {
    q = q.in("action", opts.actions.map((a) => String(a)));
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = Array.isArray(data) ? data.slice(0, pageSize) : [];
  return { rows, hasMore: Array.isArray(data) ? data.length > pageSize : false };
}

/**
 * Fetch all matching audit rows across all pages (capped).
 * @param {{ orgSlug?: string, permitId?: string, fromDate?: string, toDate?: string, actions?: string[], maxRows?: number }} [opts]
 * @returns {Promise<{ rows: any[], truncated: boolean, maxRows: number }>}
 */
export async function fetchAllPermitAuditRows(opts = {}) {
  const maxRows = Math.max(100, Math.min(20000, Number(opts.maxRows || 5000)));
  const pageSize = 200;
  let page = 1;
  /** @type {any[]} */
  const out = [];
  while (out.length < maxRows) {
    const { rows, hasMore } = await fetchPermitAuditPage({
      ...opts,
      page,
      pageSize,
    });
    out.push(...rows);
    if (!hasMore || rows.length === 0) break;
    page += 1;
  }
  return { rows: out.slice(0, maxRows), truncated: out.length >= maxRows, maxRows };
}

/**
 * Request server-side CSV export via Supabase Edge Function.
 * @param {{ orgSlug?: string, permitId?: string, fromDate?: string, toDate?: string, actions?: string[], maxRows?: number }} [opts]
 * @returns {Promise<{ csv: string, fileName: string, rowCount: number, truncated: boolean, maxRows: number }>}
 */
export async function exportPermitAuditCsvViaServer(opts = {}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("permit-audit-export", {
    body: {
      orgSlug: String(opts.orgSlug || getOrgId() || "default").slice(0, 200),
      permitId: opts.permitId || undefined,
      fromDate: opts.fromDate || undefined,
      toDate: opts.toDate || undefined,
      actions: Array.isArray(opts.actions) && opts.actions.length ? opts.actions : undefined,
      maxRows: Number(opts.maxRows || 10000),
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  const csv = String(data?.csv || "");
  if (!csv) throw new Error("Server export returned no CSV payload.");
  return {
    csv,
    fileName: String(data?.fileName || `permit-audit-${new Date().toISOString().slice(0, 10)}.csv`),
    rowCount: Number(data?.rowCount || 0),
    truncated: Boolean(data?.truncated),
    maxRows: Number(data?.maxRows || 10000),
  };
}
