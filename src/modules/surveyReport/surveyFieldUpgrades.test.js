/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  captureSurveyRevisionSnapshot,
  buildRecordsRevisionDiff,
  buildRevisionDiffHtml,
  evidenceRowFromGeoPhoto,
  appendEvidenceFromGeoPhotos,
  parseUndertakerPaste,
  applyUndertakerPaste,
  buildHandoverChecklistHtml,
} from "./surveyFieldUpgrades";
import { blankRecordItem } from "./surveyEvidencePack";
import { blankSurveyReport } from "./surveyReportConstants";
import { buildDuplicateReportPayload } from "./surveyReportHelpers";

describe("surveyFieldUpgrades", () => {
  it("diffs new TFR and newly located between revisions", () => {
    const before = blankSurveyReport({
      documentControl: { revision: "A" },
      recordItems: [
        blankRecordItem({ undertaker: "Cadent", serviceType: "gas", status: "not_located" }),
        blankRecordItem({ undertaker: "BT", serviceType: "telecoms", status: "partial" }),
      ],
    });
    const after = blankSurveyReport({
      documentControl: { revision: "B" },
      recordItems: [
        blankRecordItem({ undertaker: "Cadent", serviceType: "gas", status: "tfr", tfr: true, notes: "180mm PE" }),
        blankRecordItem({ undertaker: "BT", serviceType: "telecoms", status: "located" }),
        blankRecordItem({ undertaker: "UKPN", serviceType: "electric", status: "tfr", tfr: true }),
      ],
      utilitiesTable: [{ utilityType: "electric", pas128Ql: "B2", depth: "0.8m" }],
    });
    const snap = captureSurveyRevisionSnapshot(before);
    const diff = buildRecordsRevisionDiff(snap, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.newTfr.some((r) => /Cadent|UKPN/i.test(r.undertaker))).toBe(true);
    expect(diff.newlyLocated.some((r) => /BT/i.test(r.undertaker))).toBe(true);
    expect(diff.newUtilities.length).toBe(1);
    expect(buildRevisionDiffHtml(diff)).toContain("sr-revdiff");
  });

  it("stores recordsRevisionDiff when bumping a final report", () => {
    const final = blankSurveyReport({
      id: "fin1",
      status: "final",
      ref: "UM26-1-WSP",
      documentControl: { revision: "A", issueNumber: "1" },
      recordItems: [blankRecordItem({ undertaker: "SGN", serviceType: "gas", status: "not_located" })],
    });
    const next = buildDuplicateReportPayload(final, [final], { asRevision: true });
    expect(next.documentControl.revision).toBe("B");
    expect(next.revisionBaselineSnapshot?.revision).toBe("A");
    // Same matrix until surveyor edits — hasChanges may be false; snapshot must exist
    expect(next.revisionBaselineSnapshot?.recordItems?.length).toBe(1);
  });

  it("builds evidence row from geo-photo and appends unique URLs", () => {
    const row = evidenceRowFromGeoPhoto({
      type: "site_access",
      label: "Locked gate",
      dataUrl: "https://example.com/gate.jpg",
      projectId: "p1",
    });
    expect(row.title).toMatch(/Locked gate/i);
    expect(row.photoUrls[0]).toContain("gate.jpg");
    expect(row.body).toMatch(/CAD/i);

    const report = blankSurveyReport({ projectId: "p1", evidenceRows: [] });
    const next = appendEvidenceFromGeoPhotos(report, [
      { projectId: "p1", type: "cat_scan", label: "CAT", url: "https://example.com/cat.jpg" },
      { projectId: "p1", type: "cat_scan", label: "CAT", url: "https://example.com/cat.jpg" },
    ]);
    expect(next.evidenceRows).toHaveLength(1);
  });

  it("parses undertaker paste into records matrix", () => {
    const text = [
      "Cadent Gas: apparatus present on site",
      "BT Openreach: no plant in search area",
      "UKPN: records only / TFR",
      "Thames Water: no response",
    ].join("\n");
    const { items, responses } = parseUndertakerPaste(text);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.serviceType === "gas")).toBe(true);
    expect(items.some((i) => i.status === "tfr")).toBe(true);
    expect(responses.length).toBeGreaterThanOrEqual(3);

    const { report, added } = applyUndertakerPaste(blankSurveyReport(), text);
    expect(added).toBeGreaterThan(0);
    expect(report.recordItems.length).toBe(added);
  });

  it("builds handover checklist HTML", () => {
    const html = buildHandoverChecklistHtml(["report/a.pdf", "client/client-pack.pdf"], {
      ref: "UM26-1",
      documentControl: { revision: "B" },
      client: "Acme",
    });
    expect(html).toContain("Handover pack checklist");
    expect(html).toContain("client-pack.pdf");
    expect(html).toContain("UM26-1");
  });
});
