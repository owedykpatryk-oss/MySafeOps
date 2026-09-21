/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import GeoPhotoAreaPanel from "./GeoPhotoAreaPanel.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Leaflet needs a real viewport to measure; the panel's job is what it does with the corners
// the map reports, so the map itself is stood in for by a button that drops one.
vi.mock("./GeoPhotoAreaMap", () => ({
  default: ({ points, onChange }) => (
    <button type="button" data-testid="drop-corner" onClick={() => onChange([...points, [51.5 + points.length * 0.0009, -0.1]])}>
      map
    </button>
  ),
}));

const SQUARE = [
  [51.5, -0.1],
  [51.5009, -0.1],
  [51.5009, -0.09855],
  [51.5, -0.09855],
];

function render(ui) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(ui));
  return { host, rerender: (next) => act(() => root.render(next)) };
}

const button = (host, text) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));

describe("GeoPhotoAreaPanel", () => {
  it("stays out of the way until asked, and leads with why this type would want an extent", () => {
    const { host } = render(<GeoPhotoAreaPanel type="vegetation" value={null} onChange={() => {}} />);

    expect(host.textContent).toContain("clearance");
    expect(host.querySelector('[data-testid="drop-corner"]')).toBeNull();

    act(() => button(host, "✏️").click());
    expect(host.querySelector('[data-testid="drop-corner"]')).not.toBeNull();
  });

  it("reports each corner back with the size it encloses", () => {
    const onChange = vi.fn();
    const { host } = render(<GeoPhotoAreaPanel type="vegetation" value={{ points: SQUARE }} onChange={onChange} />);

    expect(host.textContent).toContain("4 corners");
    expect(host.textContent).toContain("1.00 ha");
    expect(host.textContent).toContain("perimeter");

    act(() => host.querySelector('[data-testid="drop-corner"]').click());
    const [area] = onChange.mock.calls.at(-1);
    expect(area.points).toHaveLength(5);
    expect(area.sqm).toBeGreaterThan(0);
  });

  it("says how far off a closed shape it still is", () => {
    const { host } = render(
      <GeoPhotoAreaPanel type="obstruction" value={{ points: SQUARE.slice(0, 2) }} onChange={() => {}} />
    );

    expect(host.textContent).toContain("2 of 3 corners");
    expect(host.textContent).not.toContain("perimeter");
  });

  it("undoes the last corner and clears the lot", () => {
    const onChange = vi.fn();
    const { host } = render(<GeoPhotoAreaPanel type="vegetation" value={{ points: SQUARE }} onChange={onChange} />);

    act(() => button(host, "Undo corner").click());
    expect(onChange.mock.calls.at(-1)[0].points).toHaveLength(3);

    act(() => button(host, "Clear").click());
    expect(onChange.mock.calls.at(-1)[0]).toBeNull();
  });

  it("warns when the shape was traced away from where the photo was taken", () => {
    const { host } = render(
      <GeoPhotoAreaPanel
        type="vegetation"
        latitude={51.52}
        longitude={-0.12}
        value={{ points: SQUARE }}
        onChange={() => {}}
      />
    );

    expect(host.textContent).toMatch(/sits about \d+ m from where the photo was taken/);
  });

  it("says nothing about distance when the shape sits on the photo", () => {
    const { host } = render(
      <GeoPhotoAreaPanel
        type="vegetation"
        latitude={51.5}
        longitude={-0.1}
        value={{ points: SQUARE }}
        onChange={() => {}}
      />
    );

    expect(host.textContent).not.toContain("from where the photo was taken");
  });

  it("follows the row being edited when the panel is handed another photo", () => {
    const { host, rerender } = render(
      <GeoPhotoAreaPanel type="vegetation" value={{ points: SQUARE }} onChange={() => {}} />
    );
    expect(host.textContent).toContain("4 corners");

    rerender(<GeoPhotoAreaPanel type="vegetation" value={{ points: SQUARE.slice(0, 3) }} onChange={() => {}} />);
    expect(host.textContent).toContain("3 corners");
  });
});
