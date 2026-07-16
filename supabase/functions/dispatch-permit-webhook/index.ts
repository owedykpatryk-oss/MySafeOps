/**
 * Server-side PTW webhook fan-out (Slack / Teams / generic).
 * Browser sends event + validated target URLs; Edge re-validates SSRF and posts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { enforceEdgeRateLimits } from "../_shared/edgeRateLimit.ts";
import { detectIncomingWebhookKind, validateOutboundWebhookUrl } from "../_shared/webhookUrlValidation.ts";

type PermitSlim = {
  id?: string;
  type?: string;
  status?: string;
  location?: string;
  issuedTo?: string;
};

function labelEvent(event: string) {
  const key = String(event || "").toLowerCase();
  if (key === "issued") return "Permit issued";
  if (key === "status_changed") return "Permit status changed";
  if (key === "deleted") return "Permit deleted";
  if (key === "test") return "Webhook test";
  return `Permit event: ${key}`;
}

function buildSummary(event: string, permit: PermitSlim, detail: Record<string, unknown>) {
  const type = String(permit?.type || "general").replace(/_/g, " ");
  const location = permit?.location || "—";
  const permitId = permit?.id || "—";
  const status = String(permit?.status || detail?.to_status || detail?.status || "—");
  const issuedTo = permit?.issuedTo ? ` · ${permit.issuedTo}` : "";
  return `${labelEvent(event)}: ${type} at ${location}${issuedTo} (${permitId}) · status ${status}`;
}

function pickPayload(event: string, permit: PermitSlim, detail: Record<string, unknown>, kind: string) {
  const summary = buildSummary(event, permit, detail);
  if (kind === "slack") {
    return {
      text: summary,
      blocks: [
        { type: "header", text: { type: "plain_text", text: labelEvent(event), emoji: true } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Type:*\n${String(permit?.type || "—").replace(/_/g, " ")}` },
            { type: "mrkdwn", text: `*Status:*\n${permit?.status || detail?.to_status || "—"}` },
            { type: "mrkdwn", text: `*Location:*\n${permit?.location || "—"}` },
            { type: "mrkdwn", text: `*Permit ID:*\n${permit?.id || "—"}` },
          ],
        },
        { type: "context", elements: [{ type: "mrkdwn", text: `_MySafeOps PTW · ${new Date().toISOString()}_` }] },
      ],
    };
  }
  if (kind === "teams") {
    return {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary,
      themeColor: event === "deleted" ? "A32D2D" : event === "issued" ? "0d9488" : "2563eb",
      title: labelEvent(event),
      sections: [
        {
          facts: [
            { name: "Type", value: String(permit?.type || "—").replace(/_/g, " ") },
            { name: "Status", value: String(permit?.status || detail?.to_status || "—") },
            { name: "Location", value: String(permit?.location || "—") },
            { name: "Permit ID", value: String(permit?.id || "—") },
          ],
        },
      ],
    };
  }
  return {
    event: String(event || "").toLowerCase(),
    at: new Date().toISOString(),
    permitId: permit?.id || "",
    permitType: permit?.type || "",
    status: permit?.status || "",
    location: permit?.location || "",
    detail,
  };
}

function slimPermit(raw: unknown): PermitSlim {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    id: String(p.id || "").slice(0, 120),
    type: String(p.type || "").slice(0, 80),
    status: String(p.status || "").slice(0, 40),
    location: String(p.location || "").slice(0, 200),
    issuedTo: String(p.issuedTo || "").slice(0, 120),
  };
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await enforceEdgeRateLimits(supabase, `permit-webhook:${user.id}`, 30, 60_000))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const { data: mem, error: memErr } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr || !mem?.org_id) {
      return new Response(JSON.stringify({ error: "Forbidden: no organisation membership" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || "").toLowerCase().slice(0, 40) || "status_changed";
    const permit = slimPermit(body?.permit);
    const detail =
      body?.detail && typeof body.detail === "object" ? (body.detail as Record<string, unknown>) : {};

    const rawTargets = Array.isArray(body?.targets) ? body.targets : [];
    const targets: { channel: string; url: string; kind: string }[] = [];
    for (const t of rawTargets.slice(0, 6)) {
      const check = validateOutboundWebhookUrl(t?.url);
      if (!check.ok) continue;
      const kind =
        t?.kind === "slack" || t?.kind === "teams" || t?.kind === "generic"
          ? t.kind
          : detectIncomingWebhookKind(check.url);
      targets.push({
        channel: String(t?.channel || kind).slice(0, 32),
        url: check.url,
        kind,
      });
    }

    if (!targets.length) {
      return new Response(JSON.stringify({ ok: false, error: "No valid webhook targets" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      targets.map(async ({ channel, url, kind }) => {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-MySafeOps-Source": `ptw-${channel}`,
            },
            body: JSON.stringify(pickPayload(event, permit, detail, kind)),
          });
          return { channel, ok: res.ok, status: res.status };
        } catch (e) {
          return { channel, ok: false, error: String((e as Error)?.message || e) };
        }
      })
    );

    const ok = results.some((r) => r.ok);
    return new Response(JSON.stringify({ ok, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
