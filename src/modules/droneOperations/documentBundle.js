import { zipSync, strToU8 } from "fflate";
import { downloadBlob } from "../../utils/downloadBlob.js";
import { airspaceBriefing } from "./airspaceBriefing.js";
import { mapExport } from "./mapTools.js";
import { createPdfExportSession, missionExportFilename } from "./pdfExportSession.js";
const NAMES = [
  "01-full-draft.pdf",
  "02-task-plan-draft.pdf",
  "03-crew-briefing-draft.pdf",
  "04-evidence-register-draft.pdf",
  "05-field-card-draft.pdf",
  "06-operator-review-draft.pdf",
  "07-close-out-draft.pdf",
];
export async function assembleDocumentBundle(issue, documents, { warnings = [] } = {}) {
  if (issue.kind !== "draft") throw new Error("Preparation bundles must be marked as draft.");
  if (
    documents.length !== NAMES.length ||
    new Set(documents.map((d) => d.name)).size !== NAMES.length ||
    documents.some(
      (d) => !NAMES.includes(d.name) || !(d.bytes instanceof Uint8Array) || d.bytes.length > 8 * 1024 * 1024
    )
  )
    throw new Error("The draft bundle needs seven supported PDFs, each up to 8 MB.");
  const files = {};
  const entries = [];
  const m = issue.snapshot;
  const briefing = airspaceBriefing(m);
  const exportWarnings = [...warnings];
  let kmlIncluded = false;
  const supplements = [{ name: "09-airspace-briefing-request.txt", bytes: strToU8(briefing.text) }];
  if (briefing.hasGeometry) {
    try {
      supplements.push({
        name: "08-briefing-area.kml",
        bytes: strToU8(mapExport({ ...m, boundary: briefing.geometry }, "boundary", "kml").content),
      });
      kmlIncluded = true;
    } catch (error) {
      exportWarnings.push(
        `Briefing KML was not included: ${error.message} Export individual layers from Map tools or simplify the geometry.`
      );
    }
  }
  supplements.push({
    name: "README.txt",
    bytes: strToU8(
      [
        `${m.title || "Survey"} — draft package — revision ${m.revision}`,
        `Generated: ${issue.issuedAt}`,
        "Seven draft PDFs from one mission snapshot. Open 01-full-draft.pdf for the complete context.",
        kmlIncluded
          ? "08-briefing-area.kml: planning areas for a briefing request; not a flight-controller route or permission."
          : "No KML is included. The mapped area is missing or needs review; see any warnings below.",
        "09-airspace-briefing-request.txt: coordinates, UTC window and height for an official briefing. NOTAM data is not included.",
        "manifest.json: SHA-256 integrity hashes for all included documents; not an approval or signature.",
        ...exportWarnings,
      ].join("\n")
    ),
  });
  for (const document of [...documents, ...supplements]) {
    const bytes = document.bytes.slice();
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    files[document.name] = bytes;
    entries.push({ name: document.name, bytes: bytes.length, sha256 });
  }
  const manifest = {
    format: "mysafeops-draft-bundle/3",
    status: "draft",
    missionId: m.id,
    title: m.title,
    revision: m.revision,
    generatedAt: issue.issuedAt,
    region: m.regionCode || "uk",
    aircraftKind: m.aircraftKind || "drone",
    outstandingActions: (m.nextActions || []).map((a) => a.text),
    files: entries,
    warnings: exportWarnings,
    sourceFiles: (m.sourceFacts || []).map((f) => ({
      name: f.sourceName,
      sha256: f.hash,
      field: f.field,
      expiresOn: f.expiresOn || null,
    })),
    notice:
      "Draft preparation documents. File hashes support integrity comparison; they are not signatures or evidence of approval.",
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return { bytes: zipSync(files, { level: 6 }), manifest };
}
export async function downloadDraftBundle(issue, options = {}) {
  const captured = JSON.parse(
    JSON.stringify({ ...issue, kind: "draft", snapshot: { ...issue.snapshot, approval: null } })
  );
  const { buildDronePackPdf, buildPreparationPdf } = await import("./dronePdf.js");
  const session = createPdfExportSession(options);
  session.report("Preparing PDF 1 of 7 — full mission pack…");
  const documents = [
    { name: NAMES[0], bytes: new Uint8Array((await buildDronePackPdf(captured, session)).output("arraybuffer")) },
  ];
  for (const [i, kind] of ["task", "briefing", "sources", "field", "operator", "closeout"].entries()) {
    session.report(`Preparing PDF ${i + 2} of 7 — ${kind}…`);
    documents.push({
      name: NAMES[i + 1],
      bytes: new Uint8Array((await buildPreparationPdf(captured, kind, session)).output("arraybuffer")),
    });
  }
  session.report("Adding briefing files and checking package integrity…");
  const { bytes, manifest } = await assembleDocumentBundle(captured, documents, { warnings: session.warnings });
  session.assertActive();
  downloadBlob(
    new Blob([bytes], { type: "application/zip" }),
    missionExportFilename(captured.snapshot, "draft-package.zip")
  );
  return { warnings: manifest.warnings };
}
