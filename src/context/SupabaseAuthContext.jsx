import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { trackAuthError, trackAuthEvent } from "../lib/authTelemetry";
import { syncSentryUser } from "../utils/sentryClient.js";
import { ensureUserOrgContext } from "../utils/orgMembership";
import { initPortalCloudAutoSync } from "../utils/clientPortalAutoSync";
import {
  isPasswordRecoveryPending,
  markPasswordRecoveryPending,
  redirectToResetPasswordIfNeeded,
} from "../lib/passwordRecovery";
import { clearAuthorshipUserCache, setAuthorshipUserCache } from "../utils/documentAuthorship.js";

const Ctx = createContext(null);

/** Detect recovery from URL before / during PKCE exchange (hash or query). */
function urlLooksLikePasswordRecovery() {
  if (typeof window === "undefined") return false;
  try {
    const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search || "");
    return hash.get("type") === "recovery" || query.get("type") === "recovery";
  } catch {
    return false;
  }
}

export function SupabaseAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (urlLooksLikePasswordRecovery() || isPasswordRecoveryPending()) {
      markPasswordRecoveryPending();
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) {
          setSession(s);
          setLoading(false);
          trackAuthEvent("session_bootstrap_success", { hasSession: Boolean(s) });
        }
        if (s?.user && isPasswordRecoveryPending()) {
          redirectToResetPasswordIfNeeded();
          return;
        }
        if (s?.user) {
          ensureUserOrgContext(supabase).catch((error) => {
            trackAuthError("org_context_sync_failed", error, { source: "getSession" });
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
          trackAuthError("session_bootstrap_failed", error);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      trackAuthEvent("auth_state_change", { event, hasSession: Boolean(s) });
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecoveryPending();
        redirectToResetPasswordIfNeeded();
        return;
      }
      if (s?.user && isPasswordRecoveryPending()) {
        redirectToResetPasswordIfNeeded();
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        ensureUserOrgContext(supabase).catch((error) => {
          trackAuthError("org_context_sync_failed", error, { source: "onAuthStateChange", event });
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    syncSentryUser(session?.user ?? null);
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user) setAuthorshipUserCache(session.user);
    else clearAuthorshipUserCache();
  }, [session?.user?.id, session?.user?.email, session?.user?.user_metadata?.full_name, session?.user?.user_metadata?.name]);

  useEffect(() => {
    if (!supabase || !session?.user) return undefined;
    return initPortalCloudAutoSync(supabase);
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({
      supabase,
      session: supabase ? session : null,
      user: supabase ? session?.user ?? null : null,
      loading: supabase ? loading : false,
      ready: !supabase || !loading,
    }),
    [session, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupabaseAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSupabaseAuth outside SupabaseAuthProvider");
  return v;
}
