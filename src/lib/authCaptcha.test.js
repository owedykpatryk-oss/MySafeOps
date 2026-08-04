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
    const { requireCaptchaToken, withCaptchaOptions, validateAuthCaptchaState, captchaBlocksAuthSubmit } =
      await import("./authCaptcha.js");
    expect(requireCaptchaToken("")).toBeNull();
    expect(withCaptchaOptions({ emailRedirectTo: "x" }, "")).toEqual({ emailRedirectTo: "x" });
    expect(validateAuthCaptchaState({ configured: false, token: "" })).toBeNull();
    expect(captchaBlocksAuthSubmit({ configured: false, token: "" })).toBe(false);
  });

  it("requires token when site key is set", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    vi.resetModules();
    const { requireCaptchaToken, withCaptchaOptions, validateAuthCaptchaState, captchaBlocksAuthSubmit } =
      await import("./authCaptcha.js");
    expect(requireCaptchaToken("")).toMatch(/security check/i);
    expect(withCaptchaOptions({}, "tok_abc")).toEqual({ captchaToken: "tok_abc" });
    expect(validateAuthCaptchaState({ configured: true, token: "" })).toMatch(/security check/i);
    expect(captchaBlocksAuthSubmit({ configured: true, token: "" })).toBe(true);
    expect(captchaBlocksAuthSubmit({ configured: true, token: "tok" })).toBe(false);
  });

  it("blocks with load-failure message when configured but unavailable (fail-closed)", async () => {
    vi.resetModules();
    const { validateAuthCaptchaState, captchaBlocksAuthSubmit, CAPTCHA_LOAD_FAILED_MSG } =
      await import("./authCaptcha.js");
    expect(validateAuthCaptchaState({ configured: true, unavailable: true, token: "" })).toBe(
      CAPTCHA_LOAD_FAILED_MSG
    );
    // Even a stale token must not bypass unavailable (widget is dead).
    expect(validateAuthCaptchaState({ configured: true, unavailable: true, token: "stale" })).toBe(
      CAPTCHA_LOAD_FAILED_MSG
    );
    expect(captchaBlocksAuthSubmit({ configured: true, unavailable: true, token: "stale" })).toBe(true);
  });

  it("detects captcha infrastructure errors so lockout is not incremented", async () => {
    vi.resetModules();
    const { isAuthCaptchaInfrastructureError } = await import("./authCaptcha.js");
    expect(
      isAuthCaptchaInfrastructureError({ message: "request disallowed (no captcha_token found)" })
    ).toBe(true);
    expect(isAuthCaptchaInfrastructureError({ message: "captcha verification failed" })).toBe(true);
    expect(isAuthCaptchaInfrastructureError({ message: "Invalid login credentials" })).toBe(false);
  });
});
