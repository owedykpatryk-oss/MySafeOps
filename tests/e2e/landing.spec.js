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

  test("footer links to legal pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Site safety/i })).toBeVisible({ timeout: 20000 });
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('iframe[title="Privacy policy"]')).toBeVisible();
  });

  test("AU landing shows SWMS copy and AUD pricing", async ({ page }) => {
    await page.goto("/au");
    await expect(page.getByRole("heading", { name: /Site safety/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Australian site teams/i)).toBeVisible();
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.getByText("A$59")).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /🇬🇧 United Kingdom/i })).toBeVisible();
  });

  test("PL landing shows IOR copy and PLN pricing", async ({ page }) => {
    await page.goto("/pl");
    await expect(page.getByRole("heading", { name: /BHP na budowie/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Polskie ekipy budowlane/i)).toBeVisible();
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.getByText("79 zł")).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /🇬🇧 United Kingdom/i })).toBeVisible();
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /Najczęstsze pytania/i })).toBeVisible();
  });
});
