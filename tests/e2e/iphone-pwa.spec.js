import { test, expect } from "@playwright/test";
import { preview } from "vite";

test.skip(({ baseURL }) => !baseURL?.endsWith(":4189"), "Requires the isolated production PWA bundle");

let server;
const startServer = async () => { server = await preview({ configFile: false, build: { outDir: "output/pwa-iphone-build" }, preview: { host: "127.0.0.1", port: 4189, strictPort: true } }); };
const stopServer = async () => {
  if (!server) return;
  const current = server;
  server = null;
  await new Promise(resolve => { current.httpServer.close(resolve); current.httpServer.closeAllConnections(); });
};
test.beforeAll(async ({ baseURL }) => { if (baseURL?.endsWith(":4189")) await startServer(); });
test.afterAll(stopServer);

test("iPhone Home Screen photo evidence survives an offline reload with the real PWA worker", async ({ page, baseURL }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    if (sessionStorage.getItem("pwa-qa-offline")) Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_ok, fail) => fail({ code: 1, message: "Permission denied" }) } });
    if (sessionStorage.getItem("pwa-qa-seeded")) return;
    localStorage.setItem("mysafeops_org_settings_default", JSON.stringify({ name: "PWA test", onboardingWizardCompleted: true, hiddenModulesBootstrapped: true, marketModulePackApplied: "uk", hiddenModules: [] }));
    localStorage.setItem("mysafeops_projects_default", JSON.stringify([{ id: "pwa-site", name: "PWA site" }]));
    sessionStorage.setItem("pwa-qa-seeded", "1");
  });
  await page.goto("/app?view=geo-photos");
  await expect(page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 90000 });
  expect(await page.evaluate(() => navigator.standalone)).toBe(true);
  // WebKit's setOffline breaks even cached SW/blob responses (Playwright #42775).
  // Stop the actual origin instead, proving the worker can serve without a server.
  await stopServer();
  await expect(fetch(baseURL + "/api/health", { signal: AbortSignal.timeout(3000) })).rejects.toThrow();
  await page.evaluate(() => {
    sessionStorage.setItem("pwa-qa-offline", "1");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
  });
  await page.getByRole("button", { name: /^(?:\+ )?Add geo-photo$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add geo-photo" });
  await dialog.locator('input[type="file"]:not([capture])').setInputFiles({ name: "offline-photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6mAAAAABJRU5ErkJggg==", "base64") });
  await dialog.getByRole("button", { name: "Continue without GPS", exact: true }).click();
  await dialog.getByRole("combobox").first().selectOption("pwa-site");
  await dialog.locator("textarea").first().fill("Offline PWA evidence");
  await dialog.getByRole("button", { name: "Save geo-photo", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Offline PWA evidence", { exact: true }).first()).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("geo_photos_default"))[0].photoDataUrl.startsWith("data:image/jpeg"))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("iphone-pwa-offline-photo.png"), fullPage: true });
  await startServer();
  await page.evaluate(() => sessionStorage.removeItem("pwa-qa-offline"));
  await page.reload();
  await expect(page.getByText("Offline PWA evidence", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
