import { describe, expect, it, afterEach } from "vitest";
import {
  checkRateLimit,
  rejectIfRateLimited,
  clampAnthropicBody,
  getClientIp,
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
  const prodEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prodEnv;
    process.env.VERCEL_ENV = vercelEnv;
  });

  it("allows matching origin host", () => {
    expect(
      isSameSiteApiRequest({ headers: { origin: "https://app.example.com", host: "app.example.com" } })
    ).toBe(true);
  });

  it("allows missing origin when sec-fetch-site is same-origin", () => {
    expect(
      isSameSiteApiRequest({ headers: { host: "app.example.com", "sec-fetch-site": "same-origin" } })
    ).toBe(true);
  });

  it("rejects cross-origin calls", () => {
    expect(
      isSameSiteApiRequest({ headers: { origin: "https://evil.example.com", host: "app.example.com" } })
    ).toBe(false);
  });

  it("rejects missing origin in production (curl abuse)", () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    expect(isSameSiteApiRequest({ headers: { host: "app.example.com" } })).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers x-forwarded-for, then x-real-ip, then socket", () => {
    expect(getClientIp({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })).toBe("1.1.1.1");
    expect(getClientIp({ headers: { "x-real-ip": "3.3.3.3" } })).toBe("3.3.3.3");
    expect(getClientIp({ headers: {}, socket: { remoteAddress: "4.4.4.4" } })).toBe("4.4.4.4");
    expect(getClientIp({ headers: {} })).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  it("allows requests under the max and blocks once exceeded", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit(key, { max: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, { max: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const a = `test-a:${Math.random()}`;
    const b = `test-b:${Math.random()}`;
    expect(checkRateLimit(a, { max: 1, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(a, { max: 1, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit(b, { max: 1, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    const key = `test-reset:${Math.random()}`;
    expect(checkRateLimit(key, { max: 1, windowMs: 10 }).allowed).toBe(true);
    expect(checkRateLimit(key, { max: 1, windowMs: 10 }).allowed).toBe(false);
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, { max: 1, windowMs: 10 }).allowed).toBe(true);
        resolve();
      }, 25);
    });
  });
});

describe("rejectIfRateLimited", () => {
  it("sends 429 when the limit is exceeded", () => {
    const routeKey = `route:${Math.random()}`;
    const req = { headers: { "x-forwarded-for": "9.9.9.9" } };
    const headers = {};
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      writeHead: () => {},
      end: () => {},
    };
    let statusCode = 0;
    let body = null;
    res.writeHead = (code) => { statusCode = code; };
    res.end = (chunk) => { body = JSON.parse(chunk); };

    expect(rejectIfRateLimited(req, res, routeKey, { max: 1, windowMs: 60_000 })).toBe(false);
    expect(rejectIfRateLimited(req, res, routeKey, { max: 1, windowMs: 60_000 })).toBe(true);
    expect(statusCode).toBe(429);
    expect(body.error).toBe("rate_limited");
    expect(headers["Retry-After"]).toBeTruthy();
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
