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
