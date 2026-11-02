import { test, expect } from "@playwright/test";
test.skip(({ baseURL }) => !baseURL?.endsWith(":4188"), "Requires isolated operational server");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("rams-audit-seeded")) return;
    localStorage.clear();
    localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({ name: "Audit", onboardingWizardCompleted: true }));
    localStorage.setItem("rams_builder_docs_default", JSON.stringify([{ id: "r1", title: "Saved RAMS", rows: [], documentStatus: "draft" }]));
    sessionStorage.setItem("rams-audit-seeded", "1");
  });
  await page.goto("/app?view=rams", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-rams-list-toolbar")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".app-rams-doc-row")).toHaveCount(1);
});
for (const failedKey of ["mysafeops_recycle_bin_v1_default", "rams_builder_docs_default"]) {
  test(`deletion keeps the live RAMS when ${failedKey} cannot be persisted`, async ({ page }) => {
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {
        if (this === localStorage && k === key) throw new DOMException("Full", "QuotaExceededError");
        return original.call(this, k, v);
      };
    }, failedKey);
    page.once("dialog", dialog => dialog.accept());
    await page.locator(".app-rams-doc-row").getByRole("button", { name: "×", exact: true }).click();
    await expect(page.getByText(/RAMS could not be (copied|deleted)/).first()).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".app-rams-list-toolbar")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".app-rams-doc-row")).toHaveCount(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default"))[0].deletedAt)).toBeFalsy();
  });
}
test("issued rename preserves approved content and its fingerprint", async ({ page }) => {
  const original = await page.evaluate(async () => {
    const { computeRamsFingerprint } = await import("/src/modules/rams/ramsPrintHtml.js");
    const doc = { id: "r1", title: "Issued original", rows: [], documentStatus: "issued", approvedBy: "Approver", signatureEvents: [{ action: "issued" }], operativeSignatures: { w1: { name: "Worker" } } };
    doc.contentHash = computeRamsFingerprint(doc, []);
    localStorage.setItem("rams_builder_docs_default", JSON.stringify([doc]));
    return doc;
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByText("Open a controlled revision to rename an approved or issued RAMS.").first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default"))[0])).toEqual(original);
});
test("failed import reports failure and never adds an unsaved document", async ({ page }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) {
      if (this === localStorage && k === "rams_builder_docs_default") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  const message = new Promise(resolve => page.once("dialog", async dialog => { resolve(dialog.message()); await dialog.accept(); }));
  await page.locator(".app-rams-list-toolbar input[type=file]").setInputFiles({ name: "rams.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ title: "Unsaved import", rows: [] })) });
  expect(await message).toContain("Import could not be saved");
  await expect(page.locator(".app-rams-doc-row")).toHaveCount(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-rams-list-toolbar")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".app-rams-doc-row")).toHaveCount(1);
});

test("imported approved RAMS becomes an unsigned draft with no inherited publication", async ({ page }) => {
  const message = new Promise(resolve => page.once("dialog", async dialog => { resolve(dialog.message()); await dialog.accept(); }));
  await page.locator(".app-rams-list-toolbar input[type=file]").setInputFiles({ name: "issued.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
    title: "Imported approval", rows: [], documentStatus: "issued", status: "issued", approvedBy: "Original approver", signatureEvents: [{ action: "issued" }], operativeSignatures: { w: { name: "Signer" } }, publicationSnapshot: { version: 1, org: { name: "Other org" } }, sharePublishedAt: "2026-11-01", shareToken: "r_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  })) });
  expect(await message).toBe("Imported: Imported approval");
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default")).find(row => row.title === "Imported approval"));
  expect(doc).toMatchObject({ documentStatus: "draft", status: "draft", approvedBy: "", signatureEvents: [], operativeSignatures: {} });
  expect(doc.shareToken).toBeUndefined();
  expect(doc.sharePublishedAt).toBeUndefined();
  expect(doc.publicationSnapshot).toBeUndefined();
});
