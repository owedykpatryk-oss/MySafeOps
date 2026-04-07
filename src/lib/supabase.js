import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** Null until env vars are set (app keeps working on localStorage-only). */
export const supabase = url && anon ? createClient(url, anon) : null;

export function isSupabaseConfigured() {
  return Boolean(url && anon);
}
