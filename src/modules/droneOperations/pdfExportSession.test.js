import { it, expect, vi } from "vitest";
import { createPdfExportSession, missionExportFilename } from "./pdfExportSession.js";

it("shares one image request within an export, including concurrent callers, but isolates later exports", async () => {
  const loader = vi.fn(async () => ({ dataUrl: "image", fetchedAt: "2026-10-30" }));
  const geometry = { type: "FeatureCollection", features: [] };
  const session = createPdfExportSession({}, loader);
  const [first, second] = await Promise.all([
    session.loadMapImagery(geometry),
    session.loadMapImagery(structuredClone(geometry)),
  ]);
  expect(first).toBe(second);
  expect(loader).toHaveBeenCalledTimes(1);
  await session.loadMapImagery({ features: ["different extent"] });
  expect(loader).toHaveBeenCalledTimes(2);
  await createPdfExportSession({}, loader).loadMapImagery(geometry);
  expect(loader).toHaveBeenCalledTimes(3);
});
it("keeps a failed image attempt consistent across the bundle and reports the warning once", async () => {
  const loader = vi.fn(async () => {
      throw Error("offline");
    }),
    progress = vi.fn();
  const session = createPdfExportSession({ onProgress: progress }, loader);
  const result = await session.loadMapImagery({ features: [] });
  expect(result.unavailable).toContain("schematic");
  await session.loadMapImagery({ features: [] });
  expect(loader).toHaveBeenCalledTimes(1);
  expect(session.warnings).toEqual([result.unavailable]);
  expect(progress).toHaveBeenCalledTimes(1);
});
it("uses a bounded readable mission and revision in download names", () => {
  expect(missionExportFilename({ title: "North depot", revision: 3 }, "draft-package.zip")).toBe(
    "North depot-R3-draft-package.zip"
  );
  expect(missionExportFilename({ title: "../../" }, "field.pdf")).toBe("Survey-R1-field.pdf");
  expect(missionExportFilename({ title: "A".repeat(200) }, "draft.pdf").length).toBeLessThan(90);
});
it("prevents a download after cancellation or leaving the workspace, including a late image response", async () => {
  let active = true,
    resolve;
  const loader = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const session = createPdfExportSession({ isActive: () => active }, loader);
  const request = session.loadMapImagery({ features: [] });
  await Promise.resolve();
  active = false;
  resolve({ dataUrl: "late image" });
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(() => session.assertActive()).toThrow(/cancelled/);
  expect(() => session.report("next document")).toThrow(/cancelled/);
  await expect(session.loadMapImagery({ features: ["new"] })).rejects.toMatchObject({ name: "AbortError" });
  expect(loader).toHaveBeenCalledTimes(1);
});
