import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("authCaptcha", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips token requirement when Turnstile is not configured", async () => {
    vi.resetModules();
    const { requireCaptchaToken, withCaptchaOptions } = await import("./authCaptcha.js");
    expect(requireCaptchaToken("")).toBeNull();
    expect(withCaptchaOptions({ emailRedirectTo: "x" }, "")).toEqual({ emailRedirectTo: "x" });
  });

  it("requires token when site key is set", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    vi.resetModules();
    const { requireCaptchaToken, withCaptchaOptions } = await import("./authCaptcha.js");
    expect(requireCaptchaToken("")).toMatch(/security check/i);
    expect(withCaptchaOptions({}, "tok_abc")).toEqual({ captchaToken: "tok_abc" });
  });
});
