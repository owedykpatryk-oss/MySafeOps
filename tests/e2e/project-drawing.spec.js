import { expect, test } from "@playwright/test";

test("project drawing editor loads when workspace is available", async ({ page }) => {
  await page.goto("/app?view=project-drawings");
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/login")) {
    test.skip(true, "Requires an authenticated session when Supabase is configured.");
  }
  await expect(page.getByRole("heading", { name: "Project drawing editor" })).toBeVisible({ timeout: 25000 });
});
