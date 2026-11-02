/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi, beforeEach } from "vitest";
import DroneEvidence from "./DroneEvidence.jsx";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => sessionStorage.clear());
it("keeps entered evidence after storage failure and clears it only after a successful retry", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  document.body.append(host);
  const save = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce({ id: "saved" });
  try {
    await act(async () =>
      root.render(
        <DroneEvidence
          mission={{ id: "qa", revision: 1 }}
          actor={{ name: "QA" }}
          documents={[]}
          canEdit
          onSave={save}
        />
      )
    );
    const field = (label) =>
      [...host.querySelectorAll("label")]
        .find((node) => node.textContent.includes(label))
        .querySelector("input,textarea");
    const change = async (label, value) =>
      act(async () => {
        const input = field(label),
          proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await change("Source / briefing", "QA source");
    await change("Findings, coverage", "QA unresolved restriction");
    await change("Checked at", "2026-01-01T10:00");
    await change("Valid until", "2026-01-01T11:00");
    const button = [...host.querySelectorAll("button")].find((node) => node.textContent === "Save check evidence");
    await act(async () => button.click());
    expect(save).toHaveBeenCalledTimes(1);
    expect(field("Findings, coverage").value).toBe("QA unresolved restriction");
    expect(host.querySelector('[role="alert"]').textContent).toContain("not saved");
    await act(async () => button.click());
    expect(save).toHaveBeenCalledTimes(2);
    expect(field("Findings, coverage").value).toBe("");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
