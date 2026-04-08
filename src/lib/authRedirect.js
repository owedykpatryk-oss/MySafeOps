/**
 * OAuth redirect URL — must be listed in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 * Include dev and production origins, e.g. http://localhost:5173/login, https://yourdomain.com/login
 */
export function getOAuthRedirectTo(pathname) {
  if (typeof window === "undefined") return "";
  return new URL(pathname, window.location.origin).href;
}

export async function signInWithGoogleOAuth(supabaseClient, redirectPath = "/login") {
  if (!supabaseClient) return { error: new Error("Not configured") };
  const redirectTo = getOAuthRedirectTo(redirectPath);
  return supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}
