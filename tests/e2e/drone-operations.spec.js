import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { MANUAL_SECTIONS } from "../../src/modules/droneOperations/droneLibrary.js";

test("field session records survive reload and keep landing locations and plan changes visible", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app?view=drone-operations");
  await page.getByRole("button", { name: "Create mission", exact: true }).click();
  await page.getByLabel("Mission name", { exact: true }).fill("Field coordination QA");
  await page.getByRole("combobox", { name: "Project", exact: true }).selectOption("p");
  await expect(page.getByRole("region", { name: "Suggested next step" })).toBeVisible();
  await page.getByLabel("Import survey boundary (KML, KMZ, GeoJSON)", { exact: true }).setInputFiles({
    name: "boundary.geojson",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-2.59, 51.45],
              [-2.58, 51.45],
              [-2.58, 51.46],
              [-2.59, 51.46],
              [-2.59, 51.45],
            ],
          ],
        },
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
  await page.getByLabel("Map drawing layer").selectOption("takeoff");
  await page.locator(".drone-map:visible").click({ position: { x: 130, y: 100 } });
  await page.getByRole("button", { name: "Use take-off point", exact: true }).click();
  await page.getByLabel("Map drawing layer").selectOption("alternateLanding");
  await page.locator(".drone-map:visible").click({ position: { x: 160, y: 130 } });
  await page.getByRole("tab", { name: "Field mode", exact: true }).click();
  await expect(page.locator(".field-controls small")).toHaveCSS("color", "rgb(199, 220, 230)");
  await expect(page.locator(".field-locations")).not.toContainText("Not recorded");
  await page.getByRole("button", { name: "Start site session", exact: true }).click();
  await expect(page.locator(".field-state")).toHaveText("Site session active");
  await page.getByRole("button", { name: "Pause site session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save session record", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Weather review", exact: true }).click();
  await page.getByRole("button", { name: "Save session record", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Field mode", exact: true }).click();
  await expect(page.locator(".field-state")).toHaveText("Site session paused");
  await expect(page.getByRole("region", { name: "Suggested next step" })).toContainText("Review the pause");
  await expect(page.locator(".field-timeline")).toContainText("Weather review");
  await page.getByRole("button", { name: "Edit mission map", exact: true }).click();
  await page.getByLabel("Mission name", { exact: true }).fill("Field coordination QA updated");
  await page.getByRole("tab", { name: "Field mode", exact: true }).click();
  await expect(page.getByText(/The plan changed after the last session record/)).toBeVisible();
  await page.getByRole("button", { name: "Resume site session", exact: true }).click();
  await page.getByLabel("Session note", { exact: true }).fill("Updated plan discussed with the team");
  await page.getByRole("button", { name: "Save session record", exact: true }).click();
  mkdirSync("output/drone-qa", { recursive: true });
  await page.locator(".field-workspace").screenshot({ path: `output/drone-qa/${info.project.name}-field-mode.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  await page.getByRole("button", { name: "Close site session", exact: true }).click();
  await page.getByLabel("Session note", { exact: true }).fill("Survey data handed over; equipment accounted for");
  await page.getByRole("button", { name: "Save session record", exact: true }).click();
  await expect(page.locator(".field-state")).toHaveText("Site session closed");
  await expect(page.locator(".field-timeline li")).toHaveCount(4);
  await expect(page.locator(".mission-closeout")).toContainText("Survey data handed over");
  await expect(page.getByRole("region", { name: "Suggested next step" })).toContainText("Finish the handover review");
  const closeoutButton = page.getByRole("button", { name: "Review close-out PDF", exact: true });
  await closeoutButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(closeoutButton).toBeFocused();
  await closeoutButton.click();
  await page.evaluate(async () => {
    const { saveOrgScoped } = await import("/src/utils/orgStorage.js");
    saveOrgScoped("mysafeops_projects", [
      { id: "p", name: "Updated linked project", client: "QA Client", siteAddress: "Test site, Bristol" },
    ]);
  });
  await page.getByRole("button", { name: "Export this draft", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("This review has been refreshed");
  await expect(page.getByRole("heading", { name: "Review your draft export", exact: true })).toBeInViewport();
  await page.getByRole("dialog").screenshot({ path: `output/drone-qa/${info.project.name}-export-review.png` });
  const closeoutDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this draft", exact: true }).click();
  await (await closeoutDownload).saveAs(`output/drone-qa/${info.project.name}-closeout.pdf`);
  await page.locator(".mission-closeout").screenshot({ path: `output/drone-qa/${info.project.name}-closeout.png` });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download field card", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Review your draft export");
  await page.getByRole("button", { name: "Export this draft", exact: true }).click();
  await (await download).saveAs(`output/drone-qa/${info.project.name}-field-session.pdf`);
  expect(errors).toEqual([]);
});

test("manual review locks a version and organisation library feeds mission choices", async ({ page }, info) => {
  await page.goto("/app?view=drone-operations");
  await page.getByRole("tab", { name: "Operations Manuals", exact: true }).click();
  await page.getByRole("button", { name: "New manual", exact: true }).click();
  await page.getByRole("button", { name: "Record responsible person review", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Complete the scope");
  await page.getByLabel("Company legal name", { exact: true }).fill("Example survey QA");
  await page.getByLabel("Document code", { exact: true }).fill("OM-QA-001");
  await page.getByLabel("Next review date", { exact: true }).fill("2027-10-29");
  await page.getByLabel("Operating scope and pathway", { exact: true }).fill("Synthetic QA scope. No operational use.");
  for (const section of MANUAL_SECTIONS) {
    await page.locator("summary").filter({ hasText: section.title }).click();
    const field = page.getByRole("textbox", { name: section.prompt, exact: true });
    await field.fill("Synthetic procedure for QA only: " + section.title);
    await expect(field).toBeVisible();
    await page.locator(`#manual-${section.id}`).getByRole("checkbox").check();
  }
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "drone_manuals_default") {
        Storage.prototype.setItem = original;
        throw new DOMException("QA failed review save", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Record responsible person review", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Operating scope and pathway", exact: true })).toBeEnabled();
  await expect(page.locator(".manual-save-bar")).toContainText("Unsaved changes");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("drone_manuals_default"))[0].approvedAt)
  ).toBeUndefined();
  await page.getByRole("button", { name: "Save company manual", exact: true }).click();
  await page.getByRole("button", { name: "Record responsible person review", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Operating scope and pathway", exact: true })).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download manual PDF", exact: true }).click();
  mkdirSync("output/drone-qa", { recursive: true });
  await (await download).saveAs(`output/drone-qa/${info.project.name}-manual.pdf`);
  await page.getByRole("button", { name: "Create revision", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Operating scope and pathway", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Version", { exact: true })).toHaveValue("0.1 revised");
  const manuals = await page.evaluate(() => JSON.parse(localStorage.getItem("drone_manuals_default")));
  expect(manuals).toHaveLength(2);
  expect(manuals.filter((m) => m.approvedAt)).toHaveLength(1);
  await page.getByRole("tab", { name: "Equipment & templates", exact: true }).click();
  await page.getByText("Add reviewed library version", { exact: true }).click();
  await page.getByRole("combobox", { name: "Entry type", exact: true }).selectOption("template");
  await page.getByLabel("Name", { exact: true }).fill("QA organisation survey");
  await page
    .getByLabel("Official or organisation source URL", { exact: true })
    .fill("https://example.com/qa-procedure");
  await page
    .getByLabel("Reviewed requirements, limitations or procedure", { exact: true })
    .fill("Synthetic QA procedure only.");
  await page.getByLabel("rgb", { exact: true }).check();
  await page.getByRole("button", { name: "Save reviewed version", exact: true }).click();
  await page.getByRole("button", { name: "New mission", exact: true }).click();
  const template = page.getByRole("combobox", { name: "Survey type", exact: true });
  await template.selectOption({ label: "QA organisation survey" });
  await page.getByRole("tab", { name: "Briefing & checklist", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Agreed deliverables", exact: true })).toHaveValue(
    "QA organisation survey"
  );
  await page.getByRole("tab", { name: "Aircraft & crew", exact: true }).click();
  await page.getByRole("combobox", { name: "Aircraft from Plant", exact: true }).selectOption("a");
  await page.getByRole("combobox", { name: "Manufacturer model", exact: true }).selectOption("mavic-3e");
  await page.getByRole("combobox", { name: "Compatible payload", exact: true }).selectOption("integrated-3e");
  await page.getByRole("button", { name: "Save configuration", exact: true }).click();
  await page.getByRole("tab", { name: "Equipment & templates", exact: true }).click();
  await page.getByRole("button", { name: "Add favourite", exact: true }).click();
  await page.getByRole("button", { name: "Use as organisation default", exact: true }).click();
  await page.getByRole("checkbox", { name: "Compare DJI Mavic 3 Enterprise (3E)", exact: true }).check();
  await page.getByRole("checkbox", { name: "Compare DJI Mavic 3 Thermal (3T)", exact: true }).check();
  await expect(page.getByRole("heading", { name: "Compare equipment", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New mission", exact: true }).click();
  await page.getByRole("tab", { name: "Aircraft & crew", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Aircraft from Plant", exact: true })).toHaveValue("a");
  await expect(page.getByRole("combobox", { name: "Compatible payload", exact: true })).toHaveValue("integrated-3e");
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("drone-test-seeded")) return;
    localStorage.clear();
    localStorage.setItem(
      "mysafeops_org_settings_default",
      JSON.stringify({
        onboardingWizardCompleted: true,
        name: "Drone QA Organisation",
        hiddenModules: [],
        hiddenModulesBootstrapped: true,
        marketId: "uk",
        marketModulePackApplied: "uk",
      })
    );
    localStorage.setItem(
      "mysafeops_projects_default",
      JSON.stringify([
        { id: "p", name: "Bristol test survey", client: "QA Client", postcode: "", siteAddress: "Test site, Bristol" },
      ])
    );
    localStorage.setItem("mysafeops_workers_default", JSON.stringify([{ id: "w", name: "Test remote pilot" }]));
    localStorage.setItem(
      "plant_register_default",
      JSON.stringify([
        { id: "a", assetRef: "UAS-001", description: "Test Mavic 3E", result: "pass", nextDue: "2030-12-31" },
      ])
    );
    localStorage.setItem(
      "rams_builder_docs_default",
      JSON.stringify([
        {
          id: "r",
          title: "UAV survey RAMS",
          hazards: [
            {
              activity: "UAV flight",
              hazard: "Uninvolved people",
              controls: "Pilot-controlled exclusion and site briefing",
            },
          ],
        },
      ])
    );
    sessionStorage.setItem("drone-test-seeded", "1");
  });
});

test("boundary to reviewed snapshot and PDF, copy reset and organisation isolation", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync("output/drone-qa", { recursive: true });
  await page.goto("/app?view=drone-operations");
  await expect(page.getByRole("heading", { name: "Drone Operations", exact: true, level: 2 })).toBeVisible({
    timeout: 45000,
  });
  const dismiss = page.getByRole("button", { name: "Skip setup for now", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.getByRole("button", { name: "Create mission", exact: true }).click();
  await expect(page.getByLabel("Mission name", { exact: true })).toBeVisible();
  await page.getByLabel("Mission name", { exact: true }).fill("Bristol drone test");
  await page.getByRole("combobox", { name: "Project", exact: true }).selectOption("p");
  const dates = await page.evaluate(() => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    const date = start.toISOString().slice(0, 10);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { date, validUntil: end.toISOString().slice(0, 10) + "T23:00" };
  });
  await page.getByLabel("Start (Europe/London)", { exact: true }).fill(`${dates.date}T10:00`);
  await page.getByLabel("End (Europe/London)", { exact: true }).fill(`${dates.date}T11:00`);
  await page.getByRole("combobox", { name: "Survey type", exact: true }).selectOption("ortho");
  await page.getByLabel("Import survey boundary (KML, KMZ, GeoJSON)", { exact: true }).setInputFiles({
    name: "boundary.kml",
    mimeType: "application/xml",
    buffer: Buffer.from(
      "<kml><Placemark><name>Bristol boundary</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-2.59,51.45 -2.589,51.45 -2.589,51.451 -2.59,51.451 -2.59,51.45</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>"
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
  const map = page.locator(".drone-map");
  const box = await map.boundingBox();
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
  await page.screenshot({ path: `output/drone-qa/${info.project.name}-map.png`, fullPage: true });
  await page.getByRole("tab", { name: "Aircraft & crew", exact: true }).click();
  await page.getByRole("combobox", { name: "Aircraft from Plant", exact: true }).selectOption("a");
  await page.getByRole("combobox", { name: "Manufacturer model", exact: true }).selectOption("mavic-3e");
  await page.getByRole("combobox", { name: "Compatible payload", exact: true }).selectOption("integrated-3e");
  await page.getByRole("combobox", { name: "Remote pilot from People", exact: true }).selectOption("w");
  await page.getByLabel("Operator ID (do not enter Remote ID private key)", { exact: true }).fill("TEST-OPERATOR");
  await page.getByLabel("Actual take-off mass with payload (kg)", { exact: true }).fill("1");
  await page
    .getByRole("combobox", { name: "Verified aircraft class / legacy status", exact: true })
    .selectOption("Legacy");
  await page.getByRole("combobox", { name: "Operating pathway", exact: true }).selectOption("Open A3");
  await page.getByLabel("Planned maximum height (m)", { exact: true }).fill("40");
  await page.getByRole("tab", { name: "Briefing & checklist", exact: true }).click();
  await page
    .getByLabel("Emergency procedures and confirmed site contacts", { exact: true })
    .fill(
      "Test only: stop operation on incursion; pilot landing procedure and site emergency contact verified in local test evidence."
    );
  await page.getByRole("combobox", { name: "Linked RAMS", exact: true }).selectOption("r");
  const checks = page.locator(".drone-check input[type=checkbox]");
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await page.getByRole("tab", { name: "Weather & checks", exact: true }).click();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
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
    await page
      .getByLabel("Source / briefing reference", { exact: true })
      .fill(`QA fixture ${kind} — not operational evidence`);
    await page.getByLabel("Valid until (UTC)", { exact: true }).fill(dates.validUntil);
    await page
      .getByLabel("Findings, coverage, conditions, contacts and required actions", { exact: true })
      .fill(
        "Synthetic test evidence covering the complete area, height and operating window. Do not use for real flight."
      );
    await page.getByRole("button", { name: "Save check evidence", exact: true }).click();
  }
  await page.getByRole("tab", { name: "Review & PDF", exact: true }).click();
  await expect(
    page.getByText("0 unresolved action(s). 0 immutable issued snapshot(s).", { exact: true })
  ).toBeVisible();
  await page
    .getByLabel("I am the responsible person and have checked current conditions on site.", { exact: true })
    .check();
  await page.getByRole("button", { name: "Approve and issue snapshot", exact: true }).click();
  await expect(page.getByText("Approved by responsible person", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download issued PDF", exact: true }).click();
  await (await download).saveAs(`output/drone-qa/${info.project.name}-approved.pdf`);
  await page.screenshot({ path: `output/drone-qa/${info.project.name}-review.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mission details", exact: true })).toBeVisible();
  await expect(page.getByLabel("Mission name", { exact: true })).toHaveValue("Bristol drone test");
  await page.getByRole("button", { name: "← All missions", exact: true }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByLabel("Start (Europe/London)", { exact: true })).toHaveValue("");
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem("drone_missions_default")));
  expect(data.find((m) => m.title.endsWith("(copy)")).issues).toEqual([]);
  expect(data.find((m) => m.title === "Bristol drone test").issues).toHaveLength(1);
  await page.evaluate(async () => {
    const { setOrgId } = await import("/src/utils/orgId.js");
    setOrgId("other-org");
  });
  await expect(page.getByRole("heading", { name: "Prepare your first drone survey" })).toBeVisible();
  expect(errors).toEqual([]);
});
