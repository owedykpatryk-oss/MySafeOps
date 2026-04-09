import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AuditRow = {
  occurred_at: string;
  permit_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  detail: Record<string, unknown> | null;
};

function csvEsc(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
}

function toCsv(rows: AuditRow[]) {
  const header = ["occurred_at", "permit_id", "action", "from_status", "to_status", "location", "type"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        csvEsc(r.occurred_at),
        csvEsc(r.permit_id),
        csvEsc(r.action),
        csvEsc(r.from_status),
        csvEsc(r.to_status),
        csvEsc(r.detail?.location),
        csvEsc(r.detail?.type),
      ].join(",")
    );
  });
  return lines.join("\n");
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
    const orgSlug = String(body?.orgSlug || "default").slice(0, 200);
    const permitId = body?.permitId ? String(body.permitId) : "";
    const fromDate = body?.fromDate ? String(body.fromDate) : "";
    const toDate = body?.toDate ? String(body.toDate) : "";
    const actions = Array.isArray(body?.actions) ? body.actions.map((a: unknown) => String(a)) : [];
    const maxRows = Math.max(100, Math.min(50000, Number(body?.maxRows || 10000)));
    const pageSize = 1000;
    const out: AuditRow[] = [];
    let page = 0;
    let truncated = false;

    while (out.length < maxRows) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("org_permit_audit")
        .select("occurred_at, permit_id, action, from_status, to_status, detail")
        .eq("user_id", user.id)
        .eq("org_slug", orgSlug)
        .order("occurred_at", { ascending: false })
        .range(from, to);

      if (permitId) q = q.eq("permit_id", permitId);
      if (fromDate) q = q.gte("occurred_at", `${fromDate}T00:00:00.000Z`);
      if (toDate) q = q.lte("occurred_at", `${toDate}T23:59:59.999Z`);
      if (actions.length > 0) q = q.in("action", actions);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []) as AuditRow[];
      out.push(...rows);
      if (rows.length < pageSize) break;
      page += 1;
      if (out.length >= maxRows) {
        truncated = true;
        break;
      }
    }

    const trimmed = out.slice(0, maxRows);
    const csv = toCsv(trimmed);
    const fileName = `permit-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(
      JSON.stringify({
        ok: true,
        rowCount: trimmed.length,
        truncated,
        maxRows,
        fileName,
        csv,
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
