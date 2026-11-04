/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TurnstileWidget from "./TurnstileWidget";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../config/turnstile", () => ({
  isTurnstileEnabled: () => true,
  isTurnstileTestKeyOnProductionHost: () => false,
  TURNSTILE_SITE_KEY: "test-site-key",
}));

let host;
let root;
let callbacks;
let onTokenChange;
let onUnavailable;

beforeEach(async () => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  onTokenChange = vi.fn();
  onUnavailable = vi.fn();
  window.turnstile = {
    render: vi.fn((container, options) => {
      callbacks = options;
      container.append(document.createElement("iframe"));
      return "widget-id";
    }),
    remove: vi.fn(),
  };
  await act(async () => {
    root.render(<TurnstileWidget onTokenChange={onTokenChange} onUnavailable={onUnavailable} />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete window.turnstile;
  vi.useRealTimers();
});

it("can retry a script that never finishes loading", async () => {
  await act(async () => root.unmount());
  root = createRoot(host);
  delete window.turnstile;
  await act(async () => {
    root.render(<TurnstileWidget onTokenChange={onTokenChange} onUnavailable={onUnavailable} />);
  });
  const firstScript = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
  expect(firstScript).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(30000));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => host.querySelector('[role="alert"] button').click());
  const nextScript = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
  expect(nextScript).not.toBe(firstScript);
  await act(async () => nextScript.dispatchEvent(new Event("error")));
});

it("waits for Turnstile's automatic retry and clears the pending error when a token arrives", async () => {
  let retryResult;
  await act(async () => { retryResult = callbacks["error-callback"]("200500"); });
  expect(retryResult).toBe(false);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[role="status"]').textContent).toMatch(/verifying your security check/i);
  await act(async () => vi.advanceTimersByTime(10000));
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => callbacks.callback("valid-token"));
  await act(async () => vi.advanceTimersByTime(30000));
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(onTokenChange).toHaveBeenLastCalledWith("valid-token");
  expect(onUnavailable).toHaveBeenLastCalledWith(false);
});

it("reports a persistent retry failure while keeping authentication blocked", async () => {
  await act(async () => callbacks["error-callback"]("200500"));
  await act(async () => vi.advanceTimersByTime(25000));
  expect(host.querySelector('[role="alert"]').textContent).toMatch(/security check could not load/i);
  expect(onTokenChange).toHaveBeenLastCalledWith("");
  expect(onUnavailable).toHaveBeenLastCalledWith(true);
  await act(async () => callbacks["error-callback"]("200500"));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});

it("reports a non-retryable Turnstile configuration error immediately", async () => {
  let retryResult;
  await act(async () => { retryResult = callbacks["error-callback"]("110100"); });
  expect(retryResult).toBe(true);
  expect(host.querySelector('[role="alert"]').textContent).toMatch(/contact support/i);
  expect(onUnavailable).toHaveBeenLastCalledWith(true);
});

it("keeps waiting when the Turnstile script loads after five seconds", async () => {
  await act(async () => root.unmount());
  root = createRoot(host);
  delete window.turnstile;
  await act(async () => {
    root.render(<TurnstileWidget onTokenChange={onTokenChange} onUnavailable={onUnavailable} />);
  });
  await act(async () => vi.advanceTimersByTime(6000));
  expect(host.querySelector('[role="alert"]')).toBeNull();

  window.turnstile = {
    render: vi.fn((container, options) => {
      callbacks = options;
      container.append(document.createElement("iframe"));
      return "widget-id";
    }),
    remove: vi.fn(),
  };
  const script = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
  await act(async () => script.dispatchEvent(new Event("load")));
  await act(async () => callbacks.callback("valid-token"));
  expect(host.querySelector('[role="alert"]')).toBeNull();
  script.remove();
});

it("can retry after the Turnstile script emits a load error", async () => {
  await act(async () => root.unmount());
  root = createRoot(host);
  delete window.turnstile;
  await act(async () => {
    root.render(<TurnstileWidget onTokenChange={onTokenChange} onUnavailable={onUnavailable} />);
  });
  const firstScript = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
  await act(async () => firstScript.dispatchEvent(new Event("error")));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => host.querySelector('[role="alert"] button').click());
  const nextScript = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');
  expect(nextScript).not.toBe(firstScript);
  nextScript?.remove();
});
