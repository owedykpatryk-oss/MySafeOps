import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /drone-(operations|australia|documents|maps|manuals)\.spec\.js/,
  workers: 1,
  timeout: 120000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4192", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
