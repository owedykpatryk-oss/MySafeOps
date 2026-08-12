/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import GeoPhotoTypeFieldInputs from "./GeoPhotoTypeFieldInputs.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(ui) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(ui));
  return host;
}

describe("GeoPhotoTypeFieldInputs", () => {
  it("renders the prompt, the selects and the tickboxes for the type", () => {
    const host = render(<GeoPhotoTypeFieldInputs type="manhole_chamber" value={{}} onChange={() => {}} />);

    expect(host.textContent).toContain("cover");
    expect(host.textContent).toContain("Cover condition");
    expect(host.textContent).toContain("Cover lifted");
    expect(host.querySelectorAll("select").length).toBeGreaterThan(1);
    expect(host.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(1);
    expect(host.querySelector('input[type="number"]')).not.toBeNull();
  });

  it("shows a different set of questions for another type", () => {
    const host = render(<GeoPhotoTypeFieldInputs type="hazard" value={{}} onChange={() => {}} />);

    expect(host.textContent).toContain("Category");
    expect(host.textContent).toContain("Severity");
    expect(host.textContent).not.toContain("Cover condition");
  });

  it("reports a ticked box back to the caller without dropping other answers", () => {
    const onChange = vi.fn();
    const host = render(
      <GeoPhotoTypeFieldInputs type="hazard" value={{ severity: "High" }} onChange={onChange} />
    );

    const tickbox = [...host.querySelectorAll('input[type="checkbox"]')].find(
      (input) => input.closest("label")?.textContent.trim() === "Work stopped"
    );
    act(() => {
      tickbox.click();
    });

    expect(onChange).toHaveBeenCalledWith({ severity: "High", workStopped: true });
  });

  it("shows the answers it was given", () => {
    const host = render(
      <GeoPhotoTypeFieldInputs
        type="manhole_chamber"
        value={{ coverCondition: "Cracked", depthToInvertM: 1.8, coverLifted: true }}
        onChange={() => {}}
      />
    );

    const condition = [...host.querySelectorAll("select")].find((select) => select.value === "Cracked");
    expect(condition).toBeDefined();
    expect([...host.querySelectorAll('input[type="number"]')].some((i) => i.value === "1.8")).toBe(true);
    expect([...host.querySelectorAll('input[type="checkbox"]')].some((i) => i.checked)).toBe(true);
  });
});
