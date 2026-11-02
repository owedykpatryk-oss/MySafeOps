import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { manualSections } from "../../src/modules/droneOperations/droneRegions.js";

test("AU manuals carry explicit applicability and drone fields use CASA terminology", async ({ page }, info) => {
  await page.goto("/app?view=drone-operations&market=au");
  await page.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  await page.getByRole("button", { name: "New manual", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Document applicability", exact: true })).toHaveValue("helicopter");
  await page.getByLabel("Company legal name", { exact: true }).fill("Example AU survey QA");
  await page.getByLabel("Document code", { exact: true }).fill("AU-OM-QA-001");
  await page.getByLabel("Next review date", { exact: true }).fill("2027-10-29");
  await page
    .getByRole("textbox", { name: "Operating scope and pathway", exact: true })
    .fill("QA helicopter survey coordination only.");
  for (const section of manualSections({ regionCode: "au", aircraftKind: "helicopter" })) {
    await page.locator("summary").filter({ hasText: section.title }).click();
    await page.getByRole("textbox", { name: section.prompt, exact: true }).fill(`QA procedure: ${section.title}`);
    await page.locator(`#manual-${section.id}`).getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Record responsible person review", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Document applicability", exact: true })).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download manual PDF", exact: true }).click();
  mkdirSync("output/drone-qa", { recursive: true });
  await (await download).saveAs(`output/drone-qa/${info.project.name}-au-manual.pdf`);
  await page.getByRole("button", { name: "New mission", exact: true }).click();
  await page.getByRole("combobox", { name: "Aircraft type", exact: true }).selectOption("drone");
  await page.getByRole("tab", { name: "Aircraft & crew", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Verified aircraft class / legacy status", exact: true })
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Operating pathway", exact: true })
    .selectOption({ label: "CASA excluded category — reviewed" });
  await expect(
    page.getByRole("textbox", { name: "Operator ARN and aircraft registration references", exact: true })
  ).toBeVisible();
  await page.getByRole("tab", { name: "Briefing & checklist", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Reviewed Operations Manual version", exact: true }).locator("option")
  ).toHaveCount(1);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("au-aerial-seeded")) return;
    localStorage.clear();
    localStorage.setItem("mysafeops_market", "au");
    localStorage.setItem(
      "mysafeops_org_settings_default",
      JSON.stringify({
        market: "au",
        name: "Australian Survey QA",
        onboardingWizardCompleted: true,
        hiddenModules: [],
        hiddenModulesBootstrapped: true,
        marketModulePackApplied: "au",
      })
    );
    localStorage.setItem(
      "mysafeops_projects_default",
      JSON.stringify([{ id: "p", name: "Perth aerial survey", client: "QA Client", siteAddress: "Perth QA site" }])
    );
    localStorage.setItem("mysafeops_workers_default", JSON.stringify([{ id: "w", name: "Survey coordinator" }]));
    localStorage.setItem(
      "rams_builder_docs_default",
      JSON.stringify([
        {
          id: "r",
          title: "Helicopter survey team risk plan",
          hazards: [{ hazard: "Rotor and downwash", controls: "Operator briefing and controlled access" }],
        },
      ])
    );
    sessionStorage.setItem("au-aerial-seeded", "1");
  });
});
test("AU contracted helicopter coordination, regional evidence, PDF and copy reset", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app?view=drone-operations&market=au");
  await expect(page.getByRole("heading", { name: "Aerial Survey Operations", level: 2, exact: true })).toBeVisible({
    timeout: 45000,
  });
  await page.getByRole("button", { name: "Create mission", exact: true }).click();
  await page.getByRole("textbox", { name: "Mission name", exact: true }).fill("Perth helicopter QA");
  await page.getByRole("combobox", { name: "Project", exact: true }).selectOption("p");
  await page.getByRole("combobox", { name: "Operation time zone", exact: true }).selectOption("Australia/Perth");
  const dates = await page.evaluate(() => {
    const d = new Date(Date.now() + 86400000);
    return {
      day: d.toISOString().slice(0, 10),
      until: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + "T23:00",
    };
  });
  await page.getByLabel("Start (operation local time)", { exact: true }).fill(`${dates.day}T10:00`);
  await page.getByLabel("End (operation local time)", { exact: true }).fill(`${dates.day}T11:00`);
  await page.getByRole("combobox", { name: "Survey type", exact: true }).selectOption("ortho");
  await page.getByLabel("Import survey boundary (KML, KMZ, GeoJSON)", { exact: true }).setInputFiles({
    name: "Perth.geojson",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [115.8, -31.9],
            [115.81, -31.9],
            [115.81, -31.89],
            [115.8, -31.89],
            [115.8, -31.9],
          ],
        ],
      })
    ),
  });
  const importDialog = page.getByRole("dialog", { name: "Review map import", exact: true });
  await expect(importDialog).toBeVisible();
  const replacement = importDialog.getByRole("checkbox", { name: /Replace the existing/ });
  if (await replacement.isVisible()) await replacement.check();
  await importDialog.getByRole("button", { name: "Import selected features", exact: true }).click();
  await expect(importDialog).toHaveCount(0);
  await expect(page.getByText(/1 polygon\(s\)/)).toBeVisible();
  await page.getByLabel("Map drawing layer").selectOption("flightArea");
  const map = page.locator(".drone-map"),
    box = await map.boundingBox();
  for (const [x, y] of [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.7, 0.7],
    [0.3, 0.7],
  ])
    await map.click({ position: { x: box.width * x, y: box.height * y } });
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await page.getByLabel("Map drawing layer").selectOption("takeoff");
  await map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await page.getByRole("tab", { name: "Aircraft & crew", exact: true }).click();
  await page.getByRole("combobox", { name: "Aviation service", exact: true }).selectOption("contracted");
  await page.getByRole("combobox", { name: "Survey lead from People", exact: true }).selectOption("w");
  for (const label of [
    "Aviation operator",
    "AWC number and verified scope reference",
    "Pilot in command",
    "Aircraft registration",
    "Helicopter type",
    "Survey sensor and approved installation",
    "Task specialists and duties",
    "Operator manual and applicable procedures",
    "Operator loading, fuel and maintenance confirmation",
    "Landing and ground access plan",
    "Communications and stop-work arrangements",
    "Remote-area assistance and overdue response",
  ])
    await page.getByRole("textbox", { name: label, exact: true }).fill(`Synthetic QA only: ${label}`);
  await page
    .getByRole("combobox", { name: "Operating pathway", exact: true })
    .selectOption({ label: "CASA Part 138 aerial work — scope verified" });
  await page.getByLabel("Planned maximum height (m)", { exact: true }).fill("150");
  await page.getByRole("tab", { name: "Briefing & checklist", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Emergency procedures and confirmed site contacts", exact: true })
    .fill("Synthetic QA emergency and site contacts only.");
  await page.getByRole("combobox", { name: "Linked RAMS", exact: true }).selectOption("r");
  const checks = page.locator(".drone-check input[type=checkbox]");
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await page.getByRole("tab", { name: "Weather & checks", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Airservices Australia NAIPS briefing service", exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Surface forecast for site preparation only/)).toBeVisible();
  await expect(page.getByRole("link", { name: /CAA/ })).toHaveCount(0);
  for (const kind of [
    "airspace",
    "weather",
    "pathway",
    "competence",
    "insurance",
    "permission",
    "equipment",
    "rams",
    "manual",
  ]) {
    await page.getByRole("combobox", { name: "Check type", exact: true }).selectOption(kind);
    await page.getByLabel("Source / briefing reference", { exact: true }).fill(`Synthetic ${kind} evidence`);
    await page.getByLabel("Valid until (UTC)", { exact: true }).fill(dates.until);
    await page
      .getByRole("textbox", { name: "Findings, coverage, conditions, contacts and required actions", exact: true })
      .fill("QA only. Not valid for operational flight.");
    await page.getByRole("button", { name: "Save check evidence", exact: true }).click();
  }
  await page.getByRole("tab", { name: "Review & PDF", exact: true }).click();
  const issue = page.getByRole("button", { name: "Review coordination and issue snapshot", exact: true });
  await page
    .getByLabel("I am the responsible person and have checked current conditions on site.", { exact: true })
    .check();
  await expect(issue).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Operator / pilot who made the decision", exact: true })
    .fill("QA operator pilot");
  await page.getByRole("textbox", { name: "Operator decision reference", exact: true }).fill("QA release reference");
  await page.getByLabel("Decision valid until (UTC)", { exact: true }).fill(dates.until);
  await page
    .getByRole("textbox", { name: "Operator conditions and limitations", exact: true })
    .fill("Synthetic QA release only. No operational flight.");
  await page.getByRole("button", { name: "Record operator decision", exact: true }).click();
  await expect(
    page.getByText("0 unresolved action(s). 0 immutable issued snapshot(s).", { exact: true })
  ).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "drone_missions_default") {
        Storage.prototype.setItem = original;
        throw new DOMException("QA storage full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await issue.click();
  await expect(page.getByText("Approved snapshot saved. Download it from Issued packs.", { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByText(/Save failed\. Check storage space/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("drone_missions_default"))[0].approval)).toBeNull();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page
    .getByLabel("I am the responsible person and have checked current conditions on site.", { exact: true })
    .check();
  await issue.click();
  await expect(page.getByText("Survey coordination reviewed", { exact: true })).toBeVisible();
  mkdirSync("output/drone-qa", { recursive: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download issued PDF", exact: true }).click();
  await (await download).saveAs(`output/drone-qa/${info.project.name}-au-helicopter.pdf`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("drone_missions_default")));
  writeFileSync(`output/drone-qa/${info.project.name}-au-issue.json`, JSON.stringify(saved[0].issues[0], null, 2));
  await page.screenshot({ path: `output/drone-qa/${info.project.name}-au-review.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "← All missions", exact: true }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  const copied = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("drone_missions_default")).find((m) => m.title.endsWith("(copy)"))
  );
  expect(copied.operatorRelease).toBeNull();
  expect(copied.issues).toEqual([]);
  expect(copied.timeZone).toBe("Australia/Perth");
  expect(errors).toEqual([]);
});
