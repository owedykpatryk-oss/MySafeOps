import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function permitLabel(permit: Record<string, unknown>) {
  return String(permit?.type || "permit").replace(/_/g, " ");
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

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:safety@mysafeops.local";
    if (!vapidPublicKey || !vapidPrivateKey) {
      return json(500, { error: "VAPID keys are not configured" });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
    const orgSlug = cleanOrgSlug(body?.orgSlug);
    const permit = (body?.permit || {}) as Record<string, unknown>;
    const title = String(body?.title || "Permit update");
    const msg = String(body?.body || "").slice(0, 220);
    const url = String(body?.url || "/?tab=permits");
    const tag = String(body?.tag || `permit-${String(permit?.id || "notice")}`);
    const dryRun = Boolean(body?.dryRun);

    const fallbackBody = `${permitLabel(permit)} at ${String(permit?.location || "site")} · ${String(permit?.status || "updated")}`;
    const payload = JSON.stringify({
      title,
      body: msg || fallbackBody,
      tag,
      url,
      requireInteraction: Boolean(body?.requireInteraction),
      data: {
        permitId: permit?.id || null,
        orgSlug,
      },
    });

    const { data: rows, error: subErr } = await supabase
      .from("org_push_subscriptions")
      .select("id, endpoint, subscription")
      .eq("user_id", user.id)
      .eq("org_slug", orgSlug);
    if (subErr) return json(500, { error: subErr.message });

    const subscriptions = Array.isArray(rows) ? rows : [];
    if (dryRun) {
      return json(200, {
        ok: true,
        dryRun: true,
        subscriptions: subscriptions.length,
        configured: true,
      });
    }
    if (subscriptions.length === 0) return json(200, { ok: true, sent: 0, skipped: true });

    let sent = 0;
    let failed = 0;
    const removeIds: number[] = [];

    for (const row of subscriptions) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode = Number((err as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) removeIds.push(Number(row.id));
      }
    }

    if (removeIds.length > 0) {
      await supabase
        .from("org_push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("org_slug", orgSlug)
        .in("id", removeIds);
    }

    return json(200, { ok: true, sent, failed, pruned: removeIds.length });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
