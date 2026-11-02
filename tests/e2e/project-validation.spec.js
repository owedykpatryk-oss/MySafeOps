import { test, expect } from "@playwright/test";

test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("project-validation-seeded")) return;
    localStorage.clear();
    localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({
      onboardingWizardCompleted: true, name: "Validation test organisation",
      automationRules: { autoApplyPlaybookOnCreate: false },
    }));
    sessionStorage.setItem("project-validation-seeded", "1");
  });
  await page.goto("/app?view=projects", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 30000 });
  const skip = page.getByRole("button", { name: "Skip setup for now", exact: true });
  if (await skip.isVisible()) await skip.click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
});

for (const save of ["Save", "Save + drawing editor"]) {
  test(`${save} blocks blank and whitespace fields, then saves one corrected project`, async ({ page }) => {
    const name = page.locator("#workers-name-2");
    const site = page.locator("#workers-site");
    const button = page.getByRole("button", { name: save, exact: true });
    for (const [nameValue, siteValue, invalid] of [
      ["", "", name], ["   ", "   ", name], ["Survey", "", site], ["", "Client", name],
    ]) {
      await name.fill(nameValue);
      await site.fill(siteValue);
      await button.click();
      await expect(invalid).toHaveAttribute("aria-invalid", "true");
      await expect(invalid).toBeFocused();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mysafeops_projects_default") || "[]"))).toEqual([]);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rams_builder_docs_default") || "[]"))).toEqual([]);
    }
    await name.fill("  Survey QA  ");
    await site.fill("  Client QA  ");
    await button.click();
    await expect(name).toBeHidden();
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("mysafeops_projects_default") || "[]"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Survey QA", site: "Client QA" });
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mysafeops_projects_default") || "[]"))).toHaveLength(1);
  });
}
