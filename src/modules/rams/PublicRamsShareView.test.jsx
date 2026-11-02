/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("../../lib/supabase", () => ({ supabase: {} }));
vi.mock("../../utils/orgStorage", () => ({ loadOrgScoped: () => [] }));
vi.mock("../../utils/ramsCloudShare", () => ({
  fetchPublishedRams: vi.fn(async () => ({ id: "shared-1", title: "Cloud RAMS", rows: [{ id: "hazard-1" }], publicationSnapshot: { version: 1, workers: [{ id: "w1", name: "Sender" }], projects: [{ id: "p1", name: "Site" }] } })),
}));
vi.mock("./ramsPrintHtml", () => ({ openRamsPrintWindow: vi.fn() }));

import PublicRamsShareView from "./PublicRamsShareView";
import { openRamsPrintWindow } from "./ramsPrintHtml";
import { fetchPublishedRams } from "../../utils/ramsCloudShare";

it("opens a published RAMS in a browser with no local document data", async () => {
  const token = `r_${"a".repeat(32)}`;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<PublicRamsShareView token={token} />));
  await vi.waitFor(() => expect(container.querySelector("h1")?.textContent).toBe("Cloud RAMS"));
  expect(fetchPublishedRams).toHaveBeenCalledWith({}, token);
  expect(container.querySelector("button")?.textContent).toBe("Print / PDF");
  act(() => container.querySelector("button").click());
  expect(openRamsPrintWindow).toHaveBeenCalledWith(
    expect.objectContaining({ id: "shared-1" }), [{ id: "hazard-1" }],
    [{ id: "w1", name: "Sender" }], [{ id: "p1", name: "Site" }],
  );
  act(() => root.unmount());
  container.remove();
});
