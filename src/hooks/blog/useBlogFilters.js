import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { paginateBlogPosts } from "../../lib/blog/getPosts";

/**
 * URL-driven blog filters: ?q=&category=&tag=&page=
 */
export function useBlogFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const tag = searchParams.get("tag") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const setFilter = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const v = String(value ?? "").trim();
            if (!v) next.delete(key);
            else next.set(key, v);
          }
          if (!("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const result = useMemo(
    () => paginateBlogPosts({ q, category, tag, page }),
    [q, category, tag, page],
  );

  return {
    q,
    category,
    tag,
    page: result.page,
    totalPages: result.totalPages,
    totalCount: result.totalCount,
    posts: result.items,
    setFilter,
    clearFilters: () => setSearchParams({}, { replace: true }),
  };
}
