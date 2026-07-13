import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseBearerToken, verifySupabaseAccessToken } from "./verifySupabaseAuth.js";

describe("verifySupabaseAuth", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("parseBearerToken extracts bearer tokens", () => {
    expect(parseBearerToken({ headers: { authorization: "Bearer abc.def" } })).toBe("abc.def");
    expect(parseBearerToken({ headers: {} })).toBe("");
  });

  it("verifySupabaseAccessToken returns user on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "user-1", email: "a@example.com" }),
      }))
    );
    const user = await verifySupabaseAccessToken("jwt-token");
    expect(user).toEqual({ id: "user-1", email: "a@example.com" });
  });

  it("verifySupabaseAccessToken returns null on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    );
    expect(await verifySupabaseAccessToken("bad")).toBeNull();
  });
});
