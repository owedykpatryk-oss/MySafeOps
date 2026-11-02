import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("./orgStorage", () => ({ loadOrgScoped: mocks.load, saveOrgScoped: mocks.save }));
import { duplicateRamsToProject, batchDuplicateRamsToProject } from "./ramsDocumentClone";
import { setAuthorshipUserCache, clearAuthorshipUserCache } from "./documentAuthorship";
const projects = [{ id: "p2", name: "New site", address: "New address" }];
const source = {
  id: "issued-rams", projectId: "p1", projectName: "Old site", title: "Site RAMS",
  status: "issued", documentStatus: "issued", revision: "4C", revisionSummary: "Approved revision",
  approvedBy: "Old approver", approvalDate: "2026-09-01", issueDate: "2026-09-02",
  createdBy: "Old author", createdById: "old-user", createdByEmail: "old@example.test",
  operativeIds: ["old-worker"], operativeSignatures: { "old-worker": { imageDataUrl: "old-signature" } },
  signatureEvents: [{ action: "issue_released" }], versionHistory: [{ snapshot: { title: "Old signed revision" } }],
  clientApproval: { by: "Client", at: "2026-09-01" }, signed: true,
  competentReviewAck: true, competentReviewAcknowledgedBy: "Reviewer", competentReviewAcknowledgedAt: "2026-09-01",
  rows: [{ id: "h1", controlMeasures: ["Control"] }], printSections: { emergency: true },
  shareToken: "source-share", contentHash: "source-hash",
};
beforeEach(() => {
  mocks.load.mockReset().mockReturnValue([source]);
  mocks.save.mockReset().mockReturnValue(true);
  clearAuthorshipUserCache();
});
afterEach(() => clearAuthorshipUserCache());
describe("RAMS project copying", () => {
  it("copies issued content as a draft without carrying its approvals or signatures", () => {
    const copy = duplicateRamsToProject(source, "p2", projects);
    expect(copy).toMatchObject({ status: "draft", documentStatus: "draft", revision: "1A", projectName: "New site" });
    expect(copy.approvedBy).toBeFalsy();
    expect(copy.approvalDate).toBeFalsy();
    expect(copy.issueDate).toBeFalsy();
    expect(copy.signed).toBe(false);
    expect(copy.competentReviewAck).toBe(false);
    expect(copy.competentReviewAcknowledgedAt).toBeFalsy();
    expect(copy.clientApproval).toBeFalsy();
    expect(copy.signatureEvents).toEqual([]);
    expect(copy.operativeSignatures).toEqual({});
    expect(copy.versionHistory).toEqual([]);
    expect(copy.shareToken).toBeUndefined();
    expect(copy.clonedFromRamsId).toBe(source.id);
    expect(source.documentStatus).toBe("issued");
    expect(source.signatureEvents).toHaveLength(1);
  });
  it("attributes the new document to its current creator", () => {
    setAuthorshipUserCache({ id: "new-user", email: "new@example.test" });
    const copy = duplicateRamsToProject(source, "p2", projects);
    expect(copy.createdById).toBe("new-user");
    expect(copy.updatedById).toBe("new-user");
  });
  it("does not reuse the source author when the new document has no signed-in author", () => {
    expect(duplicateRamsToProject(source, "p2", projects).createdById).toBeFalsy();
  });
  it("detaches nested template settings as well as hazard rows", () => {
    const copy = duplicateRamsToProject(source, "p2", projects);
    copy.printSections.emergency = false;
    copy.rows[0].controlMeasures.push("New control");
    expect(source.printSections.emergency).toBe(true);
    expect(source.rows[0].controlMeasures).toEqual(["Control"]);
  });
  it.each(["single", "batch"])("does not report a successful %s copy when storage refuses the write", (mode) => {
    mocks.save.mockReturnValue(false);
    const copy = () => mode === "single"
      ? duplicateRamsToProject(source, "p2", projects)
      : batchDuplicateRamsToProject([source], "p2", projects);
    expect(copy).toThrow(/could not be saved/i);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("uses the same draft reset for every item in a batch", () => {
    const copies = batchDuplicateRamsToProject([source, { ...source, id: "r2" }], "p2", projects);
    expect(new Set(copies.map((row) => row.id)).size).toBe(2);
    expect(copies.every((row) => row.documentStatus === "draft" && !row.signatureEvents.length)).toBe(true);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
