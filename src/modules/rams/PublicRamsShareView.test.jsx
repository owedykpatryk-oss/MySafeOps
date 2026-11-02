/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("../../lib/supabase", () => ({ supabase: {} }));
vi.mock("../../utils/orgStorage", () => ({ loadOrgScoped: () => [] }));
vi.mock("../../utils/ramsCloudShare", () => ({
  fetchPublishedRams: vi.fn(async () => ({ id: "shared-1", title: "Cloud RAMS", rows: [{ id: "hazard-1" }] })),
}));
vi.mock("./ramsPrintHtml", () => ({ openRamsPrintWindow: vi.fn() }));

import PublicRamsShareView from "./PublicRamsShareView";
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
  act(() => root.unmount());
  container.remove();
});
