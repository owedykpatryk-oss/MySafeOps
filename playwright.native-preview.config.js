import { defineConfig, devices } from "@playwright/test";

// Built bundle with a simulated bridge. This is not a physical-device test.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "native-preview.spec.js",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4189", trace: "retain-on-failure" },
  webServer: {
    command: "npx vite preview --outDir dist-native --host 127.0.0.1 --port 4189 --strictPort",
    url: "http://127.0.0.1:4189", reuseExistingServer: false,
  },
  projects: [
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
