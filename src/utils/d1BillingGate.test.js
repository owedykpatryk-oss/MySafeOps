import { afterEach, expect, it, vi } from "vitest";
import worker from "../../cloudflare/workers/d1-api/index.mjs";

afterEach(() => vi.unstubAllGlobals());
function setup({ writeStatus = 200, writable = true, roleStatus = 200 } = {}) {
  const fetchMock = vi.fn(async (url) => {
    if (url.endsWith("/user_can_write_org_slug")) return writeStatus === 200 ? Response.json(writable) : new Response("Missing", { status: writeStatus });
    if (url.endsWith("/user_can_write_org_country_kv")) return roleStatus === 200 ? Response.json(true) : new Response("Missing", { status: roleStatus });
    if (url.endsWith("/user_can_access_org_slug")) return Response.json(true);
    if (url.endsWith("/user_is_platform_owner")) return Response.json(false);
    if (url.endsWith("/get_my_org_billing")) return Response.json([{ billing_plan: "starter", subscription_status: "active" }]);
    throw new Error(`Unexpected RPC: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const statement = { bind: vi.fn().mockReturnThis(), first: vi.fn(async () => null), run: vi.fn(async () => ({ meta: { changes: 1 } })), all: vi.fn(async () => ({ results: [] })) };
  const env = { SUPABASE_URL: "https://supabase.example", SUPABASE_ANON_KEY: "test", DB: { prepare: vi.fn(() => statement) } };
  return { env, fetchMock, statement };
}
const headers = { Authorization: "Bearer test-session", "X-Org-Slug": "acme", "Content-Type": "application/json" };
function put() {
  return new Request("https://worker.example/v1/kv", { method: "PUT", headers, body: JSON.stringify({ namespace: "mysafeops_workers", key: "main", value: [{ id: "worker1" }] }) });
}

it.each(["PUT", "DELETE", "POST"])("refuses %s mutations when the billing RPC is missing", async (method) => {
  const { env, fetchMock } = setup({ writeStatus: 404 });
  const request = method === "PUT" ? put() : new Request(`https://worker.example${method === "POST" ? "/v1/audit/append" : "/v1/kv?namespace=mysafeops_workers&key=rows"}`, { method, headers });
  const response = await worker.fetch(request, env);
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: "billing_write_gate_missing" });
  expect(env.DB.prepare).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("refuses expired billing and a missing namespace role gate before writing data", async () => {
  for (const options of [{ writable: false }, { roleStatus: 404 }]) {
    const { env } = setup(options);
    expect((await worker.fetch(put(), env)).status).toBe(403);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  }
});

it("writes a record after both server gates approve it", async () => {
  const { env, statement } = setup();
  expect((await worker.fetch(put(), env)).status).toBe(200);
  expect(statement.run).toHaveBeenCalledOnce();
});

it("keeps existing records readable without a writable subscription", async () => {
  const { env, fetchMock } = setup({ writable: false });
  const response = await worker.fetch(new Request("https://worker.example/v1/kv?namespace=mysafeops_workers&list=1", { headers }), env);
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls.every(([url]) => !url.includes("write_org"))).toBe(true);
});

it("records paid-country audit events when the primary subscription has expired", async () => {
  const { env, fetchMock, statement } = setup({ writable: false });
  env.AUDIT_CHAIN_SECRET = "audit-regression-test-secret";
  const id = "11111111-2222-4333-8444-555555555555";
  const response = await worker.fetch(new Request(`https://worker.example/v1/audit/append?key=country:${id}:main`, {
    method: "POST", headers, body: JSON.stringify({ action: "save", entity: "document", extra: { countryWorkspaceId: "forged" } }),
  }), env);
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls.some(([url]) => url.includes("user_can_write_org_slug"))).toBe(false);
  expect(statement.bind.mock.calls.some((args) => args[8] && JSON.parse(args[8]).extra.countryWorkspaceId === id)).toBe(true);
});

it("rejects invalid audit scopes and countries without write permission", async () => {
  const { env } = setup({ roleStatus: 403 });
  for (const [key, status] of [["other", 400], ["country:11111111-2222-4333-8444-555555555555:main", 401]]) {
    const response = await worker.fetch(new Request(`https://worker.example/v1/audit/append?key=${key}`, { method: "POST", headers }), env);
    expect(response.status).toBe(status);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  }
});
