import { afterEach, describe, expect, it, vi } from "vitest";
import { isNativeApp } from "./appRuntime";
import { getPublicAppOrigin, publicAppUrl } from "./publicAppUrl";
import { buildInductionLink } from "./inductionLink";

function setRuntime(href, native = false) {
  vi.stubGlobal("window", {
    location: new URL(href),
    Capacitor: { isNativePlatform: () => native },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public app links", () => {
  it.each(["https://mysafeops.com", "https://preview.example.com", "http://localhost:5173"])(
    "keeps web links on %s even with a production canonical URL",
    (origin) => {
      setRuntime(`${origin}/app?view=rams`);
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://mysafeops.com");
      expect(isNativeApp()).toBe(false);
      expect(publicAppUrl("/accept-invite?invite=a%26b")).toBe(`${origin}/accept-invite?invite=a%26b`);
    },
  );

  it.each(["capacitor://localhost/index.html", "https://localhost/index.html"])(
    "creates a scanable induction link from native origin %s",
    (href) => {
      setRuntime(href, true);
      vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://qa.example.com/");
      expect(isNativeApp()).toBe(true);
      const url = new URL(buildInductionLink(publicAppUrl(), "site & 1", "acme"));
      expect(url.origin).toBe("https://qa.example.com");
      expect(url.pathname).toBe("/app");
      expect(url.searchParams.get("view")).toBe("induction");
      expect(url.searchParams.get("site")).toBe("site & 1");
      expect(url.searchParams.get("org")).toBe("acme");
    },
  );

  it.each(["", "broken", "javascript:alert(1)", "http://example.com", "https://user:password@example.com"])(
    "does not publish an invalid or insecure native share origin: %s",
    (origin) => {
      setRuntime("capacitor://localhost", true);
      vi.stubEnv("VITE_PUBLIC_SITE_URL", origin);
      expect(getPublicAppOrigin()).toBe("https://mysafeops.com");
    },
  );

  it("works without a browser or a Capacitor bridge", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    expect(isNativeApp()).toBe(false);
    expect(publicAppUrl()).toBe("https://mysafeops.com/app");
    vi.stubGlobal("window", { location: new URL("http://localhost:5173") });
    expect(isNativeApp()).toBe(false);
    expect(publicAppUrl()).toBe("http://localhost:5173/app");
  });

  it.each(["https://evil.example/app", "//evil.example/app", "/\\evil.example/app"])(
    "rejects external paths: %s",
    (path) => {
      setRuntime("https://mysafeops.com");
      expect(() => publicAppUrl(path)).toThrow("internal path");
    },
  );
});
