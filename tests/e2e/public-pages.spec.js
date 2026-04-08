import { expect, test } from "@playwright/test";

test("landing exposes sign-in and get-started actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Get started/i }).first()).toBeVisible();
});

test("accept-invite without token explains the problem", async ({ page }) => {
  await page.goto("/accept-invite");
  await expect(page.getByText(/Missing invite token/i)).toBeVisible();
});

test("login pre-fills invite email hint from query params", async ({ page }) => {
  await page.goto("/login?invite=test-token&email=worker@example.com");
  await expect(page.getByText(/Invite detected for worker@example.com/i)).toBeVisible();
});
