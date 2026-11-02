import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { renderOfflineWorker } from "../../scripts/offlinePrecache.mjs";

it("installs when an optional asset is unavailable but requires the offline shell", async () => {
  const listeners = {};
  const addAll = vi.fn().mockResolvedValue(undefined);
  const add = vi.fn((url) => url === "/vite.svg" ? Promise.reject(new Error("404")) : Promise.resolve());
  const source = renderOfflineWorker(
    readFileSync(new URL("../../public/service-worker.js", import.meta.url), "utf8"),
    ["/assets/app-123.js", "/assets/app-123.css", "/assets/logo-123.png"],
    "test"
  );
  runInNewContext(source, {
    self: { location: { origin: "https://app.example" }, addEventListener: (type, fn) => { listeners[type] = fn; } },
    caches: { open: vi.fn().mockResolvedValue({ addAll, add }) },
    Response,
    URL,
  });

  let installPromise;
  listeners.install({ waitUntil: (promise) => { installPromise = promise; } });
  await expect(installPromise).resolves.toBeUndefined();
  expect(addAll).toHaveBeenCalledWith(["/index.html", "/offline.html", "/assets/app-123.css", "/assets/app-123.js"]);
  expect(add).toHaveBeenCalledWith("/vite.svg");
  expect(add).toHaveBeenCalledWith("/assets/logo-123.png");

  addAll.mockRejectedValueOnce(new Error("offline shell unavailable"));
  listeners.install({ waitUntil: (promise) => { installPromise = promise; } });
  await expect(installPromise).rejects.toThrow("offline shell unavailable");
});

it("serves the cached app shell when navigation loses network access", async () => {
  const listeners = {};
  const shell = new Response("<html>App</html>", { headers: { "Content-Type": "text/html" } });
  const match = vi.fn((url) => Promise.resolve(url === "/index.html" ? shell : undefined));
  const source = readFileSync(new URL("../../public/service-worker.js", import.meta.url), "utf8");
  runInNewContext(source, {
    self: { location: { origin: "https://app.example" }, addEventListener: (type, fn) => { listeners[type] = fn; } },
    caches: { match },
    fetch: vi.fn().mockRejectedValue(new Error("network unavailable")),
    Response,
    URL,
  });

  let responsePromise;
  listeners.fetch({
    request: { method: "GET", url: "https://app.example/app?view=gpr-report", mode: "navigate" },
    respondWith: (promise) => { responsePromise = promise; },
  });

  expect((await responsePromise).status).toBe(200);
  expect(match).toHaveBeenCalledWith("/index.html");
});
