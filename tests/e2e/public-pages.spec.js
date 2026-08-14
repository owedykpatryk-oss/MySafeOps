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

test("domain-restricted join preview shows org branding and omits invitee email", async ({ page }) => {
  await page.route("**/rest/v1/rpc/get_invite_preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          org_name: "Barnes Fernández",
          invite_email: null,
          expires_at: "2028-07-31T23:59:59.000Z",
          logo_url: "/branding/barnes-fernandez-logo.png",
          primary_color: "#174F78",
          accent_color: "#55B8D4",
          allowed_email_domain: "barnesfernandez.com",
          reusable: true,
        },
      ]),
    });
  });

  await page.goto("/accept-invite?invite=barnes-worker-join-token");
  await expect(page.getByRole("img", { name: "Barnes Fernández logo" })).toHaveAttribute(
    "src",
    "/branding/barnes-fernandez-logo.png"
  );
  await expect(page.getByText(/verified @barnesfernandez.com email/i)).toBeVisible();
  // Reusable join links reject existing memberships server-side — no org-switch ack.
  await expect(page.getByRole("checkbox", { name: /disconnect this account/i })).toHaveCount(0);
  await expect(page.getByText(/not already in another organisation/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute(
    "href",
    "/login?invite=barnes-worker-join-token"
  );
});

test("admin exact-email join preview carries the administrator address into sign-in", async ({ page }) => {
  await page.route("**/rest/v1/rpc/get_invite_preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          org_name: "Barnes Fernández",
          invite_email: "admin@barnesfernandez.com",
          expires_at: "2026-10-31T23:59:59.000Z",
          logo_url: "/branding/barnes-fernandez-logo.png",
          primary_color: "#174F78",
          accent_color: "#55B8D4",
          allowed_email_domain: "barnesfernandez.com",
          reusable: true,
        },
      ]),
    });
  });

  await page.goto("/accept-invite?invite=barnes-admin-join-token");
  await expect(page.getByRole("img", { name: "Barnes Fernández logo" })).toHaveAttribute(
    "src",
    "/branding/barnes-fernandez-logo.png"
  );
  await expect(page.getByText("admin@barnesfernandez.com", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /disconnect this account/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute(
    "href",
    "/login?invite=barnes-admin-join-token&email=admin%40barnesfernandez.com"
  );
});

test("invite preview drops protocol-relative brand logos", async ({ page }) => {
  await page.route("**/rest/v1/rpc/get_invite_preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          org_name: "Barnes Fernández",
          invite_email: null,
          expires_at: "2028-07-31T23:59:59.000Z",
          logo_url: "//evil.test/barnes-fernandez-logo.png",
          primary_color: "#174F78",
          accent_color: "#55B8D4",
          allowed_email_domain: "barnesfernandez.com",
          reusable: true,
        },
      ]),
    });
  });

  await page.goto("/accept-invite?invite=barnes-worker-join-token");
  await expect(page.getByText("Barnes Fernández", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Barnes Fernández logo" })).toHaveCount(0);
});

test("login pre-fills invite email hint from query params", async ({ page }) => {
  await page.goto("/login?invite=test-token&email=worker@example.com");
  await expect(page.getByText(/Invite detected for worker@example.com/i)).toBeVisible();
});
