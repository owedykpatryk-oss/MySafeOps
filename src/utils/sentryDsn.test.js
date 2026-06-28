import { describe, expect, it } from "vitest";
import { isValidSentryBrowserDsn } from "./sentryDsn.js";

describe("isValidSentryBrowserDsn", () => {
  it("accepts a standard ingest DSN", () => {
    expect(
      isValidSentryBrowserDsn(
        "https://abc123@o123456.ingest.us.sentry.io/7890123"
      )
    ).toBe(true);
  });

  it("rejects empty, javascript, and malformed values", () => {
    expect(isValidSentryBrowserDsn("")).toBe(false);
    expect(isValidSentryBrowserDsn("javascript:alert(1)")).toBe(false);
    expect(isValidSentryBrowserDsn("https://example.com/no-sentry")).toBe(false);
  });
});
