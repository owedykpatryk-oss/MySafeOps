import { expect, test } from "@playwright/test";

test.describe("Billing smoke", () => {
  test("admin can open billing and see health checks", async ({ page }) => {
    const email = process.env.E2E_BILLING_EMAIL;
    const password = process.env.E2E_BILLING_PASSWORD;
    test.skip(!email || !password, "Set E2E_BILLING_EMAIL and E2E_BILLING_PASSWORD.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/app/i, { timeout: 30000 });

    await page.goto("/app?settingsTab=billing");
    await expect(page.getByRole("heading", { name: "Billing & limits" })).toBeVisible();
    await expect(page.getByText("Billing health")).toBeVisible();
    await expect(page.getByText("stripe-checkout")).toBeVisible();
    await expect(page.getByText("stripe-portal")).toBeVisible();
    await expect(page.getByText("stripe-webhook")).toBeVisible();
  });
});
