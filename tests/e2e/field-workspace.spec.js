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

async function openGprWithSavedDraft(page) {
  await page.evaluate(async () => {
    const { blankGprReport } = await import("/src/modules/gprReport/gprReportConstants.js");
    const { getGprEditorScope, writeGprEditorSession } = await import("/src/modules/gprReport/gprEditorSession.js");
    const rows = JSON.parse(localStorage.getItem("mysafeops_projects_default"));
    rows.push({ id: "new-site", name: "Next site" });
    localStorage.setItem("mysafeops_projects_default", JSON.stringify(rows));
    writeGprEditorSession({ isNew: true, tab: "setup", data: { ...blankGprReport({ id: "old-draft", title: "Unfinished North report", ref: "GPR-OLD" }), projectId: "site-a" } }, getGprEditorScope("anonymous"));
  });
  await page.reload();
  await page.getByLabel("Working site").selectOption("new-site");
  await page.getByRole("button", { name: /^GPR report/ }).click();
}

test("GPR explains a restored draft before opening another site's report", async ({ page }) => {
  await openGprWithSavedDraft(page);
  await expect(page.getByRole("alert").filter({ hasText: "A GPR draft is already open" })).toBeVisible();
  await expect(page.locator('input[value="Unfinished North report"]')).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreGprStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "gpr_reports_default") throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.locator('input[value="Unfinished North report"]').fill("Retained North draft");
  await page.getByRole("button", { name: "Save draft and continue", exact: true }).click();
  await expect(page.locator('input[value="Retained North draft"]')).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "A GPR draft is already open" })).toBeVisible();
  await page.evaluate(() => window.restoreGprStorage());
  await page.getByRole("button", { name: "Save draft and continue", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "A GPR draft is already open" })).toHaveCount(0);
  await expect.poll(() => page.locator("select").evaluateAll(nodes => nodes.some(n => n.value === "new-site"))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gpr_reports_default")).find(r => r.id === "old-draft"))).toMatchObject({ projectId: "site-a", title: "Retained North draft" });
});

test("field tabs reveal content and keep the selected site reachable", async ({ page }) => {
  await page.getByLabel("Working site", { exact: true }).selectOption("site-a");
  const nav = page.getByRole("navigation", { name: "Site workspace" });
  await nav.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("region", { name: "Documents", exact: true })).toBeFocused();
  // The app respects the user's motion preference; Chromium animates this scroll.
  await expect.poll(async () => (await page.locator("#field-panel").boundingBox())?.y ?? Infinity).toBeLessThan(450);
  const bounds = await page.locator("#field-panel").boundingBox();
  const header = await page.locator(".app-workspace-header").boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(bounds.y).toBeLessThan(450);
  await expect(nav).toContainText("North site");
  await nav.getByRole("button", { name: "Choose another site", exact: true }).click();
  await expect(page.getByLabel("Working site", { exact: true })).toBeFocused();
  await page.reload();
  await expect(nav.getByRole("button", { name: "Documents", exact: true })).toHaveAttribute("aria-current", "page");
});

test("a site deleted in another tab disappears without being restored by the field cache", async ({ page, context }) => {
  await page.getByLabel("Working site", { exact: true }).selectOption("site-a");
  const other = await context.newPage();
  await other.goto("/app?view=field-home", { waitUntil: "domcontentloaded" });
  await other.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("mysafeops_projects_default"));
    rows.find(p => p.id === "site-a").deletedAt = new Date().toISOString();
    localStorage.setItem("mysafeops_projects_default", JSON.stringify(rows));
  });
  await expect(page.getByLabel("Working site", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: /^Survey report/ })).toBeDisabled();
  await page.reload();
  await expect(page.locator("#field-site option")).toHaveCount(1);
  expect(await page.evaluate(() => Boolean(JSON.parse(localStorage.getItem("mysafeops_projects_default")).find(p => p.id === "site-a").deletedAt))).toBe(true);
  await other.close();
});

test("queued GPR navigation cannot follow a switch to another organisation", async ({ page }) => {
  await openGprWithSavedDraft(page);
  await expect(page.getByRole("alert").filter({ hasText: "A GPR draft is already open" })).toBeVisible();
  await page.evaluate(async () => {
    localStorage.setItem("mysafeops_projects_field-b", JSON.stringify([{ id: "new-site", name: "Different organisation's site" }]));
    const { setOrgId } = await import("/src/utils/orgId.js"); setOrgId("field-b");
  });
  await expect(page.locator(".app-gpr-report-editor")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gpr_reports_field-b") || "[]"))).toEqual([]);
  await page.evaluate(async () => { const { setOrgId } = await import("/src/utils/orgId.js"); setOrgId("default"); });
  await expect(page.locator('input[value="Unfinished North report"]')).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "A GPR draft is already open" })).toHaveCount(0);
});

for (const type of ["gpr", "survey"]) test(`${type} late saves preserve a concurrent deletion and retain the draft`, async ({ page, context }) => {
  await page.evaluate(async (kind) => {
    const constants = kind === "gpr"
      ? await import("/src/modules/gprReport/gprReportConstants.js")
      : await import("/src/modules/surveyReport/surveyReportConstants.js");
    const blank = kind === "gpr" ? constants.blankGprReport : constants.blankSurveyReport;
    localStorage.setItem(`${kind}_reports_default`, JSON.stringify([blank({ id: "delete-race", title: "Report before deletion", projectId: "site-a", ref: "QA-DELETE" })]));
    const { setWorkspaceNavTarget, openWorkspaceView } = await import("/src/utils/workspaceNavContext.js");
    setWorkspaceNavTarget({ viewId: `${kind}-report`, reportId: "delete-race" });
    openWorkspaceView({ viewId: `${kind}-report` });
  }, type);
  const title = page.locator('input[value="Report before deletion"]');
  await expect(title).toBeVisible();
  const other = await context.newPage();
  await other.goto("/app?view=field-home", { waitUntil: "domcontentloaded" });
  await other.evaluate((kind) => {
    const key = `${kind}_reports_default`;
    const rows = JSON.parse(localStorage.getItem(key));
    rows[0].deletedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(rows));
  }, type);
  await title.fill("Retained late edits");
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  if (type === "survey") await page.getByRole("button", { name: "Save as-is", exact: true }).click();
  await expect(page.getByText("Report not saved", { exact: true }).first()).toBeVisible();
  await expect(page.locator('input[value="Retained late edits"]')).toBeVisible();
  expect(await page.evaluate(kind => Boolean(JSON.parse(localStorage.getItem(`${kind}_reports_default`))[0].deletedAt), type)).toBe(true);
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => {
    try { const draft = JSON.parse(sessionStorage.getItem(key)); return (draft?.data?.title || draft?.form?.title) === "Retained late edits"; }
    catch { return false; }
  }))).toBe(true);
  await other.close();
});
