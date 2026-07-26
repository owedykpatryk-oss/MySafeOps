/**
 * Idle session logout — shared tablets on site stay unlocked without this (ISO 27001 A.8.5).
 * Default 30 minutes; admins use 15 minutes when role is admin.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useApp } from "../context/AppContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { clearCloudBackupDek } from "../lib/backupCrypto";
import { pushAudit } from "../utils/auditLog";

export const IDLE_TIMEOUT_MS_DEFAULT = 30 * 60 * 1000;
export const IDLE_TIMEOUT_MS_ADMIN = 15 * 60 * 1000;
export const IDLE_WARN_BEFORE_MS = 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "mousemove", "scroll", "wheel"];

function resolveTimeoutMs(role) {
  return role === "admin" ? IDLE_TIMEOUT_MS_ADMIN : IDLE_TIMEOUT_MS_DEFAULT;
}

/**
 * Mount inside authenticated /app only (ProtectedAppRoute children).
 * Local-only workspaces (no Supabase) skip — nothing to sign out of.
 */
export function useIdleSessionLogout({ enabled = true } = {}) {
  const { user, supabase: client } = useSupabaseAuth();
  const { role } = useApp();
  const navigate = useNavigate();
  const [warnSeconds, setWarnSeconds] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured() || !client || !user) {
      setWarnSeconds(0);
      return undefined;
    }

    const timeoutMs = resolveTimeoutMs(role);
    const warnAtMs = Math.max(0, timeoutMs - IDLE_WARN_BEFORE_MS);

    const bump = () => {
      lastActivityRef.current = Date.now();
      setWarnSeconds(0);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    const tick = window.setInterval(() => {
      if (signingOutRef.current) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= timeoutMs) {
        signingOutRef.current = true;
        setWarnSeconds(0);
        void (async () => {
          try {
            pushAudit({ action: "idle_sign_out", entity: "session", detail: `idle_${Math.round(timeoutMs / 60000)}m` });
          } catch {
            /* ignore */
          }
          try {
            clearCloudBackupDek();
          } catch {
            /* ignore */
          }
          try {
            await client.auth.signOut();
          } catch {
            /* ignore */
          }
          navigate("/login?reason=idle", { replace: true });
        })();
        return;
      }
      if (idle >= warnAtMs) {
        const left = Math.max(1, Math.ceil((timeoutMs - idle) / 1000));
        setWarnSeconds(left);
      } else {
        setWarnSeconds(0);
      }
    }, 1000);

    return () => {
      window.clearInterval(tick);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bump, { passive: true });
      }
      // Must match addEventListener above — remounts would otherwise leak visibility listeners.
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, client, user, role, navigate]);

  const staySignedIn = () => {
    lastActivityRef.current = Date.now();
    setWarnSeconds(0);
  };

  return { warnSeconds, staySignedIn, timeoutMinutes: Math.round(resolveTimeoutMs(role) / 60000) };
}
