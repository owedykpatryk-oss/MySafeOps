/** @vitest-environment jsdom */
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import CDMCompliance from "./CDMCompliance";
import RIDDORWizard from "./RIDDORWizard";
import { ToastProvider } from "../context/ToastContext";
import { getCompliancePackContent } from "../config/compliancePackContent";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../hooks/useD1OrgArraySync", () => ({ useD1OrgArraySync: ({ value, save, storageKey }) => {
  useEffect(() => { save(storageKey, value); }, [value, save, storageKey]); return {};
} }));
vi.mock("../components/PageHero", () => ({ default: ({ right }) => <>{right}</> }));
vi.mock("../components/RegisterModuleShell", () => ({ default: ({ children }) => <>{children}</> }));
let root, host;
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); });
async function click(label) {
  const button = [...host.querySelectorAll("button")].find(el => el.textContent.trim() === label);
  expect(button, label).toBeDefined(); await act(async () => button.click());
}
async function fill(id, value) {
  const input = host.querySelector(`#${id}`);
  const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
const rows = key => JSON.parse(localStorage.getItem(`${key}_default`) || "[]");
async function failThenRetrySave(key, label) {
  const original = Storage.prototype.setItem;
  const block = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (name, value) {
    if (name === `${key}_default`) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, name, value);
  });
  await click(label);
  expect(rows(key)).toEqual([]);
  expect(host.querySelector(".app-module-overlay__panel")).not.toBeNull();
  block.mockRestore();
  await click(label);
}
it("blocks a blank or whitespace CDM title even when jumping directly to Preview", async () => {
  await act(async () => root.render(<ToastProvider><CDMCompliance /></ToastProvider>));
  await click("+ New CDM pack");
  await fill("cdm-compliance-project-title", "  ");
  const tabs = getCompliancePackContent("UK").tabs;
  const project = tabs.find(([key]) => key === "project")[1];
  const preview = tabs.find(([key]) => key === "preview")[1];
  await click(preview);
  const blankSave = [...host.querySelectorAll("button")].find((el) => el.textContent.trim() === "Save CDM pack");
  expect(blankSave?.disabled).toBe(true);
  expect(rows("cdm_packs")).toEqual([]);
  await click(project);
  await fill("cdm-compliance-project-title", "  North depot  ");
  await click(preview);
  await failThenRetrySave("cdm_packs", "Save CDM pack");
  expect(rows("cdm_packs")).toHaveLength(1);
  expect(rows("cdm_packs")[0].projectTitle).toBe("North depot");
});
it("requires the incident details before leaving that step and saves the corrected record", async () => {
  await act(async () => root.render(<ToastProvider><RIDDORWizard /></ToastProvider>));
  await click("+ New RIDDOR report"); await click("Next →"); await click("Next →");
  expect(host.querySelector("#riddor-location")).not.toBeNull();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("required");
  await fill("riddor-location", "  North depot  ");
  await fill("riddor-work-being-done", "  "); await click("Next →");
  expect(host.querySelector("#riddor-work-being-done")).not.toBeNull();
  await fill("riddor-work-being-done", "  Survey  ");
  await fill("riddor-incident-description", "  Fall from ladder  ");
  for (let i = 0; i < 5; i++) await click("Next →");
  await failThenRetrySave("riddor_reports", "Save RIDDOR record");
  expect(rows("riddor_reports")).toHaveLength(1);
  expect(rows("riddor_reports")[0]).toMatchObject({ location: "North depot", workBeingDone: "Survey", incidentDescription: "Fall from ladder" });
});
