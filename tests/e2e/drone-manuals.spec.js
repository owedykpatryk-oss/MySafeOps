import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test.beforeEach(async ({ page }) => {
  await page.goto("/app?view=drone-operations");
  await expect(page.getByRole("tab", { name: "Operations Manuals", exact: true })).toBeVisible();
  const skip = page.getByRole("button", { name: "Skip setup for now", exact: true });
  if (await skip.isVisible()) await skip.click();
  await page.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  await page.getByRole("button", { name: "New manual", exact: true }).click();
});
test("company manual saves profile and outlines, blocks incomplete review and exports a draft", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("Company legal name", { exact: true }).fill("Example Survey — QA only");
  await page.getByLabel("Document code", { exact: true }).fill("OM-QA-001");
  await page.getByLabel("Next review date", { exact: true }).fill("2027-10-29");
  await page.getByLabel("Controlled distribution", { exact: true }).fill("Example survey team and document owner");
  await page.getByRole("button", { name: "Add outlines to empty chapters", exact: true }).click();
  await page.getByRole("button", { name: "Save company manual", exact: true }).click();
  await expect(page.locator(".manual-save-bar")).toContainText("Saved on this device");
  await page.getByRole("button", { name: "Record responsible person review", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Complete the scope");
  const values = await page.evaluate(() => JSON.parse(localStorage.getItem("drone_manuals_default")));
  expect(values[0].company.name).toBe("Example Survey — QA only");
  expect(values[0].sections.operator).toContain("[TO COMPLETE:");
  expect(values[0].approvedAt).toBeUndefined();
  mkdirSync("output/drone-qa", { recursive: true });
  await page.locator(".manual-hero").screenshot({ path: `output/drone-qa/${info.project.name}-company-manual.png` });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download manual PDF", exact: true }).click();
  await (await download).saveAs(`output/drone-qa/${info.project.name}-company-manual.pdf`);
  await page.reload();
  await page.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  await page.getByRole("combobox", { name: "Manual version", exact: true }).selectOption(values[0].id);
  await expect(page.getByLabel("Company legal name", { exact: true })).toHaveValue("Example Survey — QA only");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
test("failed company saves retain edits and only claim saved after retry", async ({ page }) => {
  await page.getByLabel("Company legal name", { exact: true }).fill("Stored company");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "drone_manuals_default") {
        Storage.prototype.setItem = original;
        throw new DOMException("QA quota", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByLabel("Company legal name", { exact: true }).fill("Retained company edit");
  await expect(page.getByLabel("Company legal name", { exact: true })).toHaveValue("Retained company edit");
  await expect(page.locator(".manual-save-bar")).toContainText("Unsaved changes");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("drone_manuals_default"))[0].company.name)).toBe(
    "Stored company"
  );
  await page.getByRole("tab", { name: "Missions", exact: true }).click();
  await page.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  await expect(page.getByLabel("Company legal name", { exact: true })).toHaveValue("Retained company edit");
  await page.getByRole("button", { name: "Save company manual", exact: true }).click();
  await expect(page.locator(".manual-save-bar")).toContainText("Saved on this device");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("drone_manuals_default"))[0].company.name)).toBe(
    "Retained company edit"
  );
});

test("stale manual saves preserve another tab's reviewed version and new records", async ({ page, context }) => {
  await page.getByLabel("Company legal name", { exact: true }).fill("Original company");
  const other = await context.newPage();
  await other.goto("/app?view=drone-operations");
  await other.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  await other.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("drone_manuals_default"));
    rows[0].company.name = "Reviewed by the other tab";
    rows[0].approvedAt = new Date().toISOString();
    rows[0].approvedBy = "QA reviewer";
    rows.push({ ...rows[0], id: "other-tab-manual", title: "Another company manual" });
    localStorage.setItem("drone_manuals_default", JSON.stringify(rows));
  });
  await page.getByLabel("Company legal name", { exact: true }).fill("Stale attempted edit");
  await expect(page.locator(".manual-save-bar")).toContainText("Unsaved changes");
  await expect(page.getByRole("alert")).toContainText("locked");
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("drone_manuals_default")));
  expect(rows).toHaveLength(2);
  expect(rows[0].company.name).toBe("Reviewed by the other tab");
  expect(rows[0].approvedAt).toBeTruthy();
  await page.getByRole("button", { name: "Discard unsaved edits", exact: true }).click();
  await expect(page.getByLabel("Company legal name", { exact: true })).toHaveValue("Reviewed by the other tab");
  await expect(page.getByLabel("Company legal name", { exact: true })).toBeDisabled();
  await other.close();
});

test("manual automation fills missing details, prioritises reviews and records revision changes", async ({
  page,
}, info) => {
  await page.evaluate(() => {
    const key = "mysafeops_org_settings_default",
      settings = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(
      key,
      JSON.stringify({
        ...settings,
        name: "Profile company",
        email: "manuals@example.com",
        address: "QA profile address",
      })
    );
  });
  await page.getByLabel("Company legal name", { exact: true }).fill("Keep my company name");
  await page.getByRole("button", { name: "Fill missing company details", exact: true }).click();
  await expect(page.getByLabel("Company legal name", { exact: true })).toHaveValue("Keep my company name");
  await expect(page.getByLabel("Company email", { exact: true })).toHaveValue("manuals@example.com");
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("drone_manuals_default"));
    const old = {
      ...rows[0],
      id: "qa-old",
      title: "Superseded QA manual",
      approvedAt: "2020-01-01",
      approvedBy: "QA owner",
      reviewDue: "2020-02-01",
      version: "1.0",
    };
    const newer = {
      ...old,
      id: "qa-current",
      title: "Current QA manual",
      previousId: old.id,
      reviewDue: "2099-01-01",
      version: "2.0",
    };
    const overdue = { ...old, id: "qa-overdue", title: "Overdue QA manual", scope: "Original QA scope" };
    localStorage.setItem("drone_manuals_default", JSON.stringify([...rows, old, newer, overdue]));
  });
  await page.reload();
  await page.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  const queue = page.getByRole("region", { name: "Manual review queue", exact: true });
  await expect(queue).not.toContainText("Superseded QA manual");
  await expect(queue).not.toContainText("Current QA manual");
  await queue.getByRole("button", { name: /Overdue QA manual/ }).click();
  await expect(page.locator(".manual-hero")).toContainText("Review overdue");
  await page.getByRole("button", { name: "Create revision", exact: true }).click();
  await page.getByRole("textbox", { name: "Operating scope and pathway", exact: true }).fill("Changed QA scope");
  await page.getByRole("button", { name: "Append change summary", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Amendment record", exact: true })).toHaveValue(
    /Changes detected from version 1.0:[\s\S]*Operating scope/
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download manual PDF", exact: true }).click();
  await (await download).saveAs(`output/drone-qa/${info.project.name}-manual-automation.pdf`);
  await page
    .locator(".manual-automation-tools")
    .screenshot({ path: `output/drone-qa/${info.project.name}-manual-automation.png` });
});
