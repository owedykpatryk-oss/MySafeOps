import { useState, useCallback } from "react";

/**
 * Client-side registers with long arrays: show first `pageSize` rows + "Show more".
 * Use `reset()` when filters/sort change (e.g. in a useEffect).
 */
export function useRegisterListPaging(pageSize = 50) {
  const [cap, setCap] = useState(pageSize);
  const visible = useCallback((arr) => (Array.isArray(arr) ? arr.slice(0, cap) : []), [cap]);
  const hasMore = useCallback((arr) => Array.isArray(arr) && arr.length > cap, [cap]);
  const remaining = useCallback((arr) => (Array.isArray(arr) ? Math.max(0, arr.length - cap) : 0), [cap]);
  const showMore = useCallback(() => setCap((c) => c + pageSize), [pageSize]);
  const reset = useCallback(() => setCap(pageSize), [pageSize]);
  return { pageSize, cap, visible, hasMore, remaining, showMore, reset };
}
