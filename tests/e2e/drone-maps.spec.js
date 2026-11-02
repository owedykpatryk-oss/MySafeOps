import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { mkdirSync, readFileSync } from "node:fs";
const kml =
  "<kml><Document><Placemark><name>Perth boundary</name><Polygon><outerBoundaryIs><LinearRing><coordinates>115.85,-31.95,20 115.86,-31.95,20 115.86,-31.94,20 115.85,-31.94,20 115.85,-31.95,20</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>115.853,-31.947,20 115.855,-31.947,20 115.855,-31.945,20 115.853,-31.945,20 115.853,-31.947,20</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark><Placemark><name>Landing pad</name><Point><coordinates>115.851,-31.949,25</coordinates></Point></Placemark></Document></kml>";
const file = {
  name: "perth.kmz",
  mimeType: "application/vnd.google-earth.kmz",
  buffer: Buffer.from(zipSync({ "doc.kml": strToU8(kml) })),
};
const upload = (page) =>
  page.getByLabel("Import survey boundary (KML, KMZ, GeoJSON)", { exact: true }).setInputFiles(file);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("drone_missions_default"))[0]);
test.beforeEach(async ({ page }) => {
  await page.goto("/app?view=drone-operations");
  const skip = page.getByRole("button", { name: "Skip setup for now", exact: true });
  await expect(page.getByRole("button", { name: "Create mission", exact: true })).toBeVisible({ timeout: 30000 });
  if (await skip.isVisible()) await skip.click();
});
test("map tools preview selected KMZ features, preserve data, switch imagery and export geometry", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app?view=drone-operations");
  await page.getByRole("button", { name: "Create mission", exact: true }).click();
  await page.getByLabel("Mission name", { exact: true }).fill("Map tools QA");
  const baseline = await stored(page);
  await upload(page);
  const dialog = page.getByRole("dialog", { name: "Review map import" });
  await expect(dialog).toBeVisible();
  expect((await stored(page)).boundary).toEqual(baseline.boundary);
  await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
  expect((await stored(page)).editToken).toEqual(baseline.editToken);
  await upload(page);
  await dialog.getByLabel("Include Landing pad", { exact: true }).uncheck();
  await expect(dialog.getByRole("button", { name: "Import selected features", exact: true })).toBeEnabled();
  mkdirSync("output/drone-qa", { recursive: true });
  await dialog.screenshot({ path: `output/drone-qa/${info.project.name}-map-import.png` });
  await dialog.getByRole("button", { name: "Import selected features", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const first = await stored(page);
  expect(first.boundary.features[0].geometry.coordinates).toHaveLength(2);
  expect(first.flightArea).toBeNull();
  await upload(page);
  await dialog.getByLabel("Include Perth boundary", { exact: true }).uncheck();
  await dialog.getByLabel("Import into", { exact: true }).selectOption("landing");
  await dialog.getByRole("button", { name: "Import selected features", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await stored(page)).landing).toEqual([115.851, -31.949]);
  const token = (await stored(page)).editToken;
  await page.getByRole("button", { name: "Satellite", exact: true }).click();
  await expect(page.locator('.drone-map img[src*="World_Imagery"]')).not.toHaveCount(0);
  await page.getByRole("button", { name: "Hybrid", exact: true }).click();
  await expect(page.locator('.drone-map img[src*="World_Boundaries_and_Places"]')).not.toHaveCount(0);
  await page.getByLabel("Show Survey boundary", { exact: true }).uncheck();
  await page.getByLabel("Show Survey boundary", { exact: true }).check();
  await page.getByRole("button", { name: "Fit to areas", exact: true }).click();
  await page.getByText("Map tools", { exact: true }).click();
  await page.getByLabel("Go to latitude, longitude", { exact: true }).fill("-31.95, 115.86");
  await page.getByRole("button", { name: "Go to coordinates", exact: true }).click();
  for (const format of ["KML", "GeoJSON"]) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: `Download ${format}`, exact: true }).click();
    const path = `output/drone-qa/${info.project.name}-boundary.${format.toLowerCase()}`;
    await (await downloaded).saveAs(path);
    const content = readFileSync(path, "utf8");
    expect(content).toContain("115.85");
    if (format === "KML") expect(content).toContain("innerBoundaryIs");
    else expect(JSON.parse(content).features[0].geometry.coordinates).toHaveLength(2);
  }
  expect((await stored(page)).editToken).toBe(token);
  await page.getByText("Map tools", { exact: true }).click();
  await page.getByRole("button", { name: "Fit to areas", exact: true }).click();
  await page.locator(".drone-map-panel").screenshot({ path: `output/drone-qa/${info.project.name}-satellite-map.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.reload();
  expect((await stored(page)).boundary).toEqual(first.boundary);
  expect((await stored(page)).landing).toEqual([115.851, -31.949]);
  expect(errors).toEqual([]);
});

test("invalid import and failed satellite tiles preserve the saved plan", async ({ page }) => {
  await page.goto("/app?view=drone-operations");
  await page.getByRole("button", { name: "Create mission", exact: true }).click();
  const baseline = await stored(page);
  await page.getByLabel("Import survey boundary (KML, KMZ, GeoJSON)", { exact: true }).setInputFiles({
    name: "invalid.kml",
    mimeType: "application/xml",
    buffer: Buffer.from("<kml><NetworkLink/></kml>"),
  });
  await expect(page.getByRole("alert")).toContainText("NetworkLinks");
  expect((await stored(page)).editToken).toBe(baseline.editToken);
  await page.route("**/World_Imagery/MapServer/tile/**", (r) => r.abort());
  await page.getByRole("button", { name: "Satellite", exact: true }).click();
  await expect(page.getByText(/Some map tiles could not load/)).toBeVisible();
  await page.getByRole("button", { name: "Streets", exact: true }).click();
  expect((await stored(page)).editToken).toBe(baseline.editToken);
});

test("stale previews, replacement and failed saves cannot silently replace geometry", async ({ page }) => {
  await page.getByRole("button", { name: "Create mission", exact: true }).click();
  await upload(page);
  const dialog = page.getByRole("dialog", { name: "Review map import" });
  await dialog.getByLabel("Include Landing pad", { exact: true }).uncheck();
  // Simulate a background update while the native modal prevents normal editing.
  await page.getByLabel("Mission name", { exact: true }).evaluate((input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Changed while previewing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(dialog).toContainText("The mission changed while this preview was open");
  await expect(dialog.getByRole("button", { name: "Import selected features", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel import", exact: true }).click();
  await upload(page);
  await dialog.getByLabel("Include Landing pad", { exact: true }).uncheck();
  const before = await stored(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "drone_missions_default") {
        Storage.prototype.setItem = original;
        throw new DOMException("QA full storage", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await dialog.getByRole("button", { name: "Import selected features", exact: true }).click();
  await expect(dialog).toContainText("The import was not saved");
  expect((await stored(page)).boundary).toEqual(before.boundary);
  await dialog.getByRole("button", { name: "Import selected features", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const imported = await stored(page);
  await upload(page);
  await dialog.getByLabel("Include Landing pad", { exact: true }).uncheck();
  await expect(dialog.getByRole("button", { name: "Import selected features", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Replace the existing/ }).check();
  await expect(dialog.getByRole("button", { name: "Import selected features", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  expect((await stored(page)).editToken).toEqual(imported.editToken);
});

for (const destination of ["boundary", "landing"]) {
  test(`failed ${destination} drawing saves retain the selection for retry`, async ({ page }) => {
    await page.getByRole("button", { name: "Create mission", exact: true }).click();
    const mode = page.getByLabel("Map drawing layer", { exact: true });
    await mode.selectOption(destination);
    const map = page.locator(".drone-map");
    const box = await map.boundingBox();
    if (destination === "boundary") {
      for (const [x, y] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.5, 0.7],
      ])
        await map.click({ position: { x: box.width * x, y: box.height * y } });
    }
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "drone_missions_default") {
          Storage.prototype.setItem = original;
          throw new DOMException("QA failed map save", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
    });
    const save = async () =>
      destination === "boundary"
        ? page.getByRole("button", { name: "Save area", exact: true }).click()
        : map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await save();
    await expect(mode).toHaveValue(destination);
    await expect(page.locator(".drone-map-panel")).toContainText("Map change was not saved");
    expect((await stored(page))[destination]).toBeNull();
    await save();
    await expect(mode).toHaveValue("");
    expect((await stored(page))[destination]).not.toBeNull();
  });
}
