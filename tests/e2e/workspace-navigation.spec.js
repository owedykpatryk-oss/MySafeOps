import { test, expect } from "@playwright/test";

test.skip(({ baseURL }) => !baseURL?.endsWith(":4196"), "Requires the isolated projects test server");
test.setTimeout(120000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("navigation-qa")) return;
    localStorage.clear();
    localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({ name: "Navigation QA", onboardingWizardCompleted: true }));
    sessionStorage.setItem("navigation-qa", "1");
  });
});

test("header Dashboard leaves Settings and Billing by mouse and keyboard", async ({ page }) => {
  for (const [url, keyboard] of [["/app?view=settings", false], ["/app?view=settings&settingsTab=billing", true]]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const heading = page.locator(".app-workspace-header h1");
    await expect(heading).toHaveText("Settings", { timeout: 30000 });
    const dashboard = page.getByRole("button", { name: "Go to dashboard", exact: true });
    if (keyboard) { await dashboard.focus(); await dashboard.press("Enter"); }
    else await dashboard.click();
    await expect(heading).toHaveText("Dashboard");
    await expect(page).toHaveURL(/view=dashboard/);
    expect(new URL(page.url()).searchParams.has("settingsTab")).toBe(false);
    await page.reload();
    await expect(heading).toHaveText("Dashboard", { timeout: 30000 });
  }
});

test("Dashboard closes More and leaves other header actions usable", async ({ page }) => {
  await page.goto("/app?view=settings", { waitUntil: "domcontentloaded" });
  const more = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "More", exact: true });
  await more.click();
  await expect(page.getByLabel("Filter more modules")).toBeVisible();
  await page.getByRole("button", { name: "Go to dashboard", exact: true }).click();
  await expect(page.locator(".app-workspace-header h1")).toHaveText("Dashboard");
  await expect(page.getByLabel("Filter more modules")).toBeHidden();
  await more.click();
  await expect(page.getByLabel("Filter more modules")).toBeVisible();
  await page.getByRole("button", { name: "Open Help", exact: true }).click();
  await expect(page.locator(".app-workspace-header h1")).toHaveText("Help");
  await page.getByRole("button", { name: "Open Settings", exact: true }).click();
  await expect(page.locator(".app-workspace-header h1")).toHaveText("Settings", { timeout: 30000 });
});

test("compact header menu opens Dashboard from Settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app?view=settings", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-workspace-header h1")).toHaveText("Settings");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Dashboard", exact: true }).click();
  await expect(page.locator(".app-workspace-header h1")).toHaveText("Dashboard");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page).toHaveURL(/view=dashboard/);
});

test("mobile bottom navigation keeps every action inside the portrait viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app?view=dashboard", { waitUntil: "domcontentloaded" });
  const buttons = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button");
  await expect(buttons.last()).toBeVisible({ timeout: 90000 });
  const overflow = await buttons.evaluateAll((nodes) => nodes.some((node) => {
    const bounds = node.getBoundingClientRect();
    return bounds.left < 0 || bounds.right > window.innerWidth;
  }));
  expect(overflow).toBe(false);
});

test("Plan action uploads and retains a drawing after reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "qa-plan-project", name: "QA plan project", site: "QA site" }]));
  });
  await page.goto("/app?view=project-drawings", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#project-drawing-project")).toBeVisible({ timeout: 90000 });
  await page.locator("#project-drawing-project").selectOption("qa-plan-project");
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("tab", { name: "Plan (PDF / image)" }).click();
  const chooser = await picker;
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles({
    name: "qa-plan.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.getByText("Plan uploaded", { exact: false })).toBeVisible();
  await expect(page.locator(".site-plan-panel__plan-meta strong")).toHaveText(/^qa-plan\.(png|jpg)$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#project-drawing-project")).toBeVisible({ timeout: 90000 });
  await page.locator("#project-drawing-project").selectOption("qa-plan-project");
  await page.getByRole("tab", { name: "Plan (PDF / image)" }).click();
  await expect(page.locator(".site-plan-panel__plan-meta strong")).toHaveText(/^qa-plan\.(png|jpg)$/);
});
