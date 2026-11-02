/** @vitest-environment jsdom */
import { beforeEach, expect, it } from "vitest";
import { createRamsPublicationSnapshot } from "../../utils/ramsCloudShare";
import { saveOrgSettingsRaw } from "../../utils/orgSettingsStorage";
import { buildRamsPreviewHtml } from "./ramsPrintHtml";
const doc = { id: "one", title: "Shared work", projectId: "p1", operativeIds: ["w1"], rows: [], issueDate: "2026-11-02" };
beforeEach(() => { localStorage.clear(); localStorage.setItem("mysafeops_orgId", "sender"); });
it("renders the same sender details in a fresh browser and another organisation", () => {
  saveOrgSettingsRaw({ name: "Sender Ltd", marketId: "uk", primaryColor: "#123456" });
  const snapshot = createRamsPublicationSnapshot(doc,
    [{ id: "w1", name: "Sender Worker", role: "Installer", email: "private@example.com", certifications: [{ certType: "Training", expiryDate: "2028-12-01", privateNote: "secret" }] }, { id: "w2", name: "Unrelated Worker" }],
    [{ id: "p1", name: "Sender Project", secret: "omit" }, { id: "p2", name: "Other Project" }]);
  const published = { ...doc, publicationSnapshot: snapshot };
  const render = () => buildRamsPreviewHtml(published, [], snapshot.workers, snapshot.projects);
  const senderHtml = render();
  localStorage.clear();
  expect(render()).toBe(senderHtml);
  localStorage.setItem("mysafeops_orgId", "recipient");
  saveOrgSettingsRaw({ name: "Recipient Ltd", marketId: "pl", primaryColor: "#ffffff" });
  expect(render()).toBe(senderHtml);
  expect(senderHtml).toContain("Sender Ltd");
  expect(senderHtml).toContain("Sender Worker");
  expect(senderHtml).toContain("Sender Project");
  expect(JSON.stringify(snapshot)).not.toMatch(/Unrelated Worker|Other Project|private@example|privateNote|secret/);
});

it.each(["fess-group", "utility-mapping"])("keeps %s sender layout independent from recipient settings", (orgId) => {
  localStorage.setItem("mysafeops_orgId", orgId);
  saveOrgSettingsRaw({ name: "Sender branded company" });
  const snapshot = createRamsPublicationSnapshot(doc, [{ id: "w1", name: "Sender Worker" }], [{ id: "p1", name: "Sender Project" }]);
  const published = { ...doc, publicationSnapshot: snapshot };
  const expected = buildRamsPreviewHtml(published, [], snapshot.workers, snapshot.projects);
  localStorage.setItem("mysafeops_orgId", "unrelated");
  saveOrgSettingsRaw({ name: "Other Company", marketId: "pl" });
  expect(buildRamsPreviewHtml(published, [], snapshot.workers, snapshot.projects)).toBe(expected);
  expect(expected).toContain("Sender branded company");
});
