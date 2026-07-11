/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  classifyAndHeal,
  clearOpsLog,
  logOpsEvent,
  readOpsLog,
  initClientOpsMonitor,
} from "./clientOpsMonitor.js";

describe("clientOpsMonitor", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies chunk load failures with reload heal", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { reload }, writable: true });
    const plan = classifyAndHeal("Loading chunk 42 failed");
    expect(plan.healAction).toBe("reload_once");
    expect(plan.userMessage).toMatch(/reload/i);
    expect(reload).toHaveBeenCalled();
  });

  it("blocks repeat chunk reload in same session", () => {
    sessionStorage.setItem("mysafeops_chunk_reload", "1");
    const plan = classifyAndHeal("Loading chunk 42 failed");
    expect(plan.healAction).toBe("reload_blocked");
  });

  it("classifies CSP connect blocks", () => {
    const plan = classifyAndHeal(
      "Connecting to 'https://overpass-api.de/api/interpreter' violates the following Content Security Policy directive: connect-src"
    );
    expect(plan.healAction).toBe("csp_connect");
  });

  it("downgrades third-party script parse noise", () => {
    const plan = classifyAndHeal(
      "Failed to execute 'appendChild' on 'Node': Missing catch or finally after try"
    );
    expect(plan.level).toBe("warn");
    expect(plan.healAction).toBe("third_party_script");
    expect(plan.userMessage).toBeUndefined();
  });

  it("stores ops log entries locally", () => {
    logOpsEvent({ level: "warn", source: "test", message: "hello" });
    expect(readOpsLog()).toHaveLength(1);
    expect(readOpsLog()[0].message).toBe("hello");
    clearOpsLog();
    expect(readOpsLog()).toHaveLength(0);
  });

  it("init registers global handlers once", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    initClientOpsMonitor();
    initClientOpsMonitor();
    expect(addSpy.mock.calls.filter((c) => c[0] === "error")).toHaveLength(1);
  });
});
