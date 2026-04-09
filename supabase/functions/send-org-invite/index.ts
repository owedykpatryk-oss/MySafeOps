import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const body = await req.json().catch(() => ({}));
    const inviteId = body?.inviteId as string | undefined;
    if (!inviteId) {
      return new Response(JSON.stringify({ error: "inviteId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inv, error: invErr } = await supabase
      .from("org_invites")
      .select("id, email, invite_token, org_id, status")
      .eq("id", inviteId)
      .maybeSingle();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: mem } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", inv.org_id)
      .maybeSingle();

    if (mem?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (inv.status !== "pending") {
      return new Response(JSON.stringify({ error: `Invite is ${inv.status}; only pending invites can be emailed` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase.from("organizations").select("name").eq("id", inv.org_id).maybeSingle();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("INVITE_FROM_EMAIL") ?? "MySafeOps <onboarding@resend.dev>";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "") || "http://localhost:5173";

    await updateDeliveryStatus(supabase, inv.id, {
      email_delivery_status: "pending",
      email_delivery_error: null,
      email_delivery_attempted_at: new Date().toISOString(),
    });

    if (!resendKey) {
      await updateDeliveryStatus(supabase, inv.id, {
        email_delivery_status: "skipped",
        email_delivery_error: "RESEND_API_KEY not set",
        email_delivery_attempted_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ ok: false, skipped: true, message: "RESEND_API_KEY not set" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgName = org?.name ?? "MySafeOps";
    const acceptUrl = `${siteUrl}/accept-invite?invite=${encodeURIComponent(inv.invite_token)}&email=${encodeURIComponent(inv.email)}`;

    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
<p>You've been invited to join <strong>${escapeHtml(orgName)}</strong> on MySafeOps.</p>
<p><a href="${acceptUrl}" style="color:#0d9488;font-weight:600">Accept invite</a></p>
<p style="font-size:13px;color:#64748b">If the button does not work, copy this link:<br/>${escapeHtml(acceptUrl)}</p>
<p style="font-size:13px;color:#64748b">Support: mysafeops@gmail.com</p>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [inv.email],
        subject: `You're invited to ${orgName} on MySafeOps`,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      await updateDeliveryStatus(supabase, inv.id, {
        email_delivery_status: "failed",
        email_delivery_error: String(detail || "Resend failed").slice(0, 2000),
        email_delivery_attempted_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: "Resend failed", detail }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await updateDeliveryStatus(supabase, inv.id, {
      email_delivery_status: "sent",
      email_delivery_error: null,
      email_delivery_attempted_at: new Date().toISOString(),
      email_delivery_sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function updateDeliveryStatus(
  supabase: ReturnType<typeof createClient>,
  inviteId: string,
  patch: Record<string, string | null>,
) {
  const { error } = await supabase.from("org_invites").update(patch).eq("id", inviteId);
  if (error) {
    // Backward compatibility: deployments can run function before DB migration is applied.
    console.warn("invite delivery status update skipped", error.message);
  }
}
