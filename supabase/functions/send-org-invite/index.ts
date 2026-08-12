import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceEdgeRateLimits } from "../_shared/edgeRateLimit.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";
import {
  buildOrgInviteEmailHtml,
  buildOrgInviteEmailSubject,
  buildOrgInviteEmailText,
  resolveEmailLogoUrl,
} from "../_shared/inviteEmailHtml.ts";
import {
  hashInviteToken,
  renewedInviteExpiry,
  shouldRotateInviteToken,
} from "../_shared/inviteTokenHash.ts";

function makeInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersForRequest(req);
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
      .select("id, email, invite_token, org_id, status, expires_at, email_delivery_sent_at")
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

    if (!(await enforceEdgeRateLimits(supabase, `org-invite:user:${user.id}`, 12, 60 * 60_000, { failClosed: true }))) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: orgAttempts, error: orgRateErr } = await supabase
      .from("org_invites")
      .select("id", { count: "exact", head: true })
      .eq("org_id", inv.org_id)
      .gte("email_delivery_attempted_at", oneHourAgo);
    if (!orgRateErr && typeof orgAttempts === "number" && orgAttempts >= 40) {
      return new Response(JSON.stringify({ error: "Organisation invite email rate limit exceeded." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name, branding_settings")
      .eq("id", inv.org_id)
      .maybeSingle();

    const branding =
      org?.branding_settings && typeof org.branding_settings === "object" && !Array.isArray(org.branding_settings)
        ? (org.branding_settings as Record<string, unknown>)
        : {};

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("INVITE_FROM_EMAIL") ?? "MySafeOps <support@mysafeops.com>";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "") || "https://mysafeops.com";

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

    // A resend replaces the old capability link. Expired invites are renewed
    // for another 14 days instead of sending a link the preview RPC rejects.
    let liveToken = String(inv.invite_token || "").trim();
    const rotateToken = shouldRotateInviteToken({
      token: liveToken,
      expiresAt: inv.expires_at,
      sentAt: inv.email_delivery_sent_at,
    });
    if (rotateToken) {
      liveToken = makeInviteToken();
      const renewedExpiresAt = renewedInviteExpiry();
      const { error: rotErr } = await supabase
        .from("org_invites")
        .update({ invite_token: liveToken, expires_at: renewedExpiresAt })
        .eq("id", inv.id);
      if (rotErr) {
        return new Response(JSON.stringify({ error: "Could not rotate invite token" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Make the lookup durable before handing the link to the email provider.
    // If this write fails, no unusable email is sent.
    const liveTokenHash = await hashInviteToken(liveToken);
    const { error: hashErr } = await supabase
      .from("org_invites")
      .update({ invite_token_hash: liveTokenHash })
      .eq("id", inv.id);
    if (hashErr) {
      return new Response(JSON.stringify({ error: "Could not secure invite token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgName =
      String(branding.name || "").trim() ||
      String(org?.name || "").trim() ||
      "MySafeOps";
    const acceptUrl = `${siteUrl}/accept-invite?invite=${encodeURIComponent(liveToken)}`;
    const supportLine = Deno.env.get("SUPPORT_CONTACT_EMAIL")?.trim() || "support@mysafeops.com";
    const inviterName =
      String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
      String(user.email || "").split("@")[0] ||
      "";

    const companyLogoUrl = resolveEmailLogoUrl(branding.logoUrl || branding.logo, siteUrl);
    // Only use product logo when explicitly configured (avoid broken img if asset missing).
    const productLogoUrl = resolveEmailLogoUrl(Deno.env.get("PRODUCT_LOGO_URL") || "", siteUrl);

    const emailBrand = {
      orgName,
      inviteeEmail: String(inv.email || ""),
      acceptUrl,
      supportEmail: supportLine,
      siteUrl,
      companyLogoUrl: companyLogoUrl || undefined,
      productLogoUrl: productLogoUrl || undefined,
      primaryColor: String(branding.primaryColor || "").trim() || undefined,
      accentColor: String(branding.accentColor || "").trim() || undefined,
      website: String(branding.website || "").trim() || undefined,
      address: String(branding.address || "").trim() || undefined,
      phone: String(branding.phone || "").trim() || undefined,
      inviterName: inviterName || undefined,
    };

    const html = buildOrgInviteEmailHtml(emailBrand);
    const text = buildOrgInviteEmailText(emailBrand);
    const subject = buildOrgInviteEmailSubject(orgName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [inv.email],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detailRaw = await res.text();
      const detail = summariseResendError(detailRaw, res.status);
      await updateDeliveryStatus(supabase, inv.id, {
        email_delivery_status: "failed",
        email_delivery_error: detail.slice(0, 2000),
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

    // Persist the hash explicitly before clearing plaintext. This keeps the
    // emailed link valid even if the database trigger is missing or stale.
    const { error: clearErr } = await supabase
      .from("org_invites")
      .update({ invite_token: null, invite_token_hash: liveTokenHash })
      .eq("id", inv.id);
    if (clearErr) {
      console.warn("invite_token clear skipped", clearErr.message);
    }

    return new Response(JSON.stringify({ ok: true, sent: true, renewed: rotateToken }), {
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

/** Keep invite delivery errors short — Resend sometimes returns Cloudflare HTML pages. */
function summariseResendError(raw: string, status: number): string {
  const text = String(raw || "").trim();
  if (!text) return `Resend failed (HTTP ${status})`;
  if (/<!DOCTYPE\s+html/i.test(text) || /cf-error-details|Error code 5\d{2}/i.test(text)) {
    const code = text.match(/Error code\s+(5\d{2})/i)?.[1] || text.match(/\b(520|521|522|523|524)\b/)?.[1] || String(status);
    return `Resend API temporarily unavailable (Cloudflare ${code}). Retry in a minute.`;
  }
  return text.slice(0, 2000);
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
