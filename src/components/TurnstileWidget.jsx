import { useEffect, useRef } from "react";
import { isTurnstileEnabled, TURNSTILE_SITE_KEY } from "../config/turnstile";

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
 *   action?: string;
 *   resetKey?: number;
 * }} props
 */
export default function TurnstileWidget({ onTokenChange, action = "login", resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    if (!isTurnstileEnabled()) return undefined;

    let cancelled = false;

    loadTurnstileScript()
      .then((ok) => {
        if (cancelled || !ok || !containerRef.current || !window.turnstile?.render) return;
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
          callback: (token) => onTokenChangeRef.current(token),
          "expired-callback": () => onTokenChangeRef.current(""),
          "error-callback": () => onTokenChangeRef.current(""),
        });
      })
      .catch(() => {
        onTokenChangeRef.current("");
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
    <div
      ref={containerRef}
      style={{ marginTop: 12, minHeight: 65 }}
      aria-label="Security verification"
      data-turnstile-widget
    />
  );
}
