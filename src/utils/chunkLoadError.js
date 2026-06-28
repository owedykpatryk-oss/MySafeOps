/** Detect Vite/Rollup lazy-load failures after a new deploy (stale hashed chunks). */
export function isChunkLoadError(error) {
  const msg = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|error loading dynamically imported module/i.test(
    msg
  );
}

/** One automatic reload per tab session when a stale chunk is detected. */
export function reloadOnceForStaleChunk() {
  try {
    const key = "mysafeops_chunk_reload";
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
