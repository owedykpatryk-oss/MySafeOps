import { defineConfig, devices } from "@playwright/test";

// Isolated device-only workspace: no production credentials or cloud writes.
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/operational-global-setup.js",
  testMatch: ["register-mobile.spec.js", "rams-audit-regressions.spec.js", "workspace-isolation.spec.js"],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4188", trace: "retain-on-failure" },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4188 --strictPort",
    url: "http://127.0.0.1:4188",
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_D1_API_URL: "", VITE_STORAGE_API_URL: "http://127.0.0.1:4188/__test-storage", VITE_STORAGE_UPLOAD_TOKEN: "local-test", VITE_SENTRY_DSN: "" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
