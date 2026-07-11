import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "./contentSecurityPolicy.js";

describe("CONTENT_SECURITY_POLICY", () => {
  it("enforces default-src self and blocks object embeds", () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/default-src 'self'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/object-src 'none'/);
  });

  it("does not allow direct browser calls to proxied upstreams", () => {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/overpass-api\.de/);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/api\.postcodes\.io/);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/api\.anthropic\.com/);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/api\.openweathermap\.org/);
  });

  it("allows Sentry and same-origin API proxies", () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/ingest\.sentry\.io/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src 'self'/);
  });
});
