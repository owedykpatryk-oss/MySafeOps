/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { D1ModuleSyncBanner } from "./D1ModuleSyncBanner.jsx";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("explains a billing pause and opens Billing instead of offering an offline retry", async () => {
  localStorage.clear();
  localStorage.setItem("mysafeops_orgId", "qa-org");
  localStorage.setItem("mysafeops_trial_ends_at_qa-org", "2020-01-01");
  const host = document.createElement("div"),
    root = createRoot(host),
    open = vi.fn();
  document.body.append(host);
  window.addEventListener("mysafeops:open-settings", open);
  try {
    await act(async () => root.render(<D1ModuleSyncBanner d1OutboxPending />));
    expect(host.textContent).toContain("Cloud upload paused");
    expect(host.textContent).not.toContain("when you're online");
    const button = host.querySelector("button");
    expect(button.textContent).toBe("Open Billing");
    button.click();
    expect(open.mock.calls[0][0].detail).toEqual({ tab: "billing" });
  } finally {
    await act(async () => root.unmount());
    host.remove();
    window.removeEventListener("mysafeops:open-settings", open);
    localStorage.clear();
  }
});
