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

/**
 * Durable shared rate limit via `claim_edge_rate_bucket` (Postgres).
 * Falls open (returns true) if the RPC is missing / errors so deploys stay available.
 */
export async function checkDurableEdgeRateLimit(
  supabase: RpcClient,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const { data, error } = await supabase.rpc("claim_edge_rate_bucket", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("claim_edge_rate_bucket skipped", error.message);
      return true;
    }
    return data === true || data === "true";
  } catch (e) {
    console.warn("claim_edge_rate_bucket failed", e);
    return true;
  }
}
