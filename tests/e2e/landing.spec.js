import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("hero, product tour, and core sections are visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Safety operations for UK site teams/i })).toBeVisible({ timeout: 20000 });

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Product" }).click();
    await expect(page.locator("#product")).toBeInViewport();
    await page.getByRole("tab", { name: "Permit control" }).click();
    await expect(page.getByRole("tab", { name: "Permit control" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: /without losing the audit trail/i })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Features" }).click();
    await expect(page.locator("#features")).toBeInViewport();

    const firstFeatureCard = page.locator("#features article").first();
    await expect(firstFeatureCard).toBeVisible();
    await expect
      .poll(async () => firstFeatureCard.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10000 })
      .toBe("1");

    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /Plans that stay transparent/i })).toBeVisible();

    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("footer links to legal pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Safety operations for UK site teams/i })).toBeVisible({ timeout: 20000 });
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('iframe[title="Privacy policy"]')).toBeVisible();
  });

  test("AU landing shows SWMS copy and AUD pricing", async ({ page }) => {
    await page.goto("/au");
    await expect(page.getByRole("heading", { name: /Safety operations for Australian site teams/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/construction & civil/i)).toBeVisible();
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.getByText("A$59")).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /🇬🇧 United Kingdom/i })).toBeVisible();
  });

  test("PL landing shows IOR copy and PLN pricing", async ({ page }) => {
    await page.goto("/pl");
    await expect(page.getByRole("heading", { name: /Operacje BHP dla ekip/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Polskie ekipy budowlane/i)).toBeVisible();
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.getByText("79 zł")).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /🇬🇧 United Kingdom/i })).toBeVisible();
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /Najczęstsze pytania/i })).toBeVisible();
  });
});
