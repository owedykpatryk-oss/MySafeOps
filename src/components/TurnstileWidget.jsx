import { useEffect, useRef, useState } from "react";
import { isTurnstileEnabled, isTurnstileTestKeyOnProductionHost, TURNSTILE_SITE_KEY } from "../config/turnstile";
import { CAPTCHA_LOAD_FAILED_MSG } from "../lib/authCaptcha";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const LOAD_WATCHDOG_MS = 5000;

let scriptPromise = null;

function resetTurnstileScriptPromise() {
  scriptPromise = null;
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.turnstile?.render) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.turnstile?.render)));
      existing.addEventListener("error", () => {
        resetTurnstileScriptPromise();
        reject(new Error("Turnstile script failed to load"));
      });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.turnstile?.render));
    script.onerror = () => {
      resetTurnstileScriptPromise();
      reject(new Error("Turnstile script failed to load"));
    };
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
    reportUnavailable(true);
    setWaiting(false);
    setLoadError(message || CAPTCHA_LOAD_FAILED_MSG);
    onTokenChangeRef.current("");
  };

  useEffect(() => {
    if (!isTurnstileEnabled()) return undefined;

    let cancelled = false;
    gotTokenRef.current = false;
    setLoadError("");
    setWaiting(true);
    reportUnavailable(false);

    const watchdogId = window.setTimeout(() => {
      if (cancelled || gotTokenRef.current) return;
      const hasIframe = Boolean(containerRef.current?.querySelector("iframe"));
      if (!hasIframe) {
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
          "error-callback": () => {
            onTokenChangeRef.current("");
            handleLoadFailure(CAPTCHA_LOAD_FAILED_MSG);
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
          Loading security check…
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
