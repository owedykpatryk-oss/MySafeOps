/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import WorkplaceTodayCard from "./WorkplaceTodayCard";
import { openWorkspaceView } from "../utils/workspaceNavContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../utils/workspaceNavContext", () => ({ openWorkspaceView: vi.fn(), openWorkspaceSettings: vi.fn() }));
let root;
afterEach(() => { act(() => root?.unmount()); vi.useRealTimers(); });

it("opens People when reviewing certificates and refreshes the date after midnight", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 5, 12));
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => root.render(<WorkplaceTodayCard expiringCerts={2} />));
  expect(container.textContent).toMatch(/Monday,? 5 October/);
  act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Certs expiring")).click());
  expect(openWorkspaceView).toHaveBeenCalledWith({ viewId: "people" });
  vi.setSystemTime(new Date(2026, 9, 6, 12));
  act(() => root.render(<WorkplaceTodayCard expiringCerts={2} />));
  expect(container.textContent).toMatch(/Tuesday,? 6 October/);
});

it("keeps setup suggestions distinct from urgent work and opens their destination", () => {
  const onOpen = vi.fn();
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => root.render(<WorkplaceTodayCard hasSiteRecords={false} urgentItems={[{ key: "setup", text: "Explore registers", severity: "info", onOpen }]} />));
  expect(container.textContent).toContain("Getting started");
  expect(container.textContent).not.toContain("Action needed");
  act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Explore registers").click());
  expect(onOpen).toHaveBeenCalledOnce();
});
