/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentTemplates, { templatePayloadFromDocument } from "./DocumentTemplates";
import { ToastProvider } from "../context/ToastContext";
import { setOrgId } from "../utils/orgStorage";

vi.mock("../components/PageHero", () => ({ default: () => null }));
vi.mock("../i18n/useWorkspaceT", () => ({ useWorkspaceT: () => ({ t: (key) => key }) }));
vi.mock("../utils/auditLog", () => ({ pushAudit: vi.fn() }));

describe("DocumentTemplates workspace storage", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("alert", vi.fn());
    localStorage.clear();
    setOrgId("company-a");
    localStorage.setItem("document_templates_company-a", JSON.stringify([
      { id: "a", name: "Company A template", type: "rams", payload: {}, createdAt: "2026-10-01" },
    ]));
    localStorage.setItem("document_templates_company-b", JSON.stringify([
      { id: "b", name: "Company B template", type: "rams", payload: {}, createdAt: "2026-10-01" },
    ]));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads the active company without writing on mount or copying the previous company's list", async () => {
    const setItem = Storage.prototype.setItem;
    const templateWrites = [];
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).startsWith("document_templates_")) templateWrites.push(key);
      return setItem.call(this, key, value);
    });

    await act(async () => root.render(<ToastProvider><DocumentTemplates /></ToastProvider>));
    expect(container.textContent).toContain("Company A template");
    expect(templateWrites).toEqual([]);

    await act(async () => setOrgId("company-b"));
    expect(container.textContent).toContain("Company B template");
    expect(container.textContent).not.toContain("Company A template");
    expect(templateWrites).toEqual([]);
    expect(JSON.parse(localStorage.getItem("document_templates_company-b"))[0].name).toBe("Company B template");
  });

  it("creates an unsigned method statement draft from an approved template", async () => {
    localStorage.setItem("document_templates_company-a", JSON.stringify([{
      id: "approved-ms", name: "Approved MS", type: "ms", createdAt: "2026-10-01",
      payload: {
        title: "Method statement", status: "approved", revision: "4B", approvedBy: "Old approver",
        permitControllerSignDate: "2026-09-01", operativeSignatures: { worker: { imageDataUrl: "old-signature" } },
      },
    }]));
    await act(async () => root.render(<ToastProvider><DocumentTemplates /></ToastProvider>));
    const cloneButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Clone to new draft");
    await act(async () => cloneButton.click());
    const copy = JSON.parse(localStorage.getItem("method_statements_company-a"))[0];
    expect(copy).toMatchObject({ status: "draft", revision: "1A", approvedBy: "", permitControllerSignDate: "", operativeSignatures: {} });
  });

  it("stores RAMS template content without approval evidence or source document links", () => {
    const payload = templatePayloadFromDocument({
      id: "issued", title: "Issued RAMS", projectId: "p1", rows: [], documentNo: "RAMS-001",
      status: "issued", documentStatus: "issued", signed: true, shareToken: "old-token",
      signatureEvents: [{ action: "issue_released" }], clientApproval: { by: "Client" },
      linkedSurveyIds: ["old-survey"], surveyAppendices: [{ surveyId: "old-survey" }],
    }, "rams");
    expect(payload).toMatchObject({
      title: "Issued RAMS", status: "draft", documentStatus: "draft", signed: false,
      signatureEvents: [], clientApproval: null, linkedSurveyIds: [], surveyAppendices: [], documentNo: "",
    });
    expect(payload.shareToken).toBeUndefined();
    expect(payload.clonedFromRamsId).toBeUndefined();
  });
});
