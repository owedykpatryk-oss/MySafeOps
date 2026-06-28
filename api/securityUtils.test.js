import { describe, expect, it, afterEach } from "vitest";
import {
  clampAnthropicBody,
  isSameSiteApiRequest,
  isVercelProduction,
  parseBoundedJson,
  sanitizeWebVitalsPayload,
  timingSafeEqual,
} from "./securityUtils.js";

describe("timingSafeEqual", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqual("secret", "secret")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(timingSafeEqual("secret", "Secret")).toBe(false);
    expect(timingSafeEqual("a", "ab")).toBe(false);
  });
});

describe("sanitizeWebVitalsPayload", () => {
  it("accepts known metrics", () => {
    expect(sanitizeWebVitalsPayload({ name: "LCP", value: 1.2, id: "v1", path: "/app" })).toEqual({
      name: "LCP",
      value: 1.2,
      id: "v1",
      path: "/app",
    });
  });

  it("rejects unknown metrics and injection in path", () => {
    expect(sanitizeWebVitalsPayload({ name: "EVIL", value: 1 })).toBeNull();
    const clean = sanitizeWebVitalsPayload({ name: "CLS", value: 0.01, path: "/ok\ninjected" });
    expect(clean.path).toBe("/okinjected");
  });
});

describe("isVercelProduction", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("is true only on Vercel production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isVercelProduction()).toBe(true);
    process.env.VERCEL_ENV = "preview";
    expect(isVercelProduction()).toBe(false);
    delete process.env.VERCEL_ENV;
    expect(isVercelProduction()).toBe(false);
  });
});

describe("clampAnthropicBody", () => {
  it("requires model and messages", () => {
    expect(clampAnthropicBody({})).toBeNull();
    expect(clampAnthropicBody({ model: "x", messages: [] })).toEqual({ model: "x", messages: [] });
  });

  it("caps max_tokens", () => {
    const out = clampAnthropicBody({ model: "x", messages: [{ role: "user", content: "hi" }], max_tokens: 99999 });
    expect(out.max_tokens).toBe(8192);
  });
});

describe("isSameSiteApiRequest", () => {
  it("allows missing origin and matching host", () => {
    expect(isSameSiteApiRequest({ headers: { host: "app.example.com" } })).toBe(true);
    expect(
      isSameSiteApiRequest({ headers: { origin: "https://app.example.com", host: "app.example.com" } })
    ).toBe(true);
  });

  it("rejects cross-origin calls", () => {
    expect(
      isSameSiteApiRequest({ headers: { origin: "https://evil.example.com", host: "app.example.com" } })
    ).toBe(false);
  });
});

describe("parseBoundedJson", () => {
  it("parses valid JSON within limit", () => {
    expect(parseBoundedJson('{"ok":true}')).toEqual({ value: { ok: true } });
  });

  it("rejects oversized payloads", () => {
    expect(parseBoundedJson("x".repeat(100), 50).error).toBe("too_large");
  });
});
