import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  __resetD1SyncClientForTests,
  d1GetKv,
  isD1RateLimitedError,
  isD1TransientError,
} from "./d1SyncClient.js";

describe("d1SyncClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_D1_API_URL", "https://d1-worker.test");
    __resetD1SyncClientForTests();
  });

  afterEach(() => {
    __resetD1SyncClientForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "tok" } }, error: null }),
    },
  };

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
    const r = await d1GetKv(supabase, "acme-corp", "permits_v2", "main");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fetch_failed");
  });

  it("maps Worker rate_limited to a shared retry_after_ms and pauses further GETs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name) => (String(name).toLowerCase() === "retry-after" ? "1" : null),
        },
        json: async () => ({ error: "rate_limited" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ value: [], version: 1, updated_at: null }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const first = await d1GetKv(supabase, "acme-corp", "permits_v2", "main");
    expect(first.ok).toBe(false);
    expect(first.error).toBe("rate_limited");
    expect(first.retry_after_ms).toBe(1000);
    expect(isD1RateLimitedError(first.error)).toBe(true);
    expect(isD1TransientError(first.error)).toBe(true);

    const t0 = Date.now();
    const second = await d1GetKv(supabase, "acme-corp", "geo_photos", "main");
    expect(second.ok).toBe(true);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent GETs and caches successful responses briefly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ value: [{ id: 1 }], version: 3, updated_at: "t" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const [ra, rb] = await Promise.all([
      d1GetKv(supabase, "acme-corp", "mysafeops_projects", "main"),
      d1GetKv(supabase, "acme-corp", "mysafeops_projects", "main"),
    ]);
    expect(ra).toEqual(rb);
    expect(ra.value).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = await d1GetKv(supabase, "acme-corp", "mysafeops_projects", "main");
    expect(cached.ok).toBe(true);
    expect(cached.version).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
