import { expect, test } from "@playwright/test";

test.describe("Not found", () => {
  test("unknown path shows 404 with navigation", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-xyz");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page).toHaveTitle(/Page not found/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/");
  });
});
