import { useEffect, useRef, useState } from "react";
import { isTurnstileEnabled, isTurnstileTestKeyOnProductionHost, TURNSTILE_SITE_KEY } from "../config/turnstile";
import { CAPTCHA_LOAD_FAILED_MSG } from "../lib/authCaptcha";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const LOAD_WATCHDOG_MS = 30000;
// Turnstile retries at 8-second intervals by default; allow more than one attempt.
const RETRY_WATCHDOG_MS = 25000;
const NON_RETRYABLE_ERROR_CODES = new Set([
  "110100", "110110", "110200", "200100", "400020", "400021", "400070",
]);

let scriptPromise = null;

function resetTurnstileScriptPromise() {
  scriptPromise = null;
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.turnstile?.render) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const onLoad = (element) => {
      const ready = Boolean(window.turnstile?.render);
      if (ready) element.dataset.turnstileLoaded = "true";
      else element.remove();
      resetTurnstileScriptPromise();
      resolve(ready);
    };
    const onError = (element) => {
      element.remove();
      resetTurnstileScriptPromise();
      reject(new Error("Turnstile script failed to load"));
    };
    let existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
    if (existing?.dataset.turnstileLoaded === "true") {
      existing.remove();
      existing = null;
    }
    if (existing) {
      existing.addEventListener("load", () => onLoad(existing), { once: true });
      existing.addEventListener("error", () => onError(existing), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => onLoad(script);
    script.onerror = () => onError(script);
    try {
      document.head.appendChild(script);
    } catch (err) {
      resetTurnstileScriptPromise();
      reject(err instanceof Error ? err : new Error("Turnstile script failed to load"));
    }
  });

  return scriptPromise;
}

/**
 * @param {{
 *   onTokenChange: (token: string) => void;
 *   onUnavailable?: (unavailable: boolean) => void;
 *   action?: string;
 *   resetKey?: number;
 * }} props
 */
export default function TurnstileWidget({ onTokenChange, onUnavailable, action = "login", resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const gotTokenRef = useRef(false);
  const terminalFailureRef = useRef(false);
  const retryWatchdogRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onUnavailableRef = useRef(onUnavailable);
  onTokenChangeRef.current = onTokenChange;
  onUnavailableRef.current = onUnavailable;
  const [loadError, setLoadError] = useState("");
  const [waiting, setWaiting] = useState(true);
  const [localRetry, setLocalRetry] = useState(0);

  const reportUnavailable = (unavailable) => {
    onUnavailableRef.current?.(unavailable);
  };

  const handleLoadFailure = (message) => {
    terminalFailureRef.current = true;
    window.clearTimeout(retryWatchdogRef.current);
    retryWatchdogRef.current = null;
    reportUnavailable(true);
    setWaiting(false);
    setLoadError(message || CAPTCHA_LOAD_FAILED_MSG);
    onTokenChangeRef.current("");
  };

  useEffect(() => {
    if (!isTurnstileEnabled()) return undefined;

    let cancelled = false;
    gotTokenRef.current = false;
    terminalFailureRef.current = false;
    setLoadError("");
    setWaiting(true);
    reportUnavailable(false);

    const watchdogId = window.setTimeout(() => {
      if (cancelled || gotTokenRef.current) return;
      const hasIframe = Boolean(containerRef.current?.querySelector("iframe"));
      if (!hasIframe) {
        if (!window.turnstile?.render) {
          document.querySelector(`script[src^="${SCRIPT_SRC}"]`)?.remove();
          resetTurnstileScriptPromise();
        }
        handleLoadFailure(CAPTCHA_LOAD_FAILED_MSG);
      }
    }, LOAD_WATCHDOG_MS);

    loadTurnstileScript()
      .then((ok) => {
        if (cancelled) return;
        if (!ok || !containerRef.current || !window.turnstile?.render) {
          handleLoadFailure(CAPTCHA_LOAD_FAILED_MSG);
          return;
        }
        if (widgetIdRef.current != null) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* ignore */
          }
          widgetIdRef.current = null;
        }
        containerRef.current.replaceChildren();
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          retry: "auto",
          callback: (token) => {
            terminalFailureRef.current = false;
            window.clearTimeout(retryWatchdogRef.current);
            retryWatchdogRef.current = null;
            gotTokenRef.current = true;
            setWaiting(false);
            setLoadError("");
            reportUnavailable(false);
            onTokenChangeRef.current(token);
          },
          "expired-callback": () => {
            gotTokenRef.current = false;
            onTokenChangeRef.current("");
          },
          "error-callback": (errorCode) => {
            if (terminalFailureRef.current) return true;
            gotTokenRef.current = false;
            onTokenChangeRef.current("");
            if (NON_RETRYABLE_ERROR_CODES.has(String(errorCode))) {
              handleLoadFailure("Security check is unavailable. Please contact support.");
              return true;
            }
            // Turnstile retries automatically; allow that retry before reporting a load failure.
            setWaiting(true);
            setLoadError("");
            if (retryWatchdogRef.current == null) {
              retryWatchdogRef.current = window.setTimeout(() => {
                if (!gotTokenRef.current) handleLoadFailure(CAPTCHA_LOAD_FAILED_MSG);
              }, RETRY_WATCHDOG_MS);
            }
            return false;
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          handleLoadFailure(CAPTCHA_LOAD_FAILED_MSG);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdogId);
      window.clearTimeout(retryWatchdogRef.current);
      retryWatchdogRef.current = null;
      if (widgetIdRef.current != null && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [action, resetKey, localRetry]);

  if (!isTurnstileEnabled()) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {isTurnstileTestKeyOnProductionHost() ? (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
          Turnstile test key detected on a public host — use a real site key in production (<code>VITE_TURNSTILE_SITE_KEY</code>).
        </p>
      ) : null}
      {loadError ? (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b91c1c", lineHeight: 1.45 }} role="alert">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => setLocalRetry((n) => n + 1)}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              color: "#b91c1c",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Try again
          </button>
        </p>
      ) : waiting ? (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }} role="status">
          Verifying your security check. Please wait…
        </p>
      ) : null}
      <div
        ref={containerRef}
        style={{ minHeight: loadError ? 0 : 65 }}
        aria-label="Security verification"
        data-turnstile-widget
        data-turnstile-state={loadError ? "error" : waiting ? "loading" : "ready"}
      />
    </div>
  );
}
