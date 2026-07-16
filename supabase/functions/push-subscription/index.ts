import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertOrgSlugAccess } from "../_shared/orgAccess.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { checkEdgeRateLimit } from "../_shared/edgeRateLimit.ts";

function pushCorsHeaders(req: Request) {
  return {
    ...corsHeadersForRequest(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, prefer, accept, accept-profile, x-request-id",
    "Access-Control-Max-Age": "86400",
  };
}

type PushSubPayload = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function json(req: Request, status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...pushCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function cleanOrgSlug(v: unknown) {
  const raw = String(v || "default").trim().toLowerCase();
  return raw || "default";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: pushCorsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req,401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return json(req,500, { error: "Server misconfigured" });

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json(req,401, { error: "Unauthorized" });

    if (!checkEdgeRateLimit(`push-subscription:${user.id}`, 40, 60_000)) {
      return json(req, 429, { error: "Rate limit exceeded. Please try again later." });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "upsert").trim().toLowerCase();
    const orgSlug = cleanOrgSlug(body?.orgSlug);

    const access = await assertOrgSlugAccess(supabase, user.id, orgSlug);
    if (!access.ok) return json(req,access.status, { error: access.error });

    const sub = (body?.subscription || {}) as PushSubPayload;
    const endpoint = String(sub?.endpoint || body?.endpoint || "").trim();

    if (!endpoint) return json(req,400, { error: "Missing endpoint" });

    if (action === "remove") {
      const { error } = await supabase
        .from("org_push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("org_slug", orgSlug)
        .eq("endpoint", endpoint);
      if (error) return json(req,500, { error: error.message });
      return json(req,200, { ok: true, removed: true });
    }

    const cleanedSub = {
      endpoint,
      keys: {
        p256dh: String(sub?.keys?.p256dh || ""),
        auth: String(sub?.keys?.auth || ""),
      },
    };

    const { error } = await supabase.from("org_push_subscriptions").upsert(
      {
        user_id: user.id,
        org_slug: orgSlug,
        endpoint,
        subscription: cleanedSub,
        user_agent: req.headers.get("User-Agent") || null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,org_slug,endpoint" }
    );
    if (error) return json(req,500, { error: error.message });

    return json(req,200, { ok: true, subscribed: true });
  } catch (e) {
    return json(req,500, { error: String(e) });
  }
});
