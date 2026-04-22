/**
 * Client-side auth UX limits (align with Supabase Dashboard → Authentication → Password).
 * NCSC 2024: prefer length over arbitrary complexity; Supabase may still enforce extra rules server-side.
 */
export const MIN_PASSWORD_LENGTH_SIGNUP = 12;
export const MIN_PASSWORD_LENGTH_RESET = 12;
