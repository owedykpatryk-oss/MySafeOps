/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import People from "./People";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../context/AppContext", () => ({ useApp: () => ({ isPlatformOwner: true }) }));
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ user: null }) }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock("../hooks/useD1WorkersProjectsSync", () => ({ useD1WorkersProjectsSync: () => ({}) }));
let root, host;
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); });
async function click(label) {
  const button = [...host.querySelectorAll("button")].find(el => el.textContent.trim() === label);
  expect(button, label).toBeDefined();
  await act(async () => button.click());
}
async function fill(value) {
  await act(async () => {
    const input = host.querySelector("#workers-name");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const records = () => JSON.parse(localStorage.getItem("mysafeops_workers_default") || "[]");
it.each(["", "  \t "])("blocks an empty worker name %j and saves once after correction", async name => {
  await act(async () => root.render(<MemoryRouter><People /></MemoryRouter>));
  await click("Add person");
  await fill(name);
  await click("Save");
  expect(records()).toEqual([]);
  expect(document.activeElement.id).toBe("workers-name");
  expect(host.querySelector("#workers-name").getAttribute("aria-invalid")).toBe("true");
  await fill("  Alex Surveyor  ");
  await click("Save");
  expect(records()).toHaveLength(1);
  expect(records()[0].name).toBe("Alex Surveyor");
});

it("preserves the original person when an edit clears their name", async () => {
  const original = { id: "worker-1", name: "Alex Surveyor", role: "Surveyor" };
  localStorage.setItem("mysafeops_workers_default", JSON.stringify([original]));
  await act(async () => root.render(<MemoryRouter><People /></MemoryRouter>));
  await click("Edit"); await fill("  "); await click("Save");
  expect(records()).toEqual([original]);
  await fill("  Alex Jones  "); await click("Save");
  expect(records()).toHaveLength(1);
  expect(records()[0]).toMatchObject({ id: "worker-1", name: "Alex Jones", role: "Surveyor" });
});
