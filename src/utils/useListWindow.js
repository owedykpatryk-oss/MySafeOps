import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Pure window math for long lists (also used by tests).
 * @param {number} length
 * @param {number} scrollTop
 * @param {{ rowHeight?: number, overscan?: number, maxHeight?: number, enableAfter?: number }} [opts]
 */
export function computeListWindow(length, scrollTop, opts = {}) {
  const rowHeight = Math.max(24, Number(opts.rowHeight) || 72);
  const overscan = Math.max(0, Number(opts.overscan) || 6);
  const maxHeight = Math.max(120, Number(opts.maxHeight) || 480);
  const enableAfter = Math.max(1, Number(opts.enableAfter) || 40);
  const n = Math.max(0, Number(length) || 0);
  const totalHeight = n * rowHeight;
  const visibleCount = Math.ceil(maxHeight / rowHeight) + overscan * 2;
  const start = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
  const end = Math.min(n, start + visibleCount);
  return {
    rowHeight,
    overscan,
    maxHeight,
    totalHeight,
    start,
    end,
    offsetY: start * rowHeight,
    enabled: n > enableAfter,
  };
}

/**
 * Lightweight scroll windowing for long lists (no extra dependency).
 * @param {unknown[]} items
 * @param {{ rowHeight?: number, overscan?: number, maxHeight?: number, enableAfter?: number }} [opts]
 */
export function useListWindow(items, opts = {}) {
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const parentRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const bounds = useMemo(
    () => computeListWindow(list.length, scrollTop, opts),
    // opts fields are primitives in callers; recompute when list/scroll change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.length, scrollTop, opts.rowHeight, opts.overscan, opts.maxHeight, opts.enableAfter]
  );

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return undefined;
    const onScroll = () => setScrollTop(el.scrollTop || 0);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [list.length, bounds.rowHeight, bounds.maxHeight]);

  const visibleItems = useMemo(
    () => (bounds.enabled ? list.slice(bounds.start, bounds.end) : list),
    [list, bounds.enabled, bounds.start, bounds.end]
  );

  const onScrollReset = useCallback(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0;
    setScrollTop(0);
  }, []);

  return {
    parentRef,
    totalHeight: bounds.totalHeight,
    offsetY: bounds.offsetY,
    start: bounds.start,
    end: bounds.end,
    visibleItems,
    maxHeight: bounds.maxHeight,
    rowHeight: bounds.rowHeight,
    onScrollReset,
    enabled: bounds.enabled,
  };
}
