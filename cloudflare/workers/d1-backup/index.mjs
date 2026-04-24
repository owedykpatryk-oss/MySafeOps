/**
 * Scheduled D1 → R2 snapshot (no public HTTP; cron in same Cloudflare account).
 * Binds: same D1 database as mysafeops-d1-api, R2 bucket for JSON snapshots.
 */

const SNAPSHOT_PREFIX = "d1-snapshots/";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

export default {
  async scheduled(event, env, ctx) {
    const runId = crypto.randomUUID();
    console.log(`[d1-backup] cron start run_id=${runId} cron=${event.cron || ""}`);
    ctx.waitUntil(
      runSnapshot(env, event.cron, runId).catch((e) => {
        console.error(`[d1-backup] run_id=${runId} FAILED`, e?.message || e);
      })
    );
  },
  async fetch() {
    return jsonResponse({ error: "use_scheduled_cron" }, 404);
  },
};

async function runSnapshot(env, cron, runId = "") {
  const { DB, BUCKET } = env;
  if (!DB || !BUCKET) {
    console.error(`[d1-backup] run_id=${runId} missing DB or BUCKET binding`);
    return;
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const key = `${SNAPSHOT_PREFIX}mysafeops-d1-${stamp}.json`;

  const kv = await env.DB.prepare(`SELECT org_slug, namespace, data_key, version, updated_at, value_json FROM org_sync_kv`)
    .all();
  let audit = { results: [] };
  try {
    audit = await env.DB.prepare(
      `SELECT org_slug, seq, created_at, actor_sub, action, entity, detail, client_row_id, prev_hash, entry_hash, payload_json FROM org_audit_log ORDER BY org_slug, seq`
    ).all();
  } catch (e) {
    console.warn(`[d1-backup] run_id=${runId} org_audit_log query skipped:`, e?.message || e);
  }

  const dump = {
    meta: {
      kind: "mysafeops_d1_dump",
      exported_at: now.toISOString(),
      cron: cron || "",
      run_id: runId || undefined,
      tables: { org_sync_kv: (kv.results || []).length, org_audit_log: (audit.results || []).length },
    },
    org_sync_kv: kv.results || [],
    org_audit_log: audit.results || [],
  };

  const body = JSON.stringify(dump);
  const u8 = new TextEncoder().encode(body);

  await BUCKET.put(key, u8, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { exportedAt: now.toISOString(), runId: runId || "" },
  });

  console.log(`[d1-backup] run_id=${runId} wrote ${key} (${u8.byteLength} bytes)`);
}
