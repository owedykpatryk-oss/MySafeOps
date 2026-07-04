import { useEffect, useRef, useState } from "react";
import { isTurnstileEnabled, isLocalDevHost, isTurnstileTestKeyOnProductionHost, TURNSTILE_SITE_KEY } from "../config/turnstile";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.turnstile?.render) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.turnstile?.render)));
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.turnstile?.render));
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
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
  const onTokenChangeRef = useRef(onTokenChange);
  const onUnavailableRef = useRef(onUnavailable);
  onTokenChangeRef.current = onTokenChange;
  onUnavailableRef.current = onUnavailable;
  const [loadError, setLoadError] = useState("");

  const reportUnavailable = (unavailable) => {
    onUnavailableRef.current?.(unavailable);
  };

  const handleLoadFailure = (message) => {
    if (isLocalDevHost()) {
      reportUnavailable(true);
      setLoadError(`${message} Login on localhost works without Turnstile.`);
      onTokenChangeRef.current("");
      return;
    }
    reportUnavailable(false);
    setLoadError(message);
    onTokenChangeRef.current("");
  };

  useEffect(() => {
    if (!isTurnstileEnabled()) return undefined;

    let cancelled = false;
    setLoadError("");
    reportUnavailable(false);

    loadTurnstileScript()
      .then((ok) => {
        if (cancelled) return;
        if (!ok || !containerRef.current || !window.turnstile?.render) {
          handleLoadFailure("Could not load Cloudflare Turnstile. Check ad blockers or network access to challenges.cloudflare.com.");
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
          callback: (token) => onTokenChangeRef.current(token),
          "expired-callback": () => onTokenChangeRef.current(""),
          "error-callback": () => {
            onTokenChangeRef.current("");
            handleLoadFailure("Turnstile verification failed. Disable ad blockers for this site or retry.");
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          handleLoadFailure("Could not load Cloudflare Turnstile. Check ad blockers or network access to challenges.cloudflare.com.");
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [action, resetKey]);

  if (!isTurnstileEnabled()) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {isTurnstileTestKeyOnProductionHost() ? (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
          Turnstile test key detected on a public host — use a real site key in production (<code>VITE_TURNSTILE_SITE_KEY</code>).
        </p>
      ) : null}
      {loadError ? (
        <p
          style={{ margin: "0 0 8px", fontSize: 12, color: isLocalDevHost() ? "#b45309" : "#b91c1c", lineHeight: 1.45 }}
          role="status"
        >
          {loadError}
        </p>
      ) : null}
      <div
        ref={containerRef}
        style={{ minHeight: 65 }}
        aria-label="Security verification"
        data-turnstile-widget
      />
    </div>
  );
}
