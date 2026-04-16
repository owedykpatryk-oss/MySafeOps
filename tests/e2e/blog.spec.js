import { expect, test } from "@playwright/test";

test.describe("Marketing blog", () => {
  test("nav opens blog index and a guide article", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Blog" }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.getByRole("heading", { name: /Safety guides/i })).toBeVisible();

    await page.locator("a.landing-blog-card-link").first().click();
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/);
    const prose = page.locator("article.blog-article-prose");
    await expect(prose).toBeVisible();
    await expect(prose).not.toBeEmpty();
    await expect.poll(async () => (await prose.innerText()).trim().length).toBeGreaterThan(400);
  });
});
