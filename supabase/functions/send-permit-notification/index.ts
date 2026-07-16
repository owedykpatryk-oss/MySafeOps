import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildRosterLinkedEmailSet } from "../_shared/permitNotificationRecipients.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import { enforceEdgeRateLimits } from "../_shared/edgeRateLimit.ts";

function escHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDateTime(iso: unknown) {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16);
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

    if (!(await enforceEdgeRateLimits(supabase, `permit-notify:${user.id}`, 20, 60_000))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Only real org members can send permit notifications — closes an open-relay gap where any
    // authenticated (even org-less) account could email arbitrary addresses with a spoofed org name.
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
    const recipients = Array.isArray(body?.recipients) ? body.recipients.map((x: unknown) => String(x).trim()) : [];
    const requestedRecipients = recipients.filter((e: string) => e.includes("@")).slice(0, 15);
    if (requestedRecipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid recipients." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const norm = (e: unknown) => String(e || "").trim().toLowerCase();
    const allowlist = new Set<string>();
    const addAllowed = (e: unknown) => {
      const x = norm(e);
      if (x.includes("@")) allowlist.add(x);
    };
    addAllowed(user.email);

    const { data: memberships } = await supabase
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", mem.org_id);
    if (Array.isArray(memberships)) {
      await Promise.all(
        memberships.map(async ({ user_id }) => {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
            if (authUser?.user?.email) addAllowed(authUser.user.email);
          } catch {
            /* skip */
          }
        })
      );
    }

    const { data: invites } = await supabase.from("org_invites").select("email").eq("org_id", mem.org_id);
    if (Array.isArray(invites)) {
      for (const inv of invites) addAllowed(inv.email);
    }

    const permit = body?.permit || {};
    const roster = Array.isArray(body?.roster)
      ? body.roster
          .map((row: unknown) => {
            const r = row as { name?: unknown; email?: unknown };
            return { name: r?.name, email: r?.email };
          })
          .slice(0, 200)
      : [];
    const rosterLinked = buildRosterLinkedEmailSet(permit, roster);

    const validRecipients = requestedRecipients.filter(
      (e: string) => allowlist.has(norm(e)) || rosterLinked.has(norm(e))
    );
    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Recipients must be organisation members, pending invites, or worker roster emails linked to this permit's holder/issuer.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: cap sends per user in a rolling hour so the notification relay can't be
    // used to blast large volumes of email (open-relay abuse / spam / Resend reputation risk).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentSends, error: rateErr } = await supabase
      .from("permit_notification_log")
      .select("recipient_count")
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);
    if (!rateErr && Array.isArray(recentSends)) {
      const sendsInWindow = recentSends.length;
      const recipientsInWindow = recentSends.reduce((sum, r) => sum + (Number(r.recipient_count) || 0), 0);
      if (sendsInWindow >= 20 || recipientsInWindow >= 120) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const permitId = String(permit?.id || "UNKNOWN");
    const permitType = String(permit?.type || "permit");
    // Resolve the org name server-side instead of trusting the client-supplied value, so
    // notification emails can't be spoofed to impersonate an unrelated organisation.
    const { data: org } = await supabase.from("organizations").select("name").eq("id", mem.org_id).maybeSingle();
    const orgName = String(org?.name || body?.orgName || "MySafeOps");
    const message = String(body?.message || "").slice(0, 4000);
    const ramsDoc = body?.ramsDoc || null;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") ?? Deno.env.get("INVITE_FROM_EMAIL") ?? "MySafeOps <onboarding@resend.dev>";
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ramsLine = ramsDoc?.title
      ? `<p style="margin:0 0 10px"><strong>Linked RAMS:</strong> ${escHtml(String(ramsDoc.title))}${ramsDoc?.documentNo ? ` · ${escHtml(String(ramsDoc.documentNo))}` : ""}</p>`
      : "";
    const customMessage = message
      ? `<p style="margin:0 0 10px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc"><strong>Message:</strong><br/>${escHtml(message)}</p>`
      : "";
    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
<h2 style="margin:0 0 12px">${escHtml(orgName)} · Permit update</h2>
<p style="margin:0 0 10px"><strong>Permit:</strong> ${escHtml(permitId)} (${escHtml(permitType)})</p>
<p style="margin:0 0 10px"><strong>Status:</strong> ${escHtml(String(permit?.status || "—"))}</p>
<p style="margin:0 0 10px"><strong>Location:</strong> ${escHtml(String(permit?.location || "—"))}</p>
<p style="margin:0 0 10px"><strong>Issued to:</strong> ${escHtml(String(permit?.issuedTo || "—"))}</p>
<p style="margin:0 0 10px"><strong>Issued by:</strong> ${escHtml(String(permit?.issuedBy || "—"))}</p>
<p style="margin:0 0 10px"><strong>Start:</strong> ${escHtml(fmtDateTime(permit?.startDateTime))}</p>
<p style="margin:0 0 10px"><strong>Expiry:</strong> ${escHtml(fmtDateTime(permit?.endDateTime))}</p>
${ramsLine}
${customMessage}
<p style="font-size:12px;color:#64748b;margin-top:14px">Sent by MySafeOps permit notifications.</p>
</body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: validRecipients,
        subject: `${orgName}: Permit ${permitId} update`,
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return new Response(JSON.stringify({ error: "Resend failed", detail }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("permit_notification_log").insert({
      user_id: user.id,
      org_id: mem.org_id,
      recipient_count: validRecipients.length,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        sent: true,
        recipientCount: validRecipients.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
