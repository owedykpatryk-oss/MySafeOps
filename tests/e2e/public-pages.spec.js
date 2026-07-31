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

test("valid invite preview carries the token and email into sign-in", async ({ page }) => {
  await page.route("**/rest/v1/rpc/get_invite_preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          org_name: "Utility Mapping",
          invite_email: "worker@u-map.co.uk",
          expires_at: "2027-08-14T12:00:00.000Z",
          primary_color: "#0B1D3A",
          accent_color: "#00B4E4",
        },
      ]),
    });
  });

  await page.goto("/accept-invite?invite=invite-token-123");
  await expect(page.getByText("Utility Mapping", { exact: true })).toBeVisible();
  const acknowledgement = page.getByRole("checkbox", { name: /disconnect this account/i });
  await acknowledgement.check();
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute(
    "href",
    "/login?invite=invite-token-123&email=worker%40u-map.co.uk"
  );
});

test("login pre-fills invite email hint from query params", async ({ page }) => {
  await page.goto("/login?invite=test-token&email=worker@example.com");
  await expect(page.getByText(/Invite detected for worker@example.com/i)).toBeVisible();
});
