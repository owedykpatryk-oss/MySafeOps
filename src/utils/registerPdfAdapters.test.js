import { describe, expect, it, vi } from "vitest";
import {
  flattenGeoPhotoRow,
  flattenObservationRow,
  flattenRiddorRow,
  prepareRegisterExport,
  renderDailyBriefingDetailPages,
  renderGeoPhotoDetailPages,
} from "./registerPdfAdapters";
import { jsPDF } from "jspdf";
import { PDF_PAGE } from "./pdfBranding";

describe("registerPdfAdapters", () => {
  it("flattens riddor rows with human-readable type", () => {
    const row = flattenRiddorRow({ riddorType: "over7day", incidentDate: "2026-01-15", status: "draft" });
    expect(row.type).toContain("Over-7-day");
    expect(row.incidentDate).toBe("2026-01-15");
  });

  it("flattens safety observations", () => {
    const row = flattenObservationRow({
      obsDate: "2026-02-01",
      polarity: "positive",
      projectName: "Site A",
      detail: "Good housekeeping",
      observer: "SM",
    });
    expect(row.polarity).toBe("Positive");
    expect(row.project).toBe("Site A");
  });

  it("flattens geo-photo rows with coordinates", () => {
    const row = flattenGeoPhotoRow({
      type: "access_route",
      projectName: "Demo",
      latitude: 51.501,
      longitude: -0.142,
      bearing: 90,
      includeInReport: true,
      timestampUtc: "2026-03-01T10:00:00.000Z",
    });
    expect(row.project).toBe("Demo");
    expect(row.coordinates).toContain("51.50100");
    expect(row.bearing).toBe("90°");
    expect(row.inReport).toBe("Yes");
  });

  it("carries a traced extent into the register, and a dash where there is none", () => {
    const traced = flattenGeoPhotoRow({
      type: "vegetation",
      latitude: 51.5,
      longitude: -0.1,
      area: {
        points: [
          [51.5, -0.1],
          [51.5009, -0.1],
          [51.5009, -0.09855],
          [51.5, -0.09855],
        ],
      },
    });
    expect(traced.extent).toBe("1.00 ha");
    expect(flattenGeoPhotoRow({ type: "hazard" }).extent).toBe("—");
  });

  it("uses detail export mode for geo-photos", () => {
    const prepared = prepareRegisterExport("geo-photos", [{ id: "gp1" }], { summary: false });
    expect(prepared.mode).toBe("detail");
  });

  it("continues long geo-photo notes on new pages before the footer", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFont = vi.fn();
    const textCalls = [];
    const originalText = pdf.text.bind(pdf);
    pdf.text = (...args) => {
      textCalls.push(args);
      return originalText(...args);
    };

    renderGeoPhotoDetailPages(
      pdf,
      [
        {
          id: "gp-long",
          type: "general_site_condition",
          projectName: "Demo site",
          latitude: 51.5,
          longitude: -0.12,
          notes: "Long note with safety observation and follow-up. ".repeat(180),
        },
      ],
      {
        drawPdfPageHeader: () => 64,
        renderRegisterTable: () => {},
        org: {},
        rgb: [15, 23, 42],
        theme: "executive",
        label: "Geo-photos",
      }
    );

    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    const baselines = textCalls.map(([, y]) => y).filter((y) => typeof y === "number");
    expect(Math.max(...baselines)).toBeLessThanOrEqual(PDF_PAGE.CONTENT_BOTTOM - 2);
  });

  it("preserves portrait photo proportions inside the gallery frame", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFont = vi.fn();
    pdf.getImageProperties = vi.fn(() => ({ width: 100, height: 200 }));
    pdf.addImage = vi.fn();

    renderGeoPhotoDetailPages(
      pdf,
      [{ id: "gp-portrait", type: "hazard", photoDataUrl: "data:image/jpeg;base64,abc" }],
      {
        drawPdfPageHeader: () => 64,
        renderRegisterTable: () => {},
        org: {},
        rgb: [15, 23, 42],
        theme: "executive",
        label: "Geo-photos",
      }
    );

    const [, , x, y, width, height] = pdf.addImage.mock.calls[0];
    expect(width / height).toBeCloseTo(0.5);
    expect(width).toBeCloseTo(77.5);
    expect(x).toBeCloseTo(66.25);
    expect(y).toBeCloseTo(68);
  });

  it("splits long briefing sections and repeats the attendance header without footer overflow", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFont = vi.fn();
    const textCalls = [];
    const originalText = pdf.text.bind(pdf);
    pdf.text = (...args) => {
      textCalls.push(args);
      return originalText(...args);
    };
    renderDailyBriefingDetailPages(
      pdf,
      [{
        location: "Test site",
        date: "2026-09-30",
        scopeToday: "Long safety scope. ".repeat(900),
        attendees: Array.from({ length: 24 }, (_, i) => ({
          name: i === 0 ? "A very long worker name that must remain within the name column. ".repeat(12) : `Worker ${i + 1}`,
          role: "Operative",
          present: true,
        })),
      }],
      {
        drawPdfPageHeader: () => 64,
        org: {},
        rgb: [15, 23, 42],
        accentRgb: [0, 150, 140],
        theme: "executive",
        label: "Daily briefing",
      }
    );

    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
    expect(textCalls.filter(([value]) => value === "Name").length).toBeGreaterThan(1);
    expect(textCalls.some(([value]) => Array.isArray(value) && value.at(-1)?.endsWith("…"))).toBe(true);
    const baselines = textCalls.map(([, y]) => y).filter((y) => typeof y === "number");
    expect(Math.max(...baselines)).toBeLessThanOrEqual(PDF_PAGE.CONTENT_BOTTOM);
  });
});
