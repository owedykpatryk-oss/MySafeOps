import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("d1SyncClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_D1_API_URL", "https://d1-worker.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("d1GetKv includes request_id from response header on HTTP error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: {
        get: (name) => (String(name).toLowerCase() === "x-request-id" ? "req-uuid-1" : null),
      },
      json: async () => ({ error: "forbidden" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { d1GetKv } = await import("./d1SyncClient.js");
    const supabase = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "tok" } }, error: null }),
      },
    };
    const r = await d1GetKv(supabase, "acme-corp", "permits_v2", "main");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("forbidden");
    expect(r.request_id).toBe("req-uuid-1");
  });

  it("d1GetKv returns fetch_failed when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    const { d1GetKv } = await import("./d1SyncClient.js");
    const supabase = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "tok" } }, error: null }),
      },
    };
    const r = await d1GetKv(supabase, "acme-corp", "permits_v2", "main");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fetch_failed");
  });
});
