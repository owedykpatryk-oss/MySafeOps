import { test, expect } from "@playwright/test";

test.skip(({ baseURL }) => !baseURL?.endsWith(":4189"), "Requires the isolated native preview bundle");

for (const entry of ["/", "/index.html"]) test(`native cold launch opens the field workspace from ${entry}`, async ({ page, baseURL }) => {
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (route.request().url().startsWith(baseURL + "/")) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true };
    localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({
      name: "Device preview", onboardingWizardCompleted: true, hiddenModulesBootstrapped: true,
      marketModulePackApplied: "uk", hiddenModules: [],
    }));
    localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "preview-site", name: "Preview site" }]));
  });
  await page.goto(entry);
  await expect(page).toHaveURL(/\/app\?view=field-home/);
  await expect(page.getByText(/Device preview — data stays on this device/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your day on site" })).toBeVisible();
  await page.getByLabel("Working site").selectOption("preview-site");
  await page.getByRole("navigation", { name: "Site workspace" }).getByRole("button", { name: "Documents", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Working site")).toHaveValue("preview-site");
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(rows => rows.length))).toBe(0);
  expect(errors).toEqual([]);
  expect(externalRequests.filter(url => /supabase|workers\.dev|mysafeops\.com/.test(url))).toEqual([]);
});
