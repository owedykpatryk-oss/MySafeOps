/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container, notify;
function Harness() {
  notify = useToast().pushToast;
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  root = createRoot(container);
  act(() => root.render(<ToastProvider><Harness /></ToastProvider>));
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

it("shows legacy billing/save messages and dismisses them automatically", () => {
  act(() => notify("Solo plan allows up to 5 workers", "warn"));
  expect(container.textContent).toContain("Solo plan allows up to 5 workers");
  expect(container.querySelector(".app-toast--warn")).not.toBeNull();
  act(() => vi.advanceTimersByTime(4500));
  expect(container.querySelector(".app-toast")).toBeNull();
});

it("keeps structured notifications and deduplicates repeated failures", () => {
  const failure = { type: "error", title: "Save failed", message: "Your draft is retained", durationMs: 0 };
  act(() => { notify(failure); notify(failure); notify(""); });
  expect(container.querySelectorAll(".app-toast")).toHaveLength(1);
  expect(container.textContent).toContain("Your draft is retained");
  act(() => vi.advanceTimersByTime(10000));
  expect(container.querySelectorAll(".app-toast")).toHaveLength(1);
});
