/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import PlFormsRegister from "./PlFormsRegister";
import PlInstructionsRegister from "./PlInstructionsRegister";
import PlHarmfulFactorsRegister from "./PlHarmfulFactorsRegister";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../context/AppContext", () => ({ useApp: () => ({ caps: { canDelete: true } }) }));
vi.mock("../components/PageHero", () => ({ default: () => null }));
vi.mock("../components/RegisterModuleShell", () => ({ default: ({ children }) => <>{children}</> }));
let root, host;
beforeEach(() => { localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); });
const cases = [
  [PlFormsRegister, "pl_forms_records", { id: "r1", formKey: "unknown", formLabel: "Test form", data: {} }],
  [PlInstructionsRegister, "pl_instrukcje", { id: "r1", tytul: "Test instruction", zapoznani: [] }],
  [PlHarmfulFactorsRegister, "pl_czynniki_szkodliwe", { id: "r1", nazwa: "Test factor", pomiary: [] }],
];
it.each(cases)("%s asks once, preserves cancelled records and archives confirmed deletions", async (Module, key, row) => {
  localStorage.setItem(`${key}_default`, JSON.stringify([row]));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await act(async () => root.render(<Module />));
  const remove = () => [...host.querySelectorAll("button")].find(b => b.textContent.trim() === "Usuń");
  expect(remove()).toBeDefined();
  await act(async () => remove().click());
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(`${key}_default`))).toEqual([row]);
  confirm.mockReturnValue(true);
  await act(async () => remove().click());
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem(`${key}_default`))[0].deletedAt).toBeTruthy();
  const copies = JSON.parse(localStorage.getItem("mysafeops_recycle_bin_v1_default"));
  expect(copies).toHaveLength(1);
  expect(copies[0]).toMatchObject({ sourceKey: key, payload: row });
});
