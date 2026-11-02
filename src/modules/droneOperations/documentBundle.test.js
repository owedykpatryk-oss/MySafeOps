import { it, expect } from "vitest";
import { unzipSync, strFromU8, strToU8 } from "fflate";
import { assembleDocumentBundle } from "./documentBundle.js";
const names = [
  "01-full-draft.pdf",
  "02-task-plan-draft.pdf",
  "03-crew-briefing-draft.pdf",
  "04-evidence-register-draft.pdf",
  "05-field-card-draft.pdf",
  "06-operator-review-draft.pdf",
  "07-close-out-draft.pdf",
];
it("packages all seven documents with accurate hashes and one draft revision", async () => {
  const issue = {
    kind: "draft",
    issuedAt: "2026-10-29T10:00:00Z",
    snapshot: { id: "m", title: "Survey", revision: 4, nextActions: [{ text: "Check evidence" }] },
  };
  const documents = names.map((name) => ({ name, bytes: strToU8(`PDF ${name}`) }));
  const result = await assembleDocumentBundle(issue, documents);
  const files = unzipSync(result.bytes),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(Object.keys(files)).toHaveLength(10);
  expect(strFromU8(files["09-airspace-briefing-request.txt"])).toContain("not connected");
  expect(strFromU8(files["README.txt"])).toContain("No KML is included");
  expect(manifest).toMatchObject({
    status: "draft",
    revision: 4,
    missionId: "m",
    outstandingActions: ["Check evidence"],
  });
  for (const f of manifest.files) {
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", files[f.name]))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(f.sha256).toBe(hash);
    expect(f.bytes).toBe(files[f.name].length);
  }
  await expect(assembleDocumentBundle({ ...issue, kind: "approved" }, documents)).rejects.toThrow(/draft/i);
  await expect(
    assembleDocumentBundle(issue, [{ ...documents[0], name: "../file.pdf" }, ...documents.slice(1)])
  ).rejects.toThrow();
});
it("includes the mapped briefing area and records imagery warnings in the package", async () => {
  const geometry = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-0.1, 51.5],
              [-0.09, 51.5],
              [-0.09, 51.51],
              [-0.1, 51.51],
              [-0.1, 51.5],
            ],
          ],
        },
      },
    ],
  };
  const issue = {
    kind: "draft",
    issuedAt: "2026-10-30T10:00Z",
    snapshot: { id: "m", title: "Site", revision: 2, flightArea: geometry },
  };
  const result = await assembleDocumentBundle(
    issue,
    names.map((name) => ({ name, bytes: strToU8(`PDF ${name}`) })),
    { warnings: ["Satellite unavailable"] }
  );
  const files = unzipSync(result.bytes);
  expect(Object.keys(files)).toHaveLength(11);
  expect(strFromU8(files["08-briefing-area.kml"])).toContain("<Polygon>");
  expect(strFromU8(files["README.txt"])).toContain("Satellite unavailable");
  expect(result.manifest.warnings).toEqual(["Satellite unavailable"]);
  expect(result.manifest.files.find((f) => f.name === "08-briefing-area.kml").sha256).toHaveLength(64);
  const large = {
    ...issue,
    snapshot: { ...issue.snapshot, flightArea: { ...geometry, features: Array(101).fill(geometry.features[0]) } },
  };
  const limited = await assembleDocumentBundle(
    large,
    names.map((name) => ({ name, bytes: strToU8(`PDF ${name}`) }))
  );
  expect(Object.keys(unzipSync(limited.bytes))).toHaveLength(10);
  expect(limited.manifest.warnings[0]).toContain("KML was not included");
});
