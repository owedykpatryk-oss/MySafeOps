import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json().catch(() => ({}));
    const recipients = Array.isArray(body?.recipients) ? body.recipients.map((x: unknown) => String(x).trim()) : [];
    const validRecipients = recipients.filter((e: string) => e.includes("@")).slice(0, 30);
    if (validRecipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid recipients." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const permit = body?.permit || {};
    const permitId = String(permit?.id || "UNKNOWN");
    const permitType = String(permit?.type || "permit");
    const orgName = String(body?.orgName || "MySafeOps");
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
