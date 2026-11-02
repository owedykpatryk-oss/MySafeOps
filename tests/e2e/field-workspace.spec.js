import { test, expect } from "@playwright/test";

test.skip(({ baseURL }) => !baseURL?.endsWith(":4188"), "Requires isolated local workspace");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("field-qa")) return;
    localStorage.clear();
    for (const org of ["default", "field-b"]) {
      localStorage.setItem(`mysafeops_org_settings_${org}`, JSON.stringify({ name: org, onboardingWizardCompleted: true, hiddenModulesBootstrapped: true, marketModulePackApplied: "uk", hiddenModules: [] }));
    }
    localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "site-a", name: "North site", site: "North works", siteManager: "Alex", address: "1 Site Road" }, { id: "deleted", name: "Deleted site", deletedAt: "2026-01-01" }]));
    localStorage.setItem("mysafeops_projects_field-b", JSON.stringify([{ id: "site-b", name: "South site" }]));
    localStorage.setItem("mysafeops_projects_default__country_field-pl", JSON.stringify([{ id: "site-pl", name: "Poland site" }]));
    sessionStorage.setItem("field-qa", "1");
  });
  await page.goto("/app?view=field-home", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Your day on site" })).toBeVisible({ timeout: 60000 });
});

test("field workspace selects a site, opens profile and fits a narrow screen", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole("button", { name: /^Survey report/ })).toBeDisabled();
  await expect(page.locator("#field-site option")).toHaveCount(2);
  await page.getByLabel("Working site").selectOption("site-a");
  await page.screenshot({ path: testInfo.outputPath("site-workspace.png"), fullPage: true });
  await page.getByRole("navigation", { name: "Site workspace" }).getByRole("button", { name: "Site", exact: true }).click();
  await expect(page.getByText("Alex", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^Site profile/ }).click();
  await expect(page).toHaveURL(/view=projects/);
  await expect(page.getByText("North site", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Site workspace", exact: true }).click();
  await expect(page.getByLabel("Working site")).toHaveValue("site-a");
  await page.reload();
  await expect(page.getByLabel("Working site")).toHaveValue("site-a");
});

test("survey creation carries the selected site into the editor", async ({ page }) => {
  await page.getByLabel("Working site").selectOption("site-a");
  await page.getByRole("button", { name: /^Survey report/ }).click();
  await expect(page).toHaveURL(/view=survey-report/);
  await expect(page.locator("#survey-report-project-id")).toHaveValue("site-a", { timeout: 30000 });
});

for (const scope of ["organisation", "country"]) test(`changing ${scope} clears site selection and old site details`, async ({ page }) => {
  await page.getByLabel("Working site").selectOption("site-a");
  await page.evaluate(async (kind) => {
    if (kind === "organisation") { const { setOrgId } = await import("/src/utils/orgId.js"); setOrgId("field-b"); }
    else { const { cacheActiveCountryWorkspace } = await import("/src/utils/countryWorkspaces.js"); cacheActiveCountryWorkspace({ id: "field-pl", is_primary: false, market_id: "pl" }); }
  }, scope);
  await expect(page.getByLabel("Working site")).toHaveValue("");
  await expect(page.locator("#field-site")).not.toContainText("North site");
  await expect(page.locator("#field-site")).toContainText(scope === "organisation" ? "South site" : "Poland site");
  if (scope === "organisation") await expect(page.getByRole("button", { name: /^Survey report/ })).toBeDisabled();
  else await expect(page.getByRole("button", { name: /^Survey report/ })).toHaveCount(0);
});

test("a switch in another tab does not retain the previous organisation's site", async ({ page, context }) => {
  await page.getByLabel("Working site").selectOption("site-a");
  const other = await context.newPage();
  await other.goto("/app?view=field-home", { waitUntil: "domcontentloaded" });
  await expect(other.getByLabel("Working site")).toBeVisible();
  await other.evaluate(async () => { const { setOrgId } = await import("/src/utils/orgId.js"); setOrgId("field-b"); });
  await expect(page.getByLabel("Working site")).toHaveValue("");
  await expect(page.locator("#field-site")).toContainText("South site");
  await expect(page.locator("#field-site")).not.toContainText("North site");
  await other.close();
});

test("hidden modules stay hidden and offline status makes no sync promise", async ({ page, context }) => {
  await page.evaluate(async () => { const { hideModule } = await import("/src/utils/hiddenModules.js"); hideModule("gpr-report"); });
  await expect(page.getByRole("button", { name: /^GPR report/ })).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByText("Offline — using information on this device", { exact: true })).toBeVisible();
  await expect(page.getByText(/An internet connection alone/)).toBeVisible();
});
