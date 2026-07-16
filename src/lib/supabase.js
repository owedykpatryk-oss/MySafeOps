import { createClient } from "@supabase/supabase-js";

// Require explicit env — never embed project URL/anon key in source (even for local dev).
const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (import.meta.env.PROD) {
  const missingEnv = !url || !anon;
  if (missingEnv && typeof console !== "undefined" && console.warn) {
    console.warn(
      "[MySafeOps] Production build without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — cloud auth and sync are disabled until env vars are set on the host."
    );
  }
} else if ((!url || !anon) && typeof console !== "undefined" && console.info) {
  console.info(
    "[MySafeOps] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local for cloud auth (see .env.local.example)."
  );
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
