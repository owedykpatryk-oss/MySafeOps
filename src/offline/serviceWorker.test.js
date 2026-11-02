import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("uses a cached app shell on a transient navigation HTTP failure without caching the failure", async () => {
  const listeners = {},
    put = vi.fn();
  const caches = {
    open: vi.fn().mockResolvedValue({ put }),
    match: vi.fn().mockResolvedValue(new Response("QA cached shell")),
  };
  runInNewContext(readFileSync(new URL("../../public/service-worker.js", import.meta.url), "utf8"), {
    self: {
      location: { origin: "https://app.example" },
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
    },
    caches,
    fetch: vi.fn().mockResolvedValue(new Response("Offline", { status: 503 })),
    Response,
    URL,
  });
  let responsePromise;
  listeners.fetch({
    request: { method: "GET", url: "https://app.example/app?view=drone-operations", mode: "navigate" },
    respondWith: (p) => {
      responsePromise = p;
    },
    waitUntil: vi.fn(),
  });
  expect(await (await responsePromise).text()).toBe("QA cached shell");
  expect(put).not.toHaveBeenCalled();
});

it("keeps a runtime cache write alive until it finishes", async () => {
  const listeners = {};
  let finishPut;
  const put = vi.fn(
    () =>
      new Promise((resolve) => {
        finishPut = resolve;
      })
  );
  const caches = { open: vi.fn().mockResolvedValue({ put }), match: vi.fn() };
  const source = readFileSync(new URL("../../public/service-worker.js", import.meta.url), "utf8");
  runInNewContext(source, {
    self: {
      location: { origin: "https://app.example" },
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
    },
    caches,
    fetch: vi.fn().mockResolvedValue(new Response("cached text")),
    Response,
    URL,
  });

  const lifetime = [];
  let responsePromise;
  listeners.fetch({
    request: { method: "GET", url: "https://app.example/guide.txt", mode: "cors" },
    respondWith: (promise) => {
      responsePromise = promise;
    },
    waitUntil: (promise) => {
      lifetime.push(promise);
    },
  });

  expect((await responsePromise).status).toBe(200);
  expect(lifetime).toHaveLength(1);
  expect(put).toHaveBeenCalledWith(
    expect.objectContaining({ url: "https://app.example/guide.txt" }),
    expect.any(Response)
  );
  finishPut();
  await Promise.all(lifetime);
});
