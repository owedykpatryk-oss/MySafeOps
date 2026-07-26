import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enforceUserAndOrgEdgeRateLimits } from "../_shared/edgeRateLimit.ts";
import { corsHeadersForRequest } from "../_shared/corsHeaders.ts";

/**
 * POST { action: "schedule" | "cancel" | "status" | "run_maintenance" }
 * - schedule/cancel/status: authenticated org admin (JWT)
 * - run_maintenance: service role or CRON_SECRET header (purge portals + orgs past grace)
 */
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "schedule").trim().toLowerCase();

    // Cron / ops maintenance — purge expired portals + orgs past 30-day grace.
    if (action === "run_maintenance") {
      const cronSecret = Deno.env.get("CRON_SECRET") || "";
      const provided = req.headers.get("X-Cron-Secret") || "";
      const authHeader = req.headers.get("Authorization") || "";
      const isService =
        authHeader === `Bearer ${serviceKey}` || (cronSecret && provided === cronSecret);
      if (!isService) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: portalsPurged, error: pErr } = await admin.rpc("purge_expired_client_portal_shares");
      if (pErr) {
        return new Response(JSON.stringify({ error: pErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: orgsPurged, error: oErr } = await admin.rpc("purge_orgs_past_deletion_grace");
      if (oErr) {
        return new Response(JSON.stringify({ error: oErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          portals_purged: portalsPurged ?? 0,
          orgs_purged: orgsPurged ?? 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerMem, error: callerErr } = await admin
      .from("org_memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerErr || !callerMem?.org_id) {
      return new Response(JSON.stringify({ error: "No organisation membership" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateOk = await enforceUserAndOrgEdgeRateLimits(admin, {
      userKey: `org-deletion:${user.id}`,
      orgKey: `org-deletion:org:${callerMem.org_id}`,
      userMax: 6,
      orgMax: 12,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!rateOk) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    if (callerMem.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only organisation admins can manage deletion" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "status") {
      const { data, error } = await userClient.rpc("get_my_org_deletion_status");
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const row = Array.isArray(data) ? data[0] : data;
      return new Response(JSON.stringify({ ok: true, status: row || null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      const { data, error } = await userClient.rpc("cancel_my_org_deletion");
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const row = Array.isArray(data) ? data[0] : data;
      return new Response(JSON.stringify({ ok: true, ...row }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // schedule (default)
    const confirm = String(body?.confirmSlug || "").trim();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", callerMem.org_id)
      .maybeSingle();
    if (!orgRow?.slug || confirm !== orgRow.slug) {
      return new Response(
        JSON.stringify({ error: "confirmSlug must match your organisation slug exactly" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await userClient.rpc("schedule_my_org_deletion");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const row = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({
        ok: true,
        ...row,
        message:
          "Organisation deletion scheduled. Cloud data is erased 30 days from now unless an admin cancels in Settings → Cloud account. Export a backup before the purge date.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
