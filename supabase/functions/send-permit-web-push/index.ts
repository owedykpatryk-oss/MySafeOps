import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertOrgSlugAccess } from "../_shared/orgAccess.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { enforceEdgeRateLimits } from "../_shared/edgeRateLimit.ts";

function pushCorsHeaders(req: Request) {
  return {
    ...corsHeadersForRequest(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, prefer, accept, accept-profile, x-request-id",
    "Access-Control-Max-Age": "86400",
  };
}

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

function permitLabel(permit: Record<string, unknown>) {
  return String(permit?.type || "permit").replace(/_/g, " ");
}

/** Only same-app relative paths — blocks open redirects in push payload. */
function safePushUrl(raw: unknown, fallback: string): string {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || s.includes("\0")) {
    return fallback;
  }
  try {
    const u = new URL(s, "https://static-base.invalid");
    if (u.origin !== "https://static-base.invalid") return fallback;
    if (!u.pathname.startsWith("/app")) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  // Respond without loading web-push so OPTIONS / health never fail on npm import issues.
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

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:safety@mysafeops.local";
    if (!vapidPublicKey || !vapidPrivateKey) {
      return json(req,500, { error: "VAPID keys are not configured" });
    }

    const webpushMod = await import("npm:web-push@3.6.7");
    const webpush = webpushMod.default ?? webpushMod;
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json(req,401, { error: "Unauthorized" });

    if (!(await enforceEdgeRateLimits(supabase, `permit-web-push:${user.id}`, 30, 60_000))) {
      return json(req, 429, { error: "Rate limit exceeded. Please try again later." });
    }

    const body = await req.json().catch(() => ({}));
    const orgSlug = cleanOrgSlug(body?.orgSlug);

    const access = await assertOrgSlugAccess(supabase, user.id, orgSlug);
    if (!access.ok) return json(req,access.status, { error: access.error });

    const permit = (body?.permit || {}) as Record<string, unknown>;
    const title = String(body?.title || "Permit update");
    const msg = String(body?.body || "").slice(0, 220);
    const defaultPermitUrl = () => {
      const id = permit?.id;
      if (id) return `/app?view=permits&permitId=${encodeURIComponent(String(id))}`;
      return "/app?view=permits";
    };
    const url = safePushUrl(body?.url, defaultPermitUrl());
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
    if (subErr) return json(req,500, { error: subErr.message });

    const subscriptions = Array.isArray(rows) ? rows : [];
    if (dryRun) {
      return json(req,200, {
        ok: true,
        dryRun: true,
        subscriptions: subscriptions.length,
        configured: true,
      });
    }
    if (subscriptions.length === 0) return json(req,200, { ok: true, sent: 0, skipped: true });

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

    return json(req,200, { ok: true, sent, failed, pruned: removeIds.length });
  } catch (e) {
    return json(req,500, { error: String(e) });
  }
});
