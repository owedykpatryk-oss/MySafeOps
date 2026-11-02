/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { LandingLocations } from "./FieldWorkspace.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("renders malformed stored points for review and does not offer to copy them", async () => {
  const host = document.createElement("div"),
    root = createRoot(host),
    onPatch = vi.fn();
  document.body.append(host);
  try {
    for (const takeoff of [{ lat: 51, lng: 0 }, "0,51", [0], [200, 51], [0, NaN]]) {
      await act(async () => root.render(<LandingLocations mission={{ takeoff }} onPatch={onPatch} />));
      expect(host.textContent).toContain("Invalid point — choose it again on the map");
      const copy = [...host.querySelectorAll("button")].find((b) => b.textContent === "Use take-off point");
      expect(copy.disabled).toBe(true);
    }
    await act(async () => root.render(<LandingLocations mission={{ takeoff: [-0.1, 51.5] }} onPatch={onPatch} />));
    await act(async () =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === "Use take-off point").click()
    );
    expect(onPatch).toHaveBeenCalledWith({ landing: [-0.1, 51.5] });
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
