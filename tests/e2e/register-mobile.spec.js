import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Run with playwright.mobile.config.js: its server has cloud auth/sync disabled.
test.skip(({ baseURL }) => !baseURL?.endsWith(":4188"), "Requires the isolated mobile test server");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6mAAAAABJRU5ErkJggg==", "base64");

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(({ paidWorkerCap }) => {
    if (!sessionStorage.getItem("flow-test-seeded")) {
      localStorage.clear();
      localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({ onboardingWizardCompleted: true, name: "Mobile test organisation" }));
      localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "p_mobile", name: "Mobile test site", lat: 51.5, lng: -0.1 }]));
      localStorage.setItem("mysafeops_workers_default", JSON.stringify([{ id: "w_mobile", name: "Mobile worker", role: "Operative" }]));
      localStorage.setItem("sig_docs_default", JSON.stringify([{ id: "doc_mobile", title: "Mobile signing test", type: "RAMS", signerIds: ["w_mobile"] }]));
      localStorage.setItem("induction_sites_default", JSON.stringify([{ id: "site_mobile", name: "Mobile induction site", checklist: ["Wear PPE"] }]));
      if (paidWorkerCap) {
        localStorage.setItem("mysafeops_billing_plan", "starter");
        localStorage.setItem("mysafeops_subscription_status", "active");
        localStorage.setItem("mysafeops_workers_default", JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: `cap${i}`, name: `Worker ${i}` }))));
      }
      sessionStorage.setItem("flow-test-seeded", "1");
    }
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_ok, fail) => fail({ code: 1, message: "Permission denied" }) } });
  }, { paidWorkerCap: testInfo.title.startsWith("worker plan cap") });
  await page.route("**/__test-storage/**", (route) => route.fulfill({ status: 503, body: JSON.stringify({ error: "Offline" }), contentType: "application/json" }));
});

