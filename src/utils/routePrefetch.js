let loginPrefetched = false;

/** Warm the Vite chunk for `/login` (hover, focus, or idle). Safe to call repeatedly. */
export function prefetchLoginPage() {
  if (loginPrefetched) return;
  loginPrefetched = true;
  import("../pages/LoginPage").catch(() => {
    loginPrefetched = false;
  });
}

/** Handlers for `<Link to="/login" {...loginLinkPrefetchProps} />`. */
export const loginLinkPrefetchProps = {
  onMouseEnter: prefetchLoginPage,
  onFocus: prefetchLoginPage,
};

/**
 * After a short delay + idle time, prefetch login for visitors who never hover a CTA.
 * Skips when Save-Data is enabled. Returns a cleanup for useEffect.
 */
export function scheduleIdleLoginPrefetch() {
  let cancelled = false;
  let delayId;
  let idleId;

  try {
    if (typeof navigator !== "undefined" && navigator.connection?.saveData) {
      return () => {};
    }
  } catch {
    /* ignore */
  }

  delayId = window.setTimeout(() => {
    if (cancelled) return;
    const run = () => {
      if (!cancelled) prefetchLoginPage();
    };
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(run, { timeout: 5000 });
    } else {
      run();
    }
  }, 2800);

  return () => {
    cancelled = true;
    window.clearTimeout(delayId);
    if (idleId !== undefined && typeof cancelIdleCallback === "function") {
      cancelIdleCallback(idleId);
    }
  };
}
