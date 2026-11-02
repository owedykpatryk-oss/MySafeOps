import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["project-validation.spec.js", "workspace-navigation.spec.js"],
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4196", trace: "retain-on-failure" },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4196 --strictPort",
    url: "http://127.0.0.1:4196",
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_D1_API_URL: "", VITE_STORAGE_API_URL: "", VITE_SENTRY_DSN: "", VITE_TURNSTILE_SITE_KEY: "" },
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
});
