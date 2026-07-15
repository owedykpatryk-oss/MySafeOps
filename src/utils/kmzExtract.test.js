/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractKmlFromKmzBuffer, readKmlTextFromFile } from "./kmzExtract.js";

const FIXTURE_KMZ = join(process.cwd(), "fixtures", "test-job.kmz");

describe("kmzExtract", () => {
  it("extracts KML XML from fixtures/test-job.kmz", () => {
    const buf = readFileSync(FIXTURE_KMZ);
    const extracted = extractKmlFromKmzBuffer(buf);
    expect(extracted?.entryName).toMatch(/doc\.kml$/i);
    expect(extracted?.kmlText).toContain("<Polygon>");
    expect(extracted?.kmlText).toMatch(/Test job/i);
    expect(extracted?.kmlText).toContain("<coordinates>");
  });

  it("readKmlTextFromFile detects KMZ by ZIP magic even without .kmz name", async () => {
    const buf = readFileSync(FIXTURE_KMZ);
    const file = {
      name: "boundary.bin",
      type: "application/octet-stream",
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
    const text = await readKmlTextFromFile(file);
    expect(text).toContain("<Polygon>");
    expect(text).toMatch(/Test job/i);
  });

  it("returns null for non-zip buffer", () => {
    expect(extractKmlFromKmzBuffer(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
