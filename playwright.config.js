import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          // E2E must not require Turnstile (local .env.local may set a site key).
          VITE_TURNSTILE_SITE_KEY: "",
          // Invite preview tests mock get_invite_preview; the client only calls it
          // when both URL and anon key are present. Stub values keep PR CI off secrets.
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://e2e.supabase.co",
          VITE_SUPABASE_ANON_KEY:
            process.env.VITE_SUPABASE_ANON_KEY ||
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiZXhwIjo5OTk5OTk5OTk5fQ.e2e",
        },
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