async function openView(page, view) {
  await page.goto(`/app?view=${view}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 30000 });
  const dismiss = page.getByRole("button", { name: "Skip setup for now", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
}

test("sync recovery and a newer pending edit survive reload without crossing workspaces", async ({ page }) => {
  await openView(page, "documents");
  const result = await page.evaluate(async () => {
    const outbox = await import("/src/lib/d1SyncOutbox.js");
    const scope = { orgSlug: "recovery-test", namespace: "rams_builder_docs", d1DataKey: "country:pl:main", clientVersion: 2 };
    const first = await outbox.d1OutboxEnqueue({ ...scope, value: [{ id: "r1", title: "Offline RAMS" }] });
    await outbox.d1OutboxEnqueue({ ...scope, value: [{ id: "r1", title: "Latest edit" }] });
    const deleted = await outbox.d1OutboxDelete(scope.orgSlug, scope.namespace, scope.d1DataKey, first);
    await outbox.d1OutboxArchiveConflict(first, { value: [{ id: "r1", title: "Cloud RAMS" }], version: 3 }, { removePending: true });
    return deleted;
  });
  expect(result).toBe(false);
  await page.reload();
  const stored = await page.evaluate(async () => {
    const outbox = await import("/src/lib/d1SyncOutbox.js");
    return {
      pending: await outbox.d1OutboxPeek("recovery-test", "rams_builder_docs", "country:pl:main"),
      recovery: await outbox.d1OutboxRecoveryForWorkspace("recovery-test", "pl"),
      otherOrg: await outbox.d1OutboxRecoveryForWorkspace("other", "pl"),
      primaryCountry: await outbox.d1OutboxRecoveryForWorkspace("recovery-test"),
    };
  });
  expect(stored.pending.value[0].title).toBe("Latest edit");
  expect(stored.recovery).toHaveLength(1);
  expect(stored.recovery[0].value[0].title).toBe("Offline RAMS");
  expect(stored.recovery[0].serverValue[0].title).toBe("Cloud RAMS");
  expect(stored.otherOrg).toEqual([]);
  expect(stored.primaryCountry).toEqual([]);
});

test("owned offline records and their queue survive reload independently for each account", async ({ page }) => {
  await openView(page, "documents");
  await page.evaluate(async () => {
    const storage = await import("/src/data/storage/offlineRecordStore.js");
    const key = { scope: { userId: "user-a", orgSlug: "offline-test", countryKey: "primary" }, namespace: "rams", recordId: "r1" };
    await storage.saveOfflineRecord({ ...key, value: { id: "r1", title: "A first edit" }, expectedRevision: 0 });
    const [old] = await storage.listPendingRecords(key);
    await storage.saveOfflineRecord({ ...key, value: { id: "r1", title: "A latest edit" }, expectedRevision: 1 });
    await storage.acknowledgeOfflineRecord({ ...key, operationId: old.operationId, serverVersion: 1 });
    await storage.saveOfflineRecord({ ...key, scope: { ...key.scope, userId: "user-b" }, value: { id: "r1", title: "B separate edit" }, expectedRevision: 0 });
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const storage = await import("/src/data/storage/offlineRecordStore.js");
    const key = { scope: { userId: "user-a", orgSlug: "offline-test", countryKey: "primary" }, namespace: "rams", recordId: "r1" };
    const other = { ...key, scope: { ...key.scope, userId: "user-b" } };
    const [pendingA] = await storage.listPendingRecords(key);
    const wrongAcknowledgement = await storage.acknowledgeOfflineRecord({ ...other, operationId: pendingA.operationId, serverVersion: 1 });
    return {
      a: await storage.getOfflineRecord(key), b: await storage.getOfflineRecord(other),
      queueA: await storage.listPendingRecords(key), queueB: await storage.listPendingRecords(other),
      otherCountry: await storage.listOfflineRecords({ ...key, scope: { ...key.scope, countryKey: "pl" } }),
      wrongAcknowledgement,
    };
  });
  expect(result.a.value.title).toBe("A latest edit");
  expect(result.b.value.title).toBe("B separate edit");
  expect(result.queueA).toHaveLength(1);
  expect(result.queueB).toHaveLength(1);
  expect(result.queueA[0].localRevision).toBe(2);
  expect(result.otherCountry).toEqual([]);
  expect(result.wrongAcknowledgement).toBe(false);
});

test("atomic offline writes roll back the document when its queue write aborts", async ({ page }) => {
  await openView(page, "documents");
  const errorCode = await page.evaluate(async () => {
    const storage = await import("/src/data/storage/offlineRecordStore.js");
    const key = { scope: { userId: "user-a", orgSlug: "atomic-test", countryKey: "primary" }, namespace: "rams", recordId: "r1" };
    await storage.saveOfflineRecord({ ...key, value: { id: "r1", title: "Committed edit" }, expectedRevision: 0 });
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "pending" && this.transaction.db.name === "mysafeops_record_sync") {
        this.transaction.abort();
        return undefined;
      }
      return original.apply(this, args);
    };
    try {
      await storage.saveOfflineRecord({ ...key, value: { id: "r1", title: "Failed edit" }, expectedRevision: 1 });
      return "unexpected_success";
    } catch (error) { return error.code; }
    finally { IDBObjectStore.prototype.put = original; }
  });
  expect(errorCode).toBe("storage_transaction_aborted");
  await page.reload();
  const result = await page.evaluate(async () => {
    const storage = await import("/src/data/storage/offlineRecordStore.js");
    const key = { scope: { userId: "user-a", orgSlug: "atomic-test", countryKey: "primary" }, namespace: "rams", recordId: "r1" };
    return { record: await storage.getOfflineRecord(key), queue: await storage.listPendingRecords(key) };
  });
  expect(result.record.value.title).toBe("Committed edit");
  expect(result.record.localRevision).toBe(1);
  expect(result.queue).toHaveLength(1);
  expect(result.queue[0].value.title).toBe("Committed edit");
});

async function readSavedRamsDraft(page) {
  return page.evaluate(async () => {
    const drafts = await import("/src/modules/rams/ramsBuilderDraft.js");
    const { ramsDocumentStorageScope } = await import("/src/modules/rams/ramsDocumentSave.js");
    return drafts.latestRamsDraft(drafts.ramsDraftScope({ localOnly: true, storageScope: ramsDocumentStorageScope() }));
  });
}

async function resumeRamsForSaveTest(page, status) {
  await openView(page, "rams");
  const seededAt = await page.evaluate(async (documentStatus) => {
    const drafts = await import("/src/modules/rams/ramsBuilderDraft.js");
    const { ramsDocumentStorageScope } = await import("/src/modules/rams/ramsDocumentSave.js");
    const scope = drafts.ramsDraftScope({ localOnly: true, storageScope: ramsDocumentStorageScope() });
    drafts.writeRamsDraft(scope, "save-test-rams", {
      step: 4, form: { title: "RAMS save safety", documentStatus, documentNo: "RAMS-SAVE-TEST" },
      editedRows: [], selectedHazards: [],
    });
    return drafts.latestRamsDraft(scope).savedAt;
  }, status);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "+ Blank RAMS", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save RAMS", exact: true })).toBeVisible();
  // Wait for autosave so it cannot hide an erroneous removal by writing again after the assertion.
  await expect.poll(async () => (await readSavedRamsDraft(page))?.savedAt || 0)
    .toBeGreaterThan(seededAt);
}

test("RAMS document preview scrolls with the page on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await resumeRamsForSaveTest(page, "draft");
  const preview = page.locator(".app-rams-preview-scroll").first();
  await expect(preview).toBeVisible();
  const layout = await preview.evaluate((node) => ({
    maxHeight: getComputedStyle(node).maxHeight,
    overflowY: getComputedStyle(node).overflowY,
    bodyScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: innerHeight,
  }));
  expect(layout.maxHeight).toBe("none");
  expect(layout.overflowY).toBe("visible");
  expect(layout.bodyScrollHeight).toBeGreaterThan(layout.viewportHeight);
  await page.getByRole("button", { name: "Save RAMS", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Save RAMS", exact: true })).toBeVisible();
});

test("RAMS validation failure preserves the autosaved recovery draft", async ({ page }) => {
  await resumeRamsForSaveTest(page, "issued");
  const alert = page.waitForEvent("dialog");
  const saving = page.getByRole("button", { name: "Save RAMS", exact: true }).click();
  const dialog = await alert;
  expect(dialog.message()).toContain("Cannot save as ISSUED");
  await dialog.accept();
  await saving;
  const stored = await page.evaluate(() => ({
    documents: JSON.parse(localStorage.getItem("rams_builder_docs_default") || "[]"),
  }));
  expect((await readSavedRamsDraft(page)).form.title).toBe("RAMS save safety");
  expect(stored.documents).toEqual([]);
  await expect(page.getByRole("button", { name: "Save RAMS", exact: true })).toBeVisible();
});

test("RAMS storage failure keeps the form and draft until a successful retry", async ({ page }) => {
  await resumeRamsForSaveTest(page, "draft");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreRamsStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "rams_builder_docs_default") throw new DOMException("Test quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const saveButton = page.getByRole("button", { name: "Save RAMS", exact: true });
  await saveButton.click();
  await expect(page.getByText("RAMS not saved", { exact: true })).toBeVisible();
  await expect(saveButton).toBeVisible();
  expect((await readSavedRamsDraft(page))?.form.title)
    .toBe("RAMS save safety");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default") || "[]"))).toEqual([]);
  await page.evaluate(() => window.restoreRamsStorage());
  await saveButton.click();
  await expect(saveButton).toBeHidden();
  const committed = await page.evaluate(() => ({
    documents: JSON.parse(localStorage.getItem("rams_builder_docs_default")),
  }));
  expect(committed.documents).toHaveLength(1);
  expect(committed.documents[0].title).toBe("RAMS save safety");
  expect(await readSavedRamsDraft(page)).toBeNull();
});

for (const changedElsewhere of [false, true]) {
  test(`RAMS recovery resumes the original document and detects external changes (${changedElsewhere})`, async ({ page }) => {
    await openView(page, "documents");
    await page.evaluate(() => localStorage.setItem("rams_builder_docs_default", JSON.stringify([{
      id: "resume-existing", title: "Original RAMS", status: "draft", documentStatus: "draft", rows: [],
    }])));
    await openView(page, "rams");
    await page.locator(".app-rams-doc-row").getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Next — preview & save →", exact: true }).click();
    await expect.poll(async () => (await readSavedRamsDraft(page))?.step).toBe(4);
    expect((await readSavedRamsDraft(page)).editingDocument.id).toBe("resume-existing");
    if (changedElsewhere) {
      await page.evaluate(() => {
        const documents = JSON.parse(localStorage.getItem("rams_builder_docs_default"));
        documents[0].title = "Changed on another device";
        localStorage.setItem("rams_builder_docs_default", JSON.stringify(documents));
      });
    }
    await page.reload();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "+ Blank RAMS", exact: true }).click();
    const saveButton = page.getByRole("button", { name: "Save RAMS", exact: true });
    await saveButton.click();
    if (changedElsewhere) {
      await expect(page.getByText("RAMS not saved", { exact: true })).toBeVisible();
      await expect(saveButton).toBeVisible();
      expect((await readSavedRamsDraft(page)).editingDocument.title).toBe("Original RAMS");
    } else {
      await expect(saveButton).toBeHidden();
      expect(await readSavedRamsDraft(page)).toBeNull();
    }
    const documents = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")));
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe("resume-existing");
    expect(documents[0].title).toBe(changedElsewhere ? "Changed on another device" : "Original RAMS");
  });
}

test("RAMS recovery leaves an unowned legacy draft untouched", async ({ page }) => {
  await openView(page, "rams");
  const legacy = JSON.stringify({ step: 4, form: { title: "Unknown owner's draft" }, savedAt: Date.now() });
  await page.evaluate((raw) => sessionStorage.setItem("mysafeops_rams_builder_draft", raw), legacy);
  await page.getByRole("button", { name: "+ Blank RAMS", exact: true }).click();
  await expect(page.getByText("Older RAMS draft preserved", { exact: true })).toBeVisible();
  await expect.poll(async () => (await readSavedRamsDraft(page))?.step).toBe(1);
  expect((await readSavedRamsDraft(page)).form.title).not.toBe("Unknown owner's draft");
  expect(await page.evaluate(() => sessionStorage.getItem("mysafeops_rams_builder_draft"))).toBe(legacy);
});

test("RAMS recovery lets the user resume an older draft without removing another document's draft", async ({ page }) => {
  await openView(page, "rams");
  await page.evaluate(async () => {
    const drafts = await import("/src/modules/rams/ramsBuilderDraft.js");
    const { ramsDocumentStorageScope } = await import("/src/modules/rams/ramsDocumentSave.js");
    const scope = drafts.ramsDraftScope({ localOnly: true, storageScope: ramsDocumentStorageScope() });
    for (const id of ["older", "newer"]) {
      drafts.writeRamsDraft(scope, id, { step: 4, form: { title: `${id} RAMS`, documentStatus: "draft" }, editedRows: [], selectedHazards: [] });
    }
  });
  await page.reload();
  await page.getByLabel("Unsaved drafts on this tab").selectOption("older");
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await page.getByRole("button", { name: "Save RAMS", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save RAMS", exact: true })).toBeHidden();
  expect((await readSavedRamsDraft(page)).documentId).toBe("newer");
  const documents = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")));
  expect(documents).toHaveLength(1);
  expect(documents[0]).toMatchObject({ id: "older", title: "older RAMS" });
});

test("RAMS recovery reports session quota failure and flushes again on pagehide", async ({ page }) => {
  await resumeRamsForSaveTest(page, "draft");
  const previous = await readSavedRamsDraft(page);
  await page.evaluate(() => {
    window.__draftOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage && key.startsWith("mysafeops_rams_draft_v2:")) throw new DOMException("Full", "QuotaExceededError");
      return window.__draftOriginalSetItem.call(this, key, value);
    };
    window.dispatchEvent(new Event("pagehide"));
  });
  await expect(page.getByRole("alert").filter({ hasText: "Recovery draft could not be saved" })).toBeVisible();
  expect(await readSavedRamsDraft(page)).toEqual(previous);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__draftOriginalSetItem;
    window.dispatchEvent(new Event("pagehide"));
  });
  await expect(page.getByRole("alert").filter({ hasText: "Recovery draft could not be saved" })).toBeHidden();
  expect((await readSavedRamsDraft(page)).savedAt).toBeGreaterThan(previous.savedAt);
});

test("RAMS recovery keeps the draft in its original workspace after an organisation switch", async ({ page }) => {
  await resumeRamsForSaveTest(page, "draft");
  const original = await readSavedRamsDraft(page);
  await page.evaluate(async () => {
    const { setOrgId } = await import("/src/utils/orgStorage.js");
    setOrgId("other-draft-workspace");
  });
  await expect(page.getByRole("button", { name: "Save RAMS", exact: true })).toBeHidden();
  expect(await readSavedRamsDraft(page)).toBeNull();
  const kept = await page.evaluate(async ({ scope, documentId }) => {
    const { readRamsDraft } = await import("/src/modules/rams/ramsBuilderDraft.js");
    return readRamsDraft(scope, documentId);
  }, original);
  expect(kept.form.title).toBe("RAMS save safety");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_other-draft-workspace") || "[]"))).toEqual([]);
});

test("RAMS copy appears immediately as an unsigned draft and keeps the issued original", async ({ page }) => {
  await openView(page, "documents");
  await page.evaluate(() => localStorage.setItem("rams_builder_docs_default", JSON.stringify([{
    id: "source-rams", title: "Issued source", projectId: "old-project", status: "issued", documentStatus: "issued",
    approvedBy: "Original approver", approvalDate: "2026-10-01", signatureEvents: [{ action: "issue_released" }],
    operativeSignatures: { worker: { imageDataUrl: "signature" } }, rows: [],
  }])));
  await openView(page, "rams");
  page.once("dialog", (dialog) => dialog.accept("p_mobile"));
  await page.getByRole("button", { name: "To project", exact: true }).click();
  await expect(page.locator(".app-rams-doc-row")).toHaveCount(2);
  const documents = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")));
  const copy = documents.find((row) => row.id !== "source-rams");
  expect(copy.documentStatus).toBe("draft");
  expect(copy.signatureEvents).toEqual([]);
  expect(copy.operativeSignatures).toEqual({});
  expect(documents.find((row) => row.id === "source-rams").documentStatus).toBe("issued");
});

test("RAMS Duplicate reports storage failure and retries as an unsigned draft", async ({ page }) => {
  await openView(page, "documents");
  await page.evaluate(() => localStorage.setItem("rams_builder_docs_default", JSON.stringify([{
    id: "duplicate-source", title: "Approved original", status: "issued", documentStatus: "issued",
    approvedBy: "Original approver", approvalDate: "2026-10-01", signatureEvents: [{ action: "issue_released" }],
    operativeSignatures: { worker: "signature" }, clientApproval: { by: "Client" }, rows: [],
  }])));
  await openView(page, "rams");
  await page.evaluate(() => {
    window.__originalRamsSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "rams_builder_docs_default") throw new DOMException("Full", "QuotaExceededError");
      return window.__originalRamsSetItem.call(this, key, value);
    };
  });
  const duplicate = page.locator(".app-rams-doc-row").getByRole("button", { name: "Duplicate", exact: true });
  await duplicate.click();
  await expect(page.getByText("RAMS copy not saved", { exact: true })).toBeVisible();
  await expect(page.locator(".app-rams-doc-row")).toHaveCount(1);
  await page.evaluate(() => { Storage.prototype.setItem = window.__originalRamsSetItem; });
  await duplicate.click();
  await expect(page.locator(".app-rams-doc-row")).toHaveCount(2);
  const documents = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")));
  expect(documents.find((doc) => doc.id !== "duplicate-source")).toMatchObject({
    documentStatus: "draft", status: "draft", signatureEvents: [], operativeSignatures: {},
    clientApproval: null, approvedBy: "", title: "Approved original (copy)",
  });
  expect(documents.find((doc) => doc.id === "duplicate-source").documentStatus).toBe("issued");
});

test("RAMS save does not overwrite a document changed while its form was open", async ({ page }) => {
  await openView(page, "documents");
  await page.evaluate(() => localStorage.setItem("rams_builder_docs_default", JSON.stringify([{
    id: "edited-rams", title: "Original RAMS", status: "draft", documentStatus: "draft", rows: [],
  }])));
  await openView(page, "rams");
  await page.locator(".app-rams-doc-row").getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Next — preview & save →", exact: true }).click();
  const saveButton = page.getByRole("button", { name: "Save RAMS", exact: true });
  await expect(saveButton).toBeVisible();
  await page.evaluate(() => {
    const documents = JSON.parse(localStorage.getItem("rams_builder_docs_default"));
    documents[0].title = "Changed outside this form";
    localStorage.setItem("rams_builder_docs_default", JSON.stringify(documents));
  });
  await saveButton.click();
  await expect(page.getByText("RAMS not saved", { exact: true })).toBeVisible();
  await expect(saveButton).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default"))[0].title))
    .toBe("Changed outside this form");
});

async function seedSurveyPropagation(page, lockSecond) {
  await openView(page, "documents");
  await page.evaluate(async (locked) => {
    const { blankSurveyReport } = await import("/src/modules/surveyReport/surveyReportConstants.js");
    const docs = [
      { id: "prop-draft", title: "Unsigned RAMS", projectId: "p_mobile", status: "draft", documentStatus: "draft", rows: [] },
      { id: "prop-second", title: "Second RAMS", projectId: "p_mobile", status: locked ? "issued" : "draft", documentStatus: locked ? "issued" : "draft", rows: [], signatureEvents: locked ? [{ action: "issue_released" }] : [] },
    ];
    localStorage.setItem("rams_builder_docs_default", JSON.stringify(docs));
    localStorage.setItem("survey_reports_default", JSON.stringify(docs.map((doc, index) => blankSurveyReport({
      id: `prop-survey-${index}`, ref: `PROP-${index}`, title: `Survey ${index}`, projectId: "p_mobile",
      linkedRamsId: doc.id, status: "final", surveyType: "gpr_survey", sections: { findings: `Findings ${index}` },
    }))));
  }, lockSecond);
  await openView(page, "survey-report");
}

test("survey propagation protects issued RAMS and explains a partial batch result", async ({ page }) => {
  await seedSurveyPropagation(page, true);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default"))[1]);
  await page.getByRole("button", { name: "Append finals to RAMS", exact: true }).click();
  await expect(page.getByText("Partially appended to RAMS", { exact: true })).toBeVisible();
  await expect(page.getByText(/Create and link an unsigned draft before applying survey changes/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")));
  expect(stored.find((doc) => doc.id === "prop-second")).toEqual(original);
  expect(stored.find((doc) => doc.id === "prop-draft").surveyAppendices).toHaveLength(1);
  // A second action reads current RAMS snapshots and updates the same appendix.
  await page.getByRole("button", { name: "Append finals to RAMS", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default"))[0].surveyAppendices.length)).toBe(1);
});

test("survey propagation reports storage failure and can retry without losing existing RAMS", async ({ page }) => {
  await seedSurveyPropagation(page, false);
  await page.evaluate(() => {
    window.__propagationSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "rams_builder_docs_default") throw new DOMException("Full", "QuotaExceededError");
      return window.__propagationSetItem.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Append finals to RAMS", exact: true }).click();
  await expect(page.getByText("Nothing appended", { exact: true })).toBeVisible();
  await expect(page.getByText(/RAMS changes could not be saved on this device/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")).every((doc) => !doc.surveyAppendices))).toBe(true);
  await page.evaluate(() => { Storage.prototype.setItem = window.__propagationSetItem; });
  await page.getByRole("button", { name: "Append finals to RAMS", exact: true }).click();
  await expect(page.getByText("Appended to RAMS", { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")));
  expect(stored).toHaveLength(2);
  expect(stored.every((doc) => doc.surveyAppendices.length === 1)).toBe(true);
});

test("dashboard surfaces site activity and keeps export controls available", async ({ page }) => {
  await openView(page, "dashboard");
  const today = page.getByRole("heading", { name: "Today at a glance", exact: true });
  await expect(today).toBeVisible({ timeout: 15000 });
  expect((await today.boundingBox()).y).toBeLessThan(page.viewportSize().height - 100);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  mkdirSync("output", { recursive: true });
  await page.screenshot({ path: `output/wow-dashboard-${test.info().project.name}-final.png` });
  await expect(page.locator(".app-dashboard-tools")).not.toHaveAttribute("open", "");
  await page.getByText("Export & customise", { exact: true }).click();
  await expect(page.getByRole("button", { name: "PDF · Email", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("search opens the selected project and person even when the module is already open", async ({ page }) => {
  await openView(page, "projects");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Search workspace", exact: true }).click();
    const search = page.getByRole("dialog", { name: "Search workspace" });
    await search.getByRole("searchbox", { name: "Search workspace" }).fill("Mobile test site");
    await search.getByRole("button", { name: /Project Mobile test site/ }).click();
    await expect(search).toBeHidden();
    await expect(page.locator("#main-content")).toContainText("Mobile test site");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("mysafeops_workspace_nav_target"))).toBeNull();
  }
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search workspace" });
  await search.getByRole("searchbox").fill("Mobile worker");
  await search.getByRole("button", { name: /Person Mobile worker/ }).click();
  await expect(page.getByRole("heading", { name: "Edit worker", exact: true })).toBeVisible();
  await expect(page.locator("#workers-name")).toHaveValue("Mobile worker");
});

test("an invalid module link reports the problem instead of restoring a previous form", async ({ page }) => {
  await openView(page, "people");
  await openView(page, "unknown-module");
  await expect(page.getByRole("alert")).toContainText("This module is unavailable");
  await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
  await page.getByRole("button", { name: "Search modules", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search workspace" });
  await expect(search).toBeVisible();
  await search.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(search).toBeHidden();
});

test("More module actions use independent buttons", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openView(page, "dashboard");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.locator(".app-more-panel")).toBeVisible();
  await expect(page.locator(".app-more-tile-wrap button button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("dashboard ignores deleted records while keeping issued unsigned RAMS flagged", async ({ page }) => {
  await openView(page, "dashboard");
  await page.evaluate(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    localStorage.setItem("mysafeops_workers_default", JSON.stringify([
      { id: "live-worker", name: "Current worker", certifications: [{ expiryDate: today }] },
      { id: "deleted-worker", name: "Deleted worker", deletedAt: "2026-10-05", certifications: [{ expiryDate: "2020-01-01" }] },
    ]));
    localStorage.setItem("rams_builder_docs_default", JSON.stringify([
      { id: "issued-rams", title: "Site excavation", status: "issued", signed: false },
      { id: "deleted-rams", title: "Deleted RAMS", status: "issued", signed: false, deletedAt: "2026-10-05" },
    ]));
    localStorage.setItem("snags_default", JSON.stringify([
      { id: "deleted-snag", status: "open", deletedAt: "2026-10-05" },
      { id: "live-snag", status: "open", dueDate: today },
    ]));
    localStorage.setItem("permits_v2_default", JSON.stringify([{ id: "deleted-permit", status: "active", deletedAt: "2026-10-05" }]));
  });
  await page.reload();
  const today = page.locator(".app-workplace-today");
  await expect(today).toContainText("1 issued RAMS document(s) are not signed", { timeout: 15000 });
  await expect(today.locator(".app-workplace-today__badge")).toContainText("Action needed");
  await expect(today.getByRole("button", { name: /Certs expiring/ })).toContainText("1");
  await expect(today.getByRole("button", { name: /Open snags/ })).toContainText("1");
  await expect(today.getByRole("button", { name: /Active permits/ })).toContainText("0");
  await expect(today).not.toContainText("worker certification(s) have expired");
  await expect(today).not.toContainText("past their due date");
});

test("photo library, camera picker and reload preserve local evidence without GPS", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openView(page, "geo-photos");
  for (const camera of [false, true]) {
    await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
    const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
    await expect(dialog).toBeVisible();
    const picker = dialog.locator(camera ? 'input[type="file"][capture="environment"]' : 'input[type="file"]:not([capture])');
    await picker.setInputFiles({ name: camera ? "camera.png" : "gallery.png", mimeType: "image/png", buffer: PNG });
    await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
    await dialog.getByRole("combobox").first().selectOption("p_mobile");
    await dialog.locator("textarea").first().fill(camera ? "Camera evidence" : "Library evidence");
    await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Photo saved", { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("Camera evidence", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Library evidence", { exact: true }).first()).toBeVisible();
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("geo_photos_default")));
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.photoDataUrl.startsWith("data:image/jpeg") && row.latitude == null && row.longitude == null)).toBe(true);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
  expect(errors).toEqual([]);
});

test("real HEIC photo converts to JPEG and survives save and reload on Apple WebKit", async ({ page }) => {
  test.skip(!process.env.HEIC_FIXTURE_PATH, "Requires a real HEIC generated by the macOS verification job");
  await openView(page, "geo-photos");
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles(process.env.HEIC_FIXTURE_PATH);
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.getByRole("combobox").first().selectOption("p_mobile");
  await dialog.locator("textarea").first().fill("Real HEIC evidence");
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByText("Real HEIC evidence", { exact: true }).first()).toBeVisible();
  const [photo] = await page.evaluate(() => JSON.parse(localStorage.getItem("geo_photos_default")));
  expect(photo.photoDataUrl).toMatch(/^data:image\/jpeg/);
});

test("unreadable HEIC shows recovery advice and a replacement photo can be saved", async ({ page }) => {
  await openView(page, "geo-photos");
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  const picker = dialog.locator('input[type="file"]:not([capture])');
  await picker.setInputFiles({ name: "IMG_100.HEIC", mimeType: "image/heic", buffer: Buffer.from("invalid HEIC") });
  await expect(dialog.getByText(/This iPhone photo \(HEIC\) could not be converted/)).toBeVisible();
  await picker.setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.getByRole("combobox").first().selectOption("p_mobile");
  await dialog.locator("textarea").first().fill("Replacement evidence");
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Photo saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Replacement evidence", { exact: true }).first()).toBeVisible({ timeout: 15000 });
});

test("a late GPS response does not replace the user's decision to continue without GPS", async ({ page }) => {
  await openView(page, "geo-photos");
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (ok) => { window.deliverTestGps = ok; }; });
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "gallery.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.getByRole("combobox").first().selectOption("p_mobile");
  await page.evaluate(() => window.deliverTestGps({ coords: { latitude: 55.5, longitude: -2, accuracy: 3, altitude: 0 } }));
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await expect(dialog).toBeHidden();
  const [photo] = await page.evaluate(() => JSON.parse(localStorage.getItem("geo_photos_default")));
  expect(photo.latitude).toBeNull();
  expect(photo.longitude).toBeNull();
});

test("changing organisation during a photo upload preserves the original draft without saving into the next company", async ({ page }) => {
  await openView(page, "geo-photos");
  await page.evaluate(() => {
    for (const base of ["mysafeops_org_settings", "mysafeops_projects", "mysafeops_workers"]) localStorage.setItem(`${base}_mobile-first`, localStorage.getItem(`${base}_default`));
    localStorage.setItem("mysafeops_orgId", "mobile-first");
    localStorage.setItem("mysafeops_org_settings_mobile-next", localStorage.getItem("mysafeops_org_settings_default"));
  });
  await page.reload();
  let finishUpload;
  const uploadReleased = new Promise((resolve) => { finishUpload = resolve; });
  let started;
  const uploadStarted = new Promise((resolve) => { started = resolve; });
  await page.route("**/__test-storage/upload", async (route) => {
    started();
    await uploadReleased;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, key: "uploads/org_mobile-first/geo-photos/p_mobile/photo.jpg", size: 10 }) });
  });
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "gallery.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.getByRole("combobox").first().selectOption("p_mobile");
  await dialog.locator("textarea").first().fill("First company draft");
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await uploadStarted;
  await page.evaluate(async () => {
    const { setOrgId } = await import("/src/utils/orgId.js");
    setOrgId("mobile-next");
  });
  await expect(dialog).toBeHidden();
  const uploadedResponse = page.waitForResponse("**/__test-storage/upload");
  finishUpload();
  await (await uploadedResponse).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("mysafeops_geo_photo_capture_draft_mobile-first"))).toContain("First company draft");
  const storage = await page.evaluate(() => ({ photos: localStorage.getItem("geo_photos_mobile-next"), draft: sessionStorage.getItem("mysafeops_geo_photo_capture_draft_mobile-next") }));
  expect(storage.photos ? JSON.parse(storage.photos) : []).toEqual([]);
  expect(storage.draft).toBeNull();
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue without GPS", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("mysafeops_geo_photo_capture_draft_mobile-next"))).toBeNull();
});

test("signature saves immediately, updates the list and remains after reload", async ({ page }) => {
  await openView(page, "signatures");
  await page.getByText("Mobile signing test", { exact: true }).click();
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  const canvas = page.locator("canvas");
  await canvas.dispatchEvent("mousedown", { clientX: 20, clientY: 20 });
  await canvas.dispatchEvent("mouseup");
  await page.getByRole("button", { name: "Confirm signature", exact: true }).click();
  await expect(page.getByText("Signed", { exact: true }).first()).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "×", exact: true }).click();
  await expect(page.getByText("1/1 signed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("1/1 signed", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
});

test("Documents reports failed uploads and successful retry persists after reload", async ({ page }) => {
  await openView(page, "documents");
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles({ name: "failed.txt", mimeType: "text/plain", buffer: Buffer.from("test") });
  await expect(page.getByText(/0 file\(s\) uploaded/)).toBeVisible();
  await page.route("**/__test-storage/upload", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "documents/test.txt", size: 4 }) }));
  await picker.setInputFiles({ name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("test") });
  await expect(page.getByText(/1 file\(s\) uploaded/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("test.txt", { exact: true })).toBeVisible();
});

test("Documents rejects an unconfirmed upload and can retry the same file", async ({ page }) => {
  await openView(page, "documents");
  await page.route("**/__test-storage/upload", route => route.fulfill({ status: 200, body: "<html>Network login</html>", contentType: "text/html" }));
  const picker = page.locator('input[type="file"]');
  const file = { name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from("test") };
  await picker.setInputFiles(file);
  await expect(page.getByText(/Could not confirm the upload/)).toBeVisible();
  await expect(page.getByText("Cloud documents (0)", { exact: true })).toBeVisible();
  await page.route("**/__test-storage/upload", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "documents/evidence.txt", size: 4 }) }));
  await picker.setInputFiles(file);
  await expect(page.getByText("Cloud documents (1)", { exact: true })).toBeVisible();
});

test("Documents releases a stalled upload and lets the user retry", async ({ page }) => {
  await openView(page, "documents");
  await page.clock.install();
  let started;
  const requested = new Promise(resolve => { started = resolve; });
  await page.route("**/__test-storage/upload", () => { started(); });
  const picker = page.locator('input[type="file"]');
  const file = { name: "mobile.txt", mimeType: "text/plain", buffer: Buffer.from("test") };
  await picker.setInputFiles(file);
  await requested;
  await page.clock.fastForward(120001);
  await expect(page.getByText(/Upload timed out/)).toBeVisible();
  await expect(page.getByText("Cloud documents (0)", { exact: true })).toBeVisible();
  await page.route("**/__test-storage/upload", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "documents/mobile.txt", size: 4 }) }));
  await picker.setInputFiles(file);
  await expect(page.getByText("Cloud documents (1)", { exact: true })).toBeVisible();
});

test("Documents retries a library write after reload without sending the uploaded file again", async ({ page }) => {
  await openView(page, "documents");
  let uploads = 0;
  await page.route("**/__test-storage/upload", (route) => {
    uploads += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "documents/recovered.txt", size: 4 }) });
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "mysafeops_r2_uploads_default") throw new DOMException("Device storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "recovered.txt", mimeType: "text/plain", buffer: Buffer.from("test") });
  await expect(page.getByRole("button", { name: "Retry saving entries", exact: true })).toBeVisible();
  await expect(page.getByText("Cloud documents (0)", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 file(s) uploaded to cloud storage");
  await page.reload();
  await page.getByRole("button", { name: "Retry saving entries", exact: true }).click();
  await expect(page.getByText("Cloud documents (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("recovered.txt", { exact: true })).toBeVisible();
  expect(uploads).toBe(1);
  await page.getByRole("button", { name: "Open file", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Sign in to download");
  await expect(page.getByRole("button", { name: "Open file", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Documents never adds a pending upload to a different company", async ({ page }) => {
  await openView(page, "documents");
  await page.evaluate(() => {
    localStorage.setItem("mysafeops_org_settings_document-next", localStorage.getItem("mysafeops_org_settings_default"));
  });
  let finishUpload;
  const released = new Promise((resolve) => { finishUpload = resolve; });
  let started;
  const uploadStarted = new Promise((resolve) => { started = resolve; });
  await page.route("**/__test-storage/upload", async (route) => {
    started();
    await released;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "documents/original.txt", size: 4 }) });
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "original.txt", mimeType: "text/plain", buffer: Buffer.from("test") });
  await uploadStarted;
  await page.evaluate(async () => {
    const { setOrgId } = await import("/src/utils/orgId.js");
    setOrgId("document-next");
  });
  const response = page.waitForResponse("**/__test-storage/upload");
  finishUpload();
  await (await response).finished();
  await expect(page.getByText("Cloud documents (0)", { exact: true })).toBeVisible();
  await expect(page.getByText("original.txt", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mysafeops_r2_uploads_document-next") || "[]"))).toEqual([]);
  await expect(page.getByRole("button", { name: "Upload to cloud", exact: true })).toBeEnabled();
});

test("permit list and clear filters render without an initialization crash", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openView(page, "permits");
  await page.getByRole("button", { name: "Skip guide", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Permit/i }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search permits" }).fill("missing permit");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search permits" })).toHaveValue("");
  await expect(page.getByText(/Cannot access|Something went wrong/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("permit checklist header keeps labels readable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await openView(page, "permits");
  const skipGuide = page.getByRole("button", { name: "Skip guide", exact: true });
  await expect(skipGuide).toBeVisible();
  await skipGuide.click();
  await page.getByRole("button", { name: "+ Issue permit", exact: true }).click();
  await page.locator("#permit-description").fill("QA cold work");
  await page.locator("#permit-location").fill("QA site");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const header = page.locator(".permit-checklist-header");
  await expect(header).toBeVisible();
  const layout = await header.evaluate((node) => ({
    wraps: getComputedStyle(node).flexWrap,
    overflow: node.scrollWidth > node.clientWidth + 1,
    compressed: [...node.querySelectorAll(":scope > span")].some((span) => span.scrollWidth > span.clientWidth + 1),
  }));
  expect(layout).toEqual({ wraps: "wrap", overflow: false, compressed: false });
});

test("device storage failure keeps the photo draft open and retry saves it", async ({ page }) => {
  await openView(page, "geo-photos");
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.getByRole("combobox").first().selectOption("p_mobile");
  await dialog.locator("textarea").first().fill("Evidence retained after failed save");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreTestStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key === "geo_photos_default") throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("textarea").first()).toHaveValue("Evidence retained after failed save");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("geo_photos_default") || "[]"))).toHaveLength(0);
  await page.evaluate(() => window.restoreTestStorage());
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByText("Evidence retained after failed save", { exact: true }).first()).toBeVisible({ timeout: 15000 });
});

test("photo draft survives closing the tab and can be explicitly discarded", async ({ page, context }) => {
  await openView(page, "geo-photos");
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "draft.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.locator("textarea").first().fill("Recover across browser tabs");
  await expect.poll(() => page.evaluate(async () => {
    const { readCaptureDraft } = await import("/src/utils/geoPhotoCaptureDraft.js");
    return (await readCaptureDraft("mysafeops_geo_photo_capture_draft_default"))?.notes;
  })).toBe("Recover across browser tabs");
  const replacement = await context.newPage();
  await page.close();
  await openView(replacement, "geo-photos");
  await replacement.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const recovered = replacement.getByRole("dialog", { name: "Add geo-photo" });
  await expect(recovered.locator("textarea").first()).toHaveValue("Recover across browser tabs");
  await recovered.getByRole("button", { name: "Close", exact: true }).click();
  await replacement.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  await expect(recovered.locator("textarea").first()).toHaveValue("Recover across browser tabs");
  await recovered.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(recovered.getByRole("button", { name: "Take photo", exact: true })).toBeVisible();
  await expect.poll(() => replacement.evaluate(async () => {
    const { readCaptureDraft } = await import("/src/utils/geoPhotoCaptureDraft.js");
    return await readCaptureDraft("mysafeops_geo_photo_capture_draft_default");
  })).toBeNull();
  await replacement.close();
});

test("uploaded photo bytes remain available for preview and PDF without storage access", async ({ page }) => {
  await openView(page, "geo-photos");
  const result = await page.evaluate(async () => {
    const { writeGeoPhotoOffline } = await import("/src/utils/geoPhotoOfflineStore.js");
    const { countryOperationalStorageKey } = await import("/src/utils/orgStorage.js");
    const media = await import("/src/utils/geoPhotoMedia.js");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    canvas.getContext("2d").fillRect(0, 0, 2, 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const key = "geo-photos/offline-test.png";
    await writeGeoPhotoOffline(`${countryOperationalStorageKey("mysafeops_geo_photo_media")}:${key}`, { bytes: await blob.arrayBuffer(), type: blob.type });
    const url = await media.resolveGeoPhotoObjectUrl(key);
    const pdf = await media.resolveGeoPhotoPdfDataUrl({ photoStorageKey: key });
    const image = new Image();
    const loaded = new Promise((resolve) => { image.onload = () => resolve(image.naturalWidth); image.onerror = () => resolve(0); });
    image.src = url;
    const width = await loaded;
    URL.revokeObjectURL(url);
    return { width, pdf };
  });
  expect(result.width).toBe(2);
  expect(result.pdf).toMatch(/^data:image\/png;base64,/);
});

for (const durableStorage of [true, false]) {
  test(`successful photo upload preserves offline evidence with IndexedDB ${durableStorage ? "enabled" : "unavailable"}`, async ({ page }) => {
    await openView(page, "geo-photos");
    await page.evaluate(() => {
      for (const base of ["mysafeops_org_settings", "mysafeops_projects", "mysafeops_workers"]) localStorage.setItem(`${base}_mobile-first`, localStorage.getItem(`${base}_default`));
      localStorage.setItem("mysafeops_orgId", "mobile-first");
    });
    await page.reload();
    if (!durableStorage) await page.evaluate(() => Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined }));
    await page.route("**/__test-storage/upload", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: "uploads/org_mobile-first/geo-photos/p_mobile/photo.jpg", size: 10 }) }));
    await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
    const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
    const data = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 2;
      canvas.getContext("2d").fillRect(0, 0, 2, 2);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "cloud.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") });
    await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
    await dialog.getByRole("combobox").first().selectOption("p_mobile");
    await dialog.locator("textarea").first().fill("Cloud photo with offline recovery");
    if (!durableStorage) await expect(dialog.getByRole("alert")).toContainText("Browser restart recovery is unavailable");
    await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
    await expect(dialog).toBeHidden();
    const [photo] = await page.evaluate(() => JSON.parse(localStorage.getItem("geo_photos_mobile-first")));
    expect(photo.photoStorageKey).toContain("org_mobile-first");
    expect(Boolean(photo.photoDataUrl)).toBe(!durableStorage);
    await page.reload();
    await expect(page.getByText("Cloud photo with offline recovery", { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await page.locator(".geo-photos-card img").first().scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator(".geo-photos-card img").first().evaluate((image) => image.naturalWidth).catch(() => 0)).toBeGreaterThan(0);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF", exact: true }).click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
    expect(await page.evaluate(() => sessionStorage.getItem("mysafeops_geo_photo_capture_draft_mobile-first"))).toBeNull();
  });
}

test("shared print popup contains the document and has no opener", async ({ page }) => {
  await openView(page, "documents");
  await page.evaluate(async () => {
    const { openPrintWindowOrWarn, writePrintWindowDocument } = await import("/src/utils/htmlEscape.js");
    const button = document.createElement("button");
    button.textContent = "Test shared print";
    Object.assign(button.style, { position: "fixed", top: "100px", left: "20px", zIndex: "2147483647" });
    button.onclick = () => {
      const win = openPrintWindowOrWarn();
      if (win) void writePrintWindowDocument(win, "<html><head><title>Verified print</title></head><body><h1>Complete safety record</h1><script>window.untrustedRan=true</script></body></html>");
    };
    document.body.prepend(button);
  });
  const popupPromise = page.context().waitForEvent("page");
  await page.getByRole("button", { name: "Test shared print", exact: true }).click({ noWaitAfter: true });
  const popup = await popupPromise;
  await expect(popup.getByRole("heading", { name: "Complete safety record" })).toBeVisible();
  expect(await popup.evaluate(() => window.opener === null && !window.untrustedRan)).toBe(true);
});

test("scanned induction link opens the site form and rejects a different organisation", async ({ page }) => {
  await openView(page, "induction&site=site_mobile&org=default");
  await expect(page.getByRole("heading", { name: "Mobile induction site", exact: true })).toBeVisible();
  await expect(page.getByLabel("Full name *", { exact: true })).toBeVisible();
  await page.goto("/app?view=induction&site=site_mobile&org=other-company");
  await expect(page.getByRole("alert").filter({ hasText: "different organisation" })).toBeVisible();
  await expect(page.getByLabel("Full name *", { exact: true })).toHaveCount(0);
});

test("worker plan cap excludes deleted people and failed saves keep the form open", async ({ page }) => {
  await openView(page, "people");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.getByText(/Solo plan allows up to 5 workers/).first()).toBeVisible();
  await expect(page.locator("#workers-name")).toHaveCount(0);
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("mysafeops_workers_default"));
    rows[4].deletedAt = new Date().toISOString();
    localStorage.setItem("mysafeops_workers_default", JSON.stringify(rows));
  });
  await page.reload();
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await page.locator("#workers-name").fill("Retained worker draft");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreTestStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key === "mysafeops_workers_default") throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#workers-name")).toHaveValue("Retained worker draft");
  await page.evaluate(() => window.restoreTestStorage());
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#workers-name")).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mysafeops_workers_default")).filter((row) => !row.deletedAt).map((row) => row.name))).toContain("Retained worker draft");
});

test("survey and RAMS generate inspectable A4 print fixtures", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium" || test.info().project.name !== "desktop", "PDF rendering uses desktop Chromium");
  await openView(page, "documents");
  const htmls = await page.evaluate(async () => {
    const { buildSurveyReportHtml } = await import("/src/modules/surveyReport/surveyReportPrintHtml.js");
    const { blankSurveyReport } = await import("/src/modules/surveyReport/surveyReportConstants.js");
    const { generatePrintHTML } = await import("/src/modules/rams/ramsPrintHtml.js");
    const report = blankSurveyReport({ title: "Verified survey report", ref: "SUR-PRINT-001", client: "Network Rail", projectName: "Print verification site", sections: { scope: "Survey of Network Rail infrastructure. Complete evidence recorded.", methodology: "Full survey methodology with site controls and approvals." } });
    return { survey: buildSurveyReportHtml(report, { name: "Print test organisation" }), rams: generatePrintHTML({ title: "Verified RAMS", documentNo: "RAMS-PRINT-001", location: "Print verification site", issueDate: "2026-10-05", revision: "1A", description: "Complete site controls and method." }, [], [], {}, {}, "print-test", []) };
  });
  mkdirSync("tmp/pdfs", { recursive: true });
  for (const [name, html] of Object.entries(htmls)) {
    const printPage = await page.context().newPage();
    await printPage.setContent(html);
    await printPage.emulateMedia({ media: "print" });
    await printPage.pdf({ path: `tmp/pdfs/${name}-followup.pdf`, printBackground: true, preferCSSPageSize: true });
    await printPage.close();
  }
});
