/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { d1AppendServerAudit, __resetD1SyncClientForTests } from "./d1SyncClient";
import { cacheActiveCountryWorkspace } from "../utils/countryWorkspaces";

beforeEach(() => {
  localStorage.clear();
  __resetD1SyncClientForTests();
  vi.stubEnv("VITE_D1_API_URL", "https://d1.example");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("captures the originating country before waiting for authentication", async () => {
  const id = "11111111-2222-4333-8444-555555555555";
  cacheActiveCountryWorkspace({ id, is_primary: false }, "acme");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ seq: 1 }));
  vi.stubGlobal("fetch", fetchMock);
  const supabase = { auth: { getSession: async () => {
    cacheActiveCountryWorkspace({ id: "primary", is_primary: true }, "acme");
    return { data: { session: { access_token: "fixture" } } };
  } } };
  expect(await d1AppendServerAudit(supabase, "acme", { action: "save", entity: "project" })).toMatchObject({ ok: true });
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get("key")).toBe(`country:${id}:main`);
});

it("keeps the original audit route for the primary country", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ seq: 2 }));
  vi.stubGlobal("fetch", fetchMock);
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: "fixture" } } }) } };
  await d1AppendServerAudit(supabase, "acme", { action: "save", entity: "project" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://d1.example/v1/audit/append");
});
