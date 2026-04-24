import { expect, test } from "@playwright/test";

test.describe("Security posture (public)", () => {
  test("/security renders trust summary", async ({ page }) => {
    await page.goto("/security");
    await expect(page).toHaveURL(/\/security$/);
    await expect(page.getByRole("heading", { name: /Security & trust/i })).toBeVisible();
    await expect(page.getByText(/Supabase Auth/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /\.well-known\/security\.txt/ })).toBeVisible();
  });

  test("security.txt is reachable and lists contact", async ({ request }) => {
    const res = await request.get("/.well-known/security.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Contact:\s*mailto:/i);
    expect(text).toMatch(/support@mysafeops\.com/i);
    expect(text).toMatch(/Canonical:\s*https:\/\//i);
  });
});
