// Real SQLite exercises the worker SQL, including writes that race after the same read.
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../cloudflare/workers/d1-api/index.mjs";
import { BILLING_PLAN_LIMITS } from "../../shared/billingPlanLimits.mjs";
import { BILLING_PLANS, TRIAL_PLAN } from "../lib/billingPlans";

let db, env, plan, owner, unavailable, primaryCountry, primaryWritable, countryWritable;
const countryId = "11111111-2222-4333-8444-555555555555";
const headers = { Authorization: "Bearer test-session", "X-Org-Slug": "acme", "Content-Type": "application/json" };
beforeEach(() => {
  plan = "starter"; owner = false; unavailable = false; primaryCountry = false;
  primaryWritable = true; countryWritable = true;
  db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE org_sync_kv (org_slug TEXT, namespace TEXT, data_key TEXT, value_json TEXT, version INTEGER, updated_at TEXT, PRIMARY KEY (org_slug, namespace, data_key))");
  env = { SUPABASE_URL: "https://supabase.example", SUPABASE_ANON_KEY: "test", DB: {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async run() { return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; },
      };
    },
  } };
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url.endsWith("/user_can_write_org_slug")) return Response.json(primaryWritable);
    if (url.endsWith("/user_can_write_org_country_kv") || url.endsWith("/user_can_delete_org_country_kv")) return Response.json(countryWritable);
    if (url.endsWith("/user_is_platform_owner")) return Response.json(owner);
    if (url.includes("/org_country_workspaces?")) return Response.json([{ is_primary: primaryCountry }]);
    if (url.endsWith("/get_my_org_billing") || url.endsWith("/get_my_country_workspace_entitlements")) {
      if (unavailable) return new Response("Unavailable", { status: 503 });
      return Response.json([{ workspace_id: countryId, billing_plan: plan, subscription_status: plan ? "active" : "none", trial_ends_at: plan ? null : "2099-01-01" }]);
    }
    return Response.json(true); // Existing role and billing gates approve.
  }));
});
afterEach(() => { db.close(); vi.unstubAllGlobals(); });
const rows = (count) => Array.from({ length: count }, (_, i) => ({ id: `row${i}` }));
function seed(value, namespace = "mysafeops_workers", key = "main") {
  db.prepare("INSERT INTO org_sync_kv VALUES (?, ?, ?, ?, ?, ?)").run("acme", namespace, key, JSON.stringify(value), 1, "2026-10-05");
}
function put(value, { namespace = "mysafeops_workers", key = "main", ifVersion } = {}) {
  return worker.fetch(new Request("https://worker.example/v1/kv", { method: "PUT", headers, body: JSON.stringify({ namespace, key, value, ifVersion }) }), env);
}
function saved(namespace = "mysafeops_workers", key = "main") {
  const row = db.prepare("SELECT * FROM org_sync_kv WHERE namespace = ? AND data_key = ?").get(namespace, key);
  return row && { ...row, value: JSON.parse(row.value_json) };
}

describe("authoritative D1 quotas and atomic saves", () => {
  it.each(["starter", "team", "business", "enterprise"])("enforces both exact caps for %s", async (paidPlan) => {
    plan = paidPlan;
    for (const [kind, namespace] of [["workers", "mysafeops_workers"], ["projects", "mysafeops_projects"]]) {
      const limit = BILLING_PLAN_LIMITS[plan][kind];
      expect((await put(rows(limit), { namespace })).status).toBe(200);
      expect((await put(rows(limit + 1), { namespace })).status).toBe(403);
      expect(saved(namespace).value).toHaveLength(limit);
    }
  });
  it("applies an upgrade immediately and keeps custom Enterprise Plus unrestricted", async () => {
    expect((await put(rows(6))).status).toBe(403);
    plan = "team";
    expect((await put(rows(6))).status).toBe(200);
    plan = "enterprise_plus";
    expect((await put(rows(1001))).status).toBe(200);
  });
  it("keeps frontend and server caps identical", () => {
    for (const [id, limits] of Object.entries(BILLING_PLAN_LIMITS)) expect((id === "trial" ? TRIAL_PLAN : BILLING_PLANS[id]).limits).toEqual(limits);
  });
  it("allows the fifth live worker but rejects the sixth even without a client version", async () => {
    expect((await put(rows(5))).status).toBe(200);
    const denied = await put(rows(6));
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: "billing_limit_reached", count: 6, limit: 5 });
    expect(saved().value).toHaveLength(5);
  });
  it("ignores tombstones and closed projects", async () => {
    expect((await put([...rows(5), { id: "deleted", deletedAt: "2026-10-05" }])).status).toBe(200);
    const projects = [...rows(100), { id: "closed", closed: true }, { id: "deleted", deletedAt: "2026-10-05" }];
    expect((await put(projects, { namespace: "mysafeops_projects" })).status).toBe(200);
    expect((await put([...projects, { id: "new" }], { namespace: "mysafeops_projects" })).status).toBe(403);
  });
  it("allows edits and reductions after downgrade without allowing growth", async () => {
    seed(rows(8));
    expect((await put(rows(8))).status).toBe(200);
    expect((await put(rows(9))).status).toBe(403);
    expect((await put(rows(7))).status).toBe(200);
  });
  it("uses a country's subscription and refuses alternate quota keys", async () => {
    plan = "team";
    expect((await put(rows(20), { key: `country:${countryId}:main` })).status).toBe(200);
    expect((await put(rows(21), { key: `country:${countryId}:main` })).status).toBe(403);
    expect((await put(rows(1), { key: "another-list" })).status).toBe(400);
    primaryCountry = true;
    expect((await put(rows(1), { key: `country:${countryId}:main` })).status).toBe(400);
  });
  it("does not silently grant limits when billing cannot be loaded", async () => {
    unavailable = true;
    expect((await put(rows(1))).status).toBe(503);
    expect(saved()).toBeUndefined();
  });
  it("keeps a paid secondary country writable after the primary trial expires", async () => {
    primaryWritable = false;
    expect((await put(rows(1))).status).toBe(403);
    expect((await put(rows(1), { key: `country:${countryId}:main` })).status).toBe(200);
    countryWritable = false;
    expect((await put(rows(2), { key: `country:${countryId}:main` })).status).toBe(403);
  });
  it("preserves owner and evaluation entitlements", async () => {
    plan = null;
    expect((await put(rows(200))).status).toBe(200);
    expect((await put(rows(201))).status).toBe(403);
    owner = true;
    expect((await put(rows(201))).status).toBe(200);
  });
  it.each([false, true])("rejects a racing writer instead of overwriting a newer version (existing=%s)", async (existing) => {
    if (existing) seed([{ id: "initial" }]);
    const results = await Promise.all([put([{ id: "a" }]), put([{ id: "b" }])]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(saved().version).toBe(existing ? 2 : 1);
    expect(saved().value).toHaveLength(1);
  });
  it("rejects stale explicit versions and missing values", async () => {
    seed(rows(1));
    expect((await put(rows(2), { ifVersion: 0 })).status).toBe(409);
    expect((await put(undefined)).status).toBe(400);
    expect(saved().value).toHaveLength(1);
  });
});
