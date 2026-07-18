/** Best-effort per-isolate rate limit for Supabase edge functions. */

const buckets = new Map<string, { start: number; count: number }>();

export function checkEdgeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    buckets.set(key, entry);
  }
  entry.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.start > windowMs) buckets.delete(k);
    }
  }
  return entry.count <= max;
}

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export type EdgeRateLimitOptions = {
  /** When durable RPC fails, deny (true) or allow (false). Abuse-sensitive routes should fail closed. */
  failClosed?: boolean;
};

/**
 * Durable shared rate limit via `claim_edge_rate_bucket` (Postgres).
 * Default fail-open for backwards compatibility; pass failClosed for invite/notify/webhook/Stripe.
 */
export async function checkDurableEdgeRateLimit(
  supabase: RpcClient,
  key: string,
  max: number,
  windowMs: number,
  opts: EdgeRateLimitOptions = {},
): Promise<boolean> {
  const failClosed = Boolean(opts.failClosed);
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const { data, error } = await supabase.rpc("claim_edge_rate_bucket", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("claim_edge_rate_bucket skipped", error.message);
      return !failClosed;
    }
    return data === true || data === "true";
  } catch (e) {
    console.warn("claim_edge_rate_bucket failed", e);
    return !failClosed;
  }
}

/** Isolate then durable rate limit. Returns true if the request is allowed. */
export async function enforceEdgeRateLimits(
  supabase: RpcClient,
  key: string,
  max: number,
  windowMs: number,
  opts: EdgeRateLimitOptions = {},
): Promise<boolean> {
  if (!checkEdgeRateLimit(key, max, windowMs)) return false;
  return await checkDurableEdgeRateLimit(supabase, key, max, windowMs, opts);
}

/**
 * Per-user + per-org ceilings (org blast-radius under many concurrent admins).
 * Both must pass. Uses failClosed by default.
 */
export async function enforceUserAndOrgEdgeRateLimits(
  supabase: RpcClient,
  opts: {
    userKey: string;
    orgKey: string;
    userMax: number;
    orgMax: number;
    windowMs: number;
    failClosed?: boolean;
  },
): Promise<boolean> {
  const failClosed = opts.failClosed !== false;
  const userOk = await enforceEdgeRateLimits(
    supabase,
    opts.userKey,
    opts.userMax,
    opts.windowMs,
    { failClosed },
  );
  if (!userOk) return false;
  return await enforceEdgeRateLimits(
    supabase,
    opts.orgKey,
    opts.orgMax,
    opts.windowMs,
    { failClosed },
  );
}

/** Best-effort prune of stale durable buckets (ignore errors). */
export async function pruneEdgeRateBuckets(supabase: RpcClient): Promise<void> {
  try {
    await supabase.rpc("prune_edge_rate_buckets", {});
  } catch {
    /* ignore */
  }
}
