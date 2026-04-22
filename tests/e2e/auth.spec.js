import { expect, test } from "@playwright/test";

function uniqueEmail() {
  return `mysafeops.e2e+${Date.now()}@gmail.com`;
}

test.describe("Auth flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back to MySafeOps" })).toBeVisible();
  });

  test("sanitizes malicious next= so post-login path stays in-app", async ({ page }) => {
    await page.goto("/login?next=//evil.com/phish");
    const card = page.locator("[data-login-next]");
    await expect(card).toHaveAttribute("data-login-next", "/app");
  });

  test("preserves safe next= for post-login redirect", async ({ page }) => {
    await page.goto("/login?next=%2Fsettings");
    const card = page.locator("[data-login-next]");
    await expect(card).toHaveAttribute("data-login-next", "/settings");
  });

  test("signup shows confirmation instructions", async ({ page }) => {
    const email = process.env.E2E_SIGNUP_EMAIL || uniqueEmail();
    const password = process.env.E2E_SIGNUP_PASSWORD || "MySafeOpsE2E!234";

    await page.getByLabel("Email").fill(email);
    await page.locator("#login-password").fill(password);
    await page.getByRole("checkbox", { name: /agree to the Terms/i }).check();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/Account created/i)).toBeVisible();
  });

  test("resend confirmation email action works", async ({ page }) => {
    const email = process.env.E2E_EXISTING_UNCONFIRMED_EMAIL;
    test.skip(!email, "Set E2E_EXISTING_UNCONFIRMED_EMAIL to run this test.");

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Resend confirmation email" }).click();

    await expect(page.getByText(/Confirmation email re-sent/i)).toBeVisible();
  });

  test("forgot password sends reset email", async ({ page }) => {
    const email = process.env.E2E_RESET_EMAIL;
    test.skip(!email, "Set E2E_RESET_EMAIL to run this test.");

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Forgot password" }).click();

    await expect(page.getByText(/Password reset email sent/i)).toBeVisible();
  });

  test("failed logins trigger temporary lockout UX", async ({ page }) => {
    const email = process.env.E2E_LOCKOUT_EMAIL;
    const wrongPassword = process.env.E2E_LOCKOUT_WRONG_PASSWORD;
    test.skip(!email || !wrongPassword, "Set E2E_LOCKOUT_EMAIL and E2E_LOCKOUT_WRONG_PASSWORD.");

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(wrongPassword);

    for (let i = 0; i < 5; i += 1) {
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText(/attempts left|temporary lockout/i)).toBeVisible();
    }

    await expect(page.getByText(/Temporary lockout active/i)).toBeVisible();
  });

  test("google sign-in redirect starts", async ({ page }) => {
    test.skip(process.env.E2E_RUN_EXTERNAL_AUTH !== "1", "Set E2E_RUN_EXTERNAL_AUTH=1 for external OAuth redirect test.");

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL(/supabase|google/i, { timeout: 30000 });
  });
});

test("reset password page is available", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
});

