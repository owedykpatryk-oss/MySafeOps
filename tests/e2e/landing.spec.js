import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("hero, animated sections, and blog strip are visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Site safety/i })).toBeVisible({ timeout: 20000 });

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Features" }).click();
    await expect(page.locator("#features")).toBeInViewport();

    const firstFeatureCard = page.locator("#features .fc").first();
    await expect(firstFeatureCard).toBeVisible();
    await expect
      .poll(async () => firstFeatureCard.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10000 })
      .toBe("1");

    await page.locator("#blog").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /From the blog/i })).toBeVisible();
    await expect(page.locator("a.landing-blog-card-link").first()).toBeVisible();

    await expect(page.getByRole("contentinfo")).toBeVisible();
  });
});
