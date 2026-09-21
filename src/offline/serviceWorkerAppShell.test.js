import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const SW_PATH = join(process.cwd(), "public", "service-worker.js");

function loadServiceWorker(cachesMatch = async () => undefined) {
  const code = readFileSync(SW_PATH, "utf8");
  const sandbox = {
    self: {
      addEventListener() {},
      skipWaiting() {},
      clients: { claim() {} },
      location: { origin: "https://mysafeops.example" },
    },
    caches: {
      match: cachesMatch,
      open: async () => ({ add: async () => {}, put: async () => {} }),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => new Response("ok", { status: 200 }),
    Response,
    URL,
    Promise,
    console,
  };
  vm.runInNewContext(
    `${code}
this.isAppShellRequest = isAppShellRequest;
this.isDocumentNavigation = isDocumentNavigation;
this.matchAppShell = matchAppShell;
this.SW_VERSION = SW_VERSION;
this.PRECACHE_ASSETS = PRECACHE_ASSETS;
this.offlineFallbackResponse = offlineFallbackResponse;
`,
    sandbox
  );
  return sandbox;
}

describe("service worker SPA shell", () => {
  let sw;

  beforeEach(() => {
    sw = loadServiceWorker();
  });

  it("bumps cache version and precaches /app so /app?view= is not a 503 miss", () => {
    expect(sw.SW_VERSION).toBe("mysafeops-v1.4.2");
    expect(sw.PRECACHE_ASSETS).toContain("/app");
    expect(sw.PRECACHE_ASSETS).toContain("/index.html");
  });

  it("treats /app?view=settings as the SPA shell even when the request is not a navigation", () => {
    const url = new URL("https://mysafeops.example/app?view=settings");
    expect(sw.isAppShellRequest({ mode: "cors", destination: "" }, url)).toBe(true);
    expect(sw.isAppShellRequest({ mode: "navigate", destination: "document" }, url)).toBe(true);
  });

  it("does not treat marketing or blog documents as the SPA shell", () => {
    const blog = new URL("https://mysafeops.example/blog/permit-to-work");
    const landing = new URL("https://mysafeops.example/");
    const req = { mode: "navigate", destination: "document" };
    expect(sw.isAppShellRequest(req, blog)).toBe(false);
    expect(sw.isAppShellRequest(req, landing)).toBe(false);
    expect(sw.isDocumentNavigation(req)).toBe(true);
  });

  it("matchAppShell returns cached index.html before a bare 503 Offline body", async () => {
    const index = new Response("<html>app</html>", { status: 200 });
    sw = loadServiceWorker(async (key) => (key === "/index.html" ? index : undefined));
    const hit = await sw.matchAppShell();
    expect(await hit.text()).toBe("<html>app</html>");
  });

  it("matchAppShell falls back to a 503 Offline body only when nothing is cached", async () => {
    const hit = await sw.matchAppShell();
    expect(hit.status).toBe(503);
    expect(await hit.text()).toBe("Offline");
  });
});
