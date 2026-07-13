/**
 * Verify a Supabase user access token server-side (Vercel API routes, scripts).
 * Uses the Auth REST API — no service role required for read-only user lookup.
 */

function resolveSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function resolveSupabaseAnonKey() {
  return String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
}

export function parseBearerToken(req) {
  const raw = String(req?.headers?.authorization || req?.headers?.Authorization || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

/**
 * @param {string} accessToken
 * @returns {Promise<{ id: string, email?: string } | null>}
 */
export async function verifySupabaseAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  const url = resolveSupabaseUrl();
  const anon = resolveSupabaseAnonKey();
  if (!token || !url || !anon) return null;

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return { id: String(user.id), email: user.email ? String(user.email) : undefined };
  } catch {
    return null;
  }
}
