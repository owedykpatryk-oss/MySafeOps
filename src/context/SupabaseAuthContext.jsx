import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { trackAuthError, trackAuthEvent } from "../lib/authTelemetry";
import { ensureUserOrgContext } from "../utils/orgMembership";

const Ctx = createContext(null);

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

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) {
          setSession(s);
          setLoading(false);
          trackAuthEvent("session_bootstrap_success", { hasSession: Boolean(s) });
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
