import { chromium } from "@playwright/test";

// Vite's HTTP readiness only proves that HTML is served. Compile the actual
// workspace once before timing individual save/recovery scenarios on cold CI.
export default async function prepareOperationalWorkspace() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({
        name: "Operational setup", onboardingWizardCompleted: true,
      }));
    });
    await page.goto("http://127.0.0.1:4188/app?view=rams", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator(".app-rams-list-toolbar").waitFor({ state: "visible", timeout: 120000 });
  } finally {
    await browser.close();
  }
}
