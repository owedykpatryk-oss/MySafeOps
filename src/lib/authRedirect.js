import { safeInternalPath } from "../utils/safeUrl";

/**
 * OAuth redirect URL — must be listed in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 * Use `/login` (or `/login?next=...`), not `/app`: protected routes can drop the auth `code` before exchange,
 * and Supabase may fall back to Site URL (often `/` = landing) if the path is not allow-listed.
 * Include e.g. http://localhost:5173/login, https://yourdomain.com/login
 */
export function getOAuthRedirectTo(pathname) {
  if (typeof window === "undefined") return "";
  const path = safeInternalPath(String(pathname || ""), "/login");
  return new URL(path, window.location.origin).href;
}

export async function signInWithGoogleOAuth(supabaseClient, redirectPath = "/login") {
  if (!supabaseClient) return { error: new Error("Not configured") };
  const redirectTo = getOAuthRedirectTo(redirectPath);
  return supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}
