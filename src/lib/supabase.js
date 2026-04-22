import { createClient } from "@supabase/supabase-js";

// Public (anon) fallback so auth keeps working if a deploy misses VITE_* vars.
// Env vars still take priority and should be set in Vercel/Supabase workflows.
const FALLBACK_SUPABASE_URL = "https://burgpzankkqvpcmdkhro.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cmdwemFua2txdnBjbWRraHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzQ1MTgsImV4cCI6MjA5MTE1MDUxOH0.Sb2bsyQAtbwNydfnDzd3WYsE_jnFJuv8XMW_mInv75A";

const url = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL || "").trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY || "").trim();

if (import.meta.env.PROD) {
  const missingEnv = !import.meta.env.VITE_SUPABASE_URL?.trim() || !import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (missingEnv && typeof console !== "undefined" && console.warn) {
    console.warn(
      "[MySafeOps] Production build is using bundled Supabase fallbacks. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on the host for a dedicated project and easier key rotation."
    );
  }
}

/** Null until env vars are set (app keeps working on localStorage-only). */
export const supabase = url && anon
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

export function isSupabaseConfigured() {
  return Boolean(url && anon);
}

export function getSupabaseUrl() {
  return url;
}

/** Public anon key (same as in the browser client). Used for lightweight gateway probes only. */
export function getSupabaseAnonKey() {
  return anon;
}
