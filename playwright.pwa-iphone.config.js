import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "iphone-pwa.spec.js",
  workers: 1,
  timeout: 120000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4189", trace: "retain-on-failure" },
  projects: [{ name: "iphone-pwa", use: { ...devices["iPhone 13"] } }],
});
