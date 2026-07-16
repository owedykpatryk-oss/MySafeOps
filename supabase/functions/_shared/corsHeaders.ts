/** Restrict CORS on Supabase Edge Functions — no wildcard ACAO for browser callers. */

function parseOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Allow both apex and www for a configured site origin (browsers hit either). */
function addOriginAndWwwTwin(allowed: Set<string>, origin: string) {
  allowed.add(origin);
  try {
    const u = new URL(origin);
    if (u.hostname.startsWith("www.")) {
      u.hostname = u.hostname.slice(4);
      allowed.add(u.origin);
    } else if (u.hostname.includes(".")) {
      u.hostname = `www.${u.hostname}`;
      allowed.add(u.origin);
    }
  } catch {
    /* ignore */
  }
}

function buildAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  for (const key of ["SITE_URL", "VITE_PUBLIC_SITE_URL"]) {
    const origin = parseOrigin(Deno.env.get(key)?.trim() ?? "");
    if (origin) addOriginAndWwwTwin(allowed, origin);
  }
  const supabaseOrigin = parseOrigin(Deno.env.get("SUPABASE_URL")?.trim() ?? "");
  if (supabaseOrigin) allowed.add(supabaseOrigin);

  const extra = Deno.env.get("EDGE_CORS_ALLOWED_ORIGINS")?.trim() ?? "";
  extra.split(/[\s,]+/).forEach((raw) => {
    if (!raw) return;
    const origin = parseOrigin(raw);
    if (origin) addOriginAndWwwTwin(allowed, origin);
  });

  return allowed;
}

function isDevLocalOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function corsHeadersForRequest(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };

  const origin = req.headers.get("Origin")?.trim() ?? "";
  const allowed = buildAllowedOrigins();

  if (origin && (allowed.has(origin) || isDevLocalOrigin(origin))) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }

  // No Origin (non-browser) — do not echo an allowlisted site; omit ACAO.
  return base;
}
