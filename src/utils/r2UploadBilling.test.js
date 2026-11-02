import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../cloudflare/workers/r2-upload/index.mjs";

afterEach(() => vi.unstubAllGlobals());

function setup({ allowed = true, missingRpc = false, countryAllowed = true, quotaAllowed = true } = {}) {
  const fetchMock = vi.fn(async (url) => {
    if (url.includes("/auth/v1/user")) return Response.json({ id: "member" });
    if (url.includes("/user_can_write_org_slug")) return missingRpc ? new Response("Missing", { status: 404 }) : Response.json(allowed);
    if (url.includes("/user_can_access_org_slug")) return Response.json(true);
    if (url.includes("/user_can_write_org_country_kv") || url.includes("/user_can_read_org_country_kv")) return Response.json(countryAllowed);
    if (url.includes("/user_is_platform_owner")) return Response.json(false);
    if (url.includes("/org_country_workspaces?")) return Response.json([{ is_primary: false }]);
    if (url.includes("/get_my_org_billing") || url.includes("/get_my_country_workspace_entitlements")) return Response.json([{ workspace_id: "11111111-2222-4333-8444-555555555555", billing_plan: "starter", subscription_status: "active" }]);
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const env = { SUPABASE_URL: "https://supabase.example", SUPABASE_ANON_KEY: "test-key", BUCKET: { put: vi.fn(), get: vi.fn(async () => ({ body: "saved", size: 5, httpMetadata: { contentType: "text/plain" } })) } };
  env.STORAGE_QUOTA = { idFromName: vi.fn((id) => id), get: () => ({ upload: async (...args) => { if (!quotaAllowed) return { ok: false, error: "storage_limit_reached" }; await env.BUCKET.put(...args); return { ok: true }; }, usage: async () => ({ bytes: 42 }) }) };
  return { env, fetchMock };
}

function uploadRequest(key = "documents/org_acme/file.txt") {
  const form = new FormData();
  form.append("file", new Blob(["test"], { type: "text/plain" }), "file.txt");
  form.append("key", key);
  return new Request("https://worker.example/upload", { method: "POST", headers: { Authorization: "Bearer test-session" }, body: form });
}

describe("R2 server billing gate", () => {
  it("returns matching CORS headers for permitted preview usage reads and rejects other origins", async () => {
    const { env } = setup();
    env.ALLOWED_ORIGINS = "https://www.mysafeops.com,vercel_preview:mysafeops";
    for (const origin of ["https://www.mysafeops.com", "https://mysafeops-qa.vercel.app"]) {
      const response = await worker.fetch(new Request("https://worker.example/usage?org=acme", { headers: { Origin: origin, Authorization: "Bearer test-session" } }), env);
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(await response.json()).toEqual({ bytes: 42 });
    }
    const rejected = await worker.fetch(new Request("https://worker.example/usage?org=acme", { headers: { Origin: "https://other.vercel.app", Authorization: "Bearer test-session" } }), env);
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("Access-Control-Allow-Origin")).toBe("null");
  });
  it("uses a paid secondary country even when the primary subscription has expired", async () => {
    const { env, fetchMock } = setup({ allowed: false });
    expect((await worker.fetch(uploadRequest("files/org_acme/country_11111111-2222-4333-8444-555555555555/doc.txt"), env)).status).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("user_can_write_org_slug"))).toBe(false);
    expect(env.STORAGE_QUOTA.idFromName).toHaveBeenCalledWith("acme:11111111-2222-4333-8444-555555555555");
  });
  it("does not use the primary plan to pay for an unsubscribed country", async () => {
    const { env } = setup({ countryAllowed: false });
    expect((await worker.fetch(uploadRequest("files/org_acme/country_11111111-2222-4333-8444-555555555555/doc.txt"), env)).status).toBe(403);
    expect(env.BUCKET.put).not.toHaveBeenCalled();
  });
  it("rejects quota overflow and ambiguous organisation paths", async () => {
    const { env } = setup({ quotaAllowed: false });
    const response = await worker.fetch(uploadRequest(), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "storage_limit_reached" });
    expect((await worker.fetch(uploadRequest("documents/org_acme/org_other/file.txt"), env)).status).toBe(400);
    expect(env.BUCKET.put).not.toHaveBeenCalled();
  });
  it("refuses an upload for an expired or unpaid organisation before storing bytes", async () => {
    const { env } = setup({ allowed: false });
    const response = await worker.fetch(uploadRequest(), env);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "billing_write_blocked" });
    expect(env.BUCKET.put).not.toHaveBeenCalled();
  });
  it("stores uploads when the server confirms write access", async () => {
    const { env } = setup();
    expect((await worker.fetch(uploadRequest(), env)).status).toBe(200);
    expect(env.BUCKET.put).toHaveBeenCalledOnce();
  });
  it("does not fall back to membership when the billing RPC is unavailable", async () => {
    const { env } = setup({ missingRpc: true });
    expect((await worker.fetch(uploadRequest(), env)).status).toBe(403);
    expect(env.BUCKET.put).not.toHaveBeenCalled();
  });
  it("still allows a member to download existing records after trial expiry", async () => {
    const { env, fetchMock } = setup({ allowed: false });
    const response = await worker.fetch(new Request("https://worker.example/object?key=documents/org_acme/file.txt", { headers: { Authorization: "Bearer test-session" } }), env);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("user_can_write_org_slug"))).toBe(false);
  });
});
