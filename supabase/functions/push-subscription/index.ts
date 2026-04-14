import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PushSubPayload = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanOrgSlug(v: unknown) {
  const raw = String(v || "default").trim().toLowerCase();
  return raw || "default";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return json(500, { error: "Server misconfigured" });

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "upsert").trim().toLowerCase();
    const orgSlug = cleanOrgSlug(body?.orgSlug);
    const sub = (body?.subscription || {}) as PushSubPayload;
    const endpoint = String(sub?.endpoint || body?.endpoint || "").trim();

    if (!endpoint) return json(400, { error: "Missing endpoint" });

    if (action === "remove") {
      const { error } = await supabase
        .from("org_push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("org_slug", orgSlug)
        .eq("endpoint", endpoint);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true, removed: true });
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
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true, subscribed: true });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
