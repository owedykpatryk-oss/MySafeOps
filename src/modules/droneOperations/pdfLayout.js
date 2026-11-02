import { jsPDF } from "jspdf";
import { ensurePdfUnicodeFont, setPdfFont, tryAddLogo } from "../../utils/pdfBranding.js";
import { geometrySummary } from "./droneGeometry.js";
import { loadPdfMapImagery, mercator, imageryAttribution } from "./pdfMapImagery.js";

const INK = [24, 51, 72],
  TEAL = [15, 118, 110],
  PALE = [238, 243, 246],
  MUTED = [75, 94, 109],
  AMBER = [146, 64, 14];
const LEFT = 16,
  WIDTH = 178,
  BOTTOM = 266;
export async function createReportDocument(title, org, reference, status, issuedAt, exportSession = {}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  await ensurePdfUnicodeFont(pdf);
  pdf.setProperties({
    title,
    subject: `${status} | ${reference}`,
    author: org.name || "MySafeOps",
    creator: "MySafeOps",
  });
  const entries = [],
    tocPages = [];
  let y = 40,
    coverPage = null,
    activeHeading = "";
  const font = (size = 9, bold = false, colour = INK) => {
    setPdfFont(pdf, bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...colour);
  };
  const lines = (value, width = WIDTH, size = 9, bold = false) => {
    font(size, bold);
    return pdf.splitTextToSize(String(value ?? "Not recorded"), width);
  };
  const header = () => {
    pdf.setFillColor(...TEAL);
    pdf.rect(0, 0, 6, 297, "F");
    font(12, true);
    pdf.text(title, LEFT, 17);
    font(7.5, false, MUTED);
    pdf.text(`${status} | ${reference}`, LEFT, 24);
    pdf.setDrawColor(210, 222, 229);
    pdf.line(LEFT, 30, 194, 30);
    y = 40;
  };
  const newPage = (continuation = false) => {
    pdf.addPage();
    header();
    if (continuation && activeHeading) {
      const continued = lines(`${activeHeading} (continued)`, WIDTH, 8, true);
      const suffix = "... (continued)";
      const label =
        continued.length > 1
          ? `${lines(activeHeading, WIDTH - pdf.getTextWidth(suffix), 8, true)[0]}${suffix}`
          : continued[0];
      font(8, true, MUTED);
      pdf.text(label, LEFT, y);
      y += 8;
    }
  };
  const ensure = (height, continuation = true) => {
    // Oversized content flows line by line; reserving more than one page would insert empty pages.
    if (y + Math.min(height, BOTTOM - 40) > BOTTOM) newPage(continuation);
  };
  const paragraph = (value, size = 9, bold = false, colour = INK, indent = 0) => {
    const wrapped = lines(value, WIDTH - indent, size, bold),
      step = size * 0.49;
    for (const line of wrapped) {
      ensure(step);
      font(size, bold, colour);
      pdf.text(line, LEFT + indent, y);
      y += step;
    }
    y += 3;
  };
  const heading = (label, record = true) => {
    const wrapped = lines(label, WIDTH, 13, true);
    ensure(wrapped.length * 6.3 + 15, false);
    activeHeading = label;
    if (record) {
      const page = pdf.getNumberOfPages();
      entries.push({ label, page, y });
      pdf.outline?.add(null, label, { pageNumber: page });
    }
    pdf.setDrawColor(...TEAL);
    pdf.setLineWidth(0.8);
    pdf.line(LEFT, y - 6, LEFT + 12, y - 6);
    paragraph(label, 13, true);
    y += 2;
  };
  const section = (label, value) => {
    const blocks = String(value || "Not recorded").split(/\n\n+/);
    const firstHeight = lines(blocks[0]).length * 4.41 + 3;
    if (firstHeight < 180) ensure(firstHeight + lines(label, WIDTH, 13, true).length * 6.37 + 17, false);
    heading(label);
    for (const block of blocks) {
      const height = lines(block).length * 4.41 + 3;
      if (height < 180) ensure(height);
      paragraph(block);
    }
    y += 5;
  };
  const facts = (rows, compact = false) => {
    if (compact) {
      for (let i = 0; i < rows.length; i += 2) {
        const cells = rows.slice(i, i + 2).map(([label, value]) => ({
          label,
          value,
          wrapped: lines(String(value ?? "").trim() || "Not recorded", 78, 9),
        }));
        const height = Math.max(...cells.map((c) => c.wrapped.length * 4.5 + 14));
        if (height > 150) {
          facts(rows.slice(i, i + 2));
          continue;
        }
        ensure(height + 3, false);
        cells.forEach((cell, col) => {
          const x = LEFT + col * 91;
          pdf.setFillColor(...PALE);
          pdf.rect(x, y - 4, 87, height, "F");
          font(8, true, MUTED);
          pdf.text(cell.label, x + 4, y + 1);
          font(9);
          pdf.text(cell.wrapped, x + 4, y + 8, { lineHeightFactor: 1.42 });
        });
        y += height + 3;
      }
      y += 6;
      return;
    }
    for (const [label, value] of rows) {
      const wrapped = lines(String(value ?? "").trim() || "Not recorded", 125, 9);
      const height = Math.max(12, wrapped.length * 4.5 + 5);
      if (height > 180) {
        section(label, value);
        continue;
      }
      ensure(height + 2, false);
      pdf.setFillColor(...PALE);
      pdf.rect(LEFT, y - 4, WIDTH, height, "F");
      font(8, true, MUTED);
      pdf.text(lines(label, 44, 8, true), LEFT + 3, y + 1);
      font(9);
      pdf.text(wrapped, LEFT + 50, y + 1, { lineHeightFactor: 1.42 });
      y += height + 2;
    }
    y += 6;
  };
  const cover = (m, rows, options = {}) => {
    coverPage = pdf.getNumberOfPages();
    pdf.setFillColor(...INK);
    pdf.rect(0, 0, 210, 119, "F");
    pdf.setFillColor(...TEAL);
    pdf.rect(16, 17, 32, 3, "F");
    font(12, true, [255, 255, 255]);
    pdf.text(title, LEFT, 34);
    const missionTitle = String(m.title || "Survey mission");
    let size = 25;
    while (size > 13 && lines(missionTitle, WIDTH, size, true).length > 4) size--;
    const titleLines = lines(missionTitle, WIDTH, size, true),
      shortTitle = titleLines.length > 6;
    font(size, true, [255, 255, 255]);
    pdf.text(shortTitle ? [...titleLines.slice(0, 5), "(full title follows)"] : titleLines, LEFT, 53, {
      lineHeightFactor: 1.15,
    });
    font(9, false, [255, 255, 255]);
    pdf.text(
      `${status} | ${options.revisionLabel || "Revision"} ${String(m.revision ?? "Not recorded").slice(0, 40)}`,
      LEFT,
      107
    );
    y = 133;
    tryAddLogo(pdf, org, 165, 123, 29, 13);
    const brandLines = lines(String(org.name || "MySafeOps"), 140, 10, true);
    for (const line of brandLines) {
      ensure(5);
      font(10, true);
      pdf.text(line, LEFT, y);
      y += 5;
    }
    y += 8;
    if (shortTitle) section(options.fullTitleLabel || "Mission title", missionTitle);
    facts(rows);
    paragraph(
      options.statusNote ??
        `${(m.nextActions || []).length} listed open action(s). Review the current conditions and the full evidence register.`,
      10,
      true,
      AMBER
    );
    paragraph(
      options.disclaimer ??
        "This document records survey planning and coordination. Flight decisions remain with the responsible operator and pilot.",
      9,
      false,
      MUTED
    );
  };
  const contents = () => {
    newPage();
    tocPages.push(pdf.getNumberOfPages());
  };
  const startBody = () => {
    if (tocPages.length || coverPage) newPage();
  };
  const checklists = (groups) => {
    for (const group of groups) {
      const first = group.items[0];
      if (first) {
        const firstHeight =
          lines(first.title, 126, 10, true).length * 5 + lines(first.detail, WIDTH - 8, 8.5).length * 4.17 + 22;
        if (firstHeight < 185) ensure(firstHeight + 24, false);
      }
      heading(group.title);
      for (const item of group.items) {
        const titleRows = lines(item.title, 126, 10, true);
        const detailRows = lines(item.detail, WIDTH - 8, 8.5);
        const cardHeight = titleRows.length * 5 + detailRows.length * 4.17 + 22;
        if (titleRows.length > 12) {
          section(item.title, `${item.status}\n${item.detail}`);
          continue;
        }
        if (cardHeight < 185) ensure(cardHeight, false);
        else ensure(titleRows.length * 5 + 20, false);
        const top = y - 4;
        pdf.setFillColor(...PALE);
        pdf.rect(LEFT, top, WIDTH, titleRows.length * 5 + 8, "F");
        font(10, true);
        pdf.text(titleRows, LEFT + 4, y + 1, { lineHeightFactor: 1.4 });
        font(8, true, item.status === "Review recorded" ? TEAL : AMBER);
        pdf.text(item.status, 190, y + 1, { align: "right" });
        y += titleRows.length * 5 + 7;
        // Use the item name for continuation labels, preserving the group in the contents.
        activeHeading = item.title;
        paragraph(item.detail, 8.5, false, INK, 4);
        pdf.setDrawColor(210, 222, 229);
        pdf.line(LEFT, y, 194, y);
        y += 9;
      }
    }
  };
  const map = async (m, combined, onCurrentPage = false) => {
    const summary = geometrySummary(combined);
    if (!summary.bounds) return;
    const imagery = await (exportSession.loadMapImagery || loadPdfMapImagery)(combined);
    if (!onCurrentPage) newPage();
    heading("Operating areas");
    const b = summary.bounds,
      cos = Math.cos((summary.centre[1] * Math.PI) / 180);
    const dx = Math.max(0.00001, (b[2] - b[0]) * cos),
      dy = Math.max(0.00001, b[3] - b[1]);
    const scale = Math.min(158 / dx, 119 / dy),
      x0 = 26 + (158 - dx * scale) / 2,
      y0 = y + 10 + (119 - dy * scale) / 2;
    const xy = imagery.dataUrl
      ? (p) => {
          const [mx, my] = mercator(p),
            [west, south, east, north] = imagery.bounds;
          return [LEFT + ((mx - west) / (east - west)) * WIDTH, y + ((north - my) / (north - south)) * 145];
        }
      : (p) => [x0 + (p[0] - b[0]) * cos * scale, y0 + (b[3] - p[1]) * scale];
    pdf.setFillColor(246, 249, 250);
    pdf.rect(LEFT, y, WIDTH, 145, "F");
    pdf.setDrawColor(222, 231, 235);
    pdf.setLineWidth(0.2);
    for (let x = 26; x < 190; x += 12) pdf.line(x, y, x, y + 145);
    for (let row = y + 12; row < y + 145; row += 12) pdf.line(LEFT, row, 194, row);
    if (imagery.dataUrl) pdf.addImage(imagery.dataUrl, "JPEG", LEFT, y, WIDTH, 145);
    const styles = {
      boundary: [TEAL, []],
      flightArea: [
        [37, 99, 235],
        [4, 2],
      ],
      contingencyArea: [AMBER, [1, 2]],
      safetyArea: [
        [185, 28, 28],
        [5, 2, 1, 2],
      ],
    };
    for (const [key, [colour, dash]] of Object.entries(styles)) {
      pdf.setDrawColor(...colour);
      pdf.setLineWidth(0.65);
      pdf.setLineDashPattern(dash, 0);
      for (const f of m[key]?.features || []) {
        const g = f.geometry;
        const rings =
          g.type === "Polygon"
            ? g.coordinates
            : g.type === "MultiPolygon"
              ? g.coordinates.flat()
              : g.type === "LineString"
                ? [g.coordinates]
                : [];
        for (const ring of rings)
          for (let i = 1; i < ring.length; i++) {
            if (imagery.dataUrl) {
              pdf.setDrawColor(255, 255, 255);
              pdf.setLineWidth(1.25);
              pdf.line(...xy(ring[i - 1]), ...xy(ring[i]));
            }
            pdf.setDrawColor(...colour);
            pdf.setLineWidth(0.65);
            pdf.line(...xy(ring[i - 1]), ...xy(ring[i]));
          }
        if (g.type === "Point") pdf.circle(...xy(g.coordinates), 1.3);
      }
    }
    pdf.setLineDashPattern([], 0);
    const markers = new Map();
    for (const [key, symbol] of [
      ["takeoff", "T"],
      ["landing", "L"],
      ["alternateLanding", "A"],
    ]) {
      if (!Array.isArray(m[key]) || m[key].length !== 2 || !m[key].every(Number.isFinite)) continue;
      const id = m[key].join(",");
      const marker = markers.get(id) || { coordinate: m[key], symbols: [] };
      marker.symbols.push(symbol);
      markers.set(id, marker);
    }
    for (const marker of markers.values()) {
      const p = xy(marker.coordinate),
        symbol = marker.symbols.join("/");
      pdf.setDrawColor(...INK);
      pdf.setFillColor(255, 255, 255);
      font(8, true);
      pdf.circle(...p, Math.max(2.5, pdf.getTextWidth(symbol) / 2 + 1), "FD");
      pdf.text(symbol, p[0], p[1] + 1, { align: "center" });
    }
    pdf.setFillColor(255, 255, 255);
    pdf.rect(179, y + 3, 13, 23, "F");
    pdf.rect(20, y + 126, 49, 15, "F");
    pdf.setDrawColor(...INK);
    font(9, true);
    pdf.text("N", 185, y + 10);
    pdf.line(186, y + 22, 186, y + 13);
    pdf.line(186, y + 13, 184, y + 16);
    pdf.line(186, y + 13, 188, y + 16);
    const metresPerMm = imagery.dataUrl ? ((imagery.bounds[2] - imagery.bounds[0]) * cos) / WIDTH : 111195 / scale,
      length = 10 ** Math.floor(Math.log10(metresPerMm * 35));
    pdf.line(23, y + 137, 23 + length / metresPerMm, y + 137);
    font(8);
    pdf.text(`${Math.round(length)} m (approx.)`, 23, y + 133);
    y += 157;
    if (imagery.dataUrl)
      paragraph(
        `${imageryAttribution}\nRetrieved: ${imagery.fetchedAt}; capture date unverified. Copyright ${new Date(imagery.fetchedAt).getUTCFullYear()} Esri and its licensors. Background is not historical approval evidence.`,
        7,
        false,
        MUTED
      );
    for (const [key, label] of [
      ["boundary", "Survey boundary"],
      ["flightArea", "Flight area"],
      ["contingencyArea", "Contingency area"],
      ["safetyArea", "Safety area"],
    ]) {
      pdf.setDrawColor(...styles[key][0]);
      pdf.setLineDashPattern(styles[key][1], 0);
      pdf.line(LEFT, y - 1, LEFT + 15, y - 1);
      pdf.setLineDashPattern([], 0);
      font(9);
      pdf.text(label, LEFT + 21, y);
      y += 7;
    }
    paragraph(
      `T: take-off / landing; L: landing; A: alternate landing. North up. ${imagery.dataUrl ? "Satellite / aerial context in Web Mercator; capture date varies and is unverified." : `${imagery.unavailable} WGS84 schematic; decorative grid.`} No aeronautical chart or obstacle coverage. Verify current site conditions.`,
      8,
      false,
      MUTED
    );
    paragraph(
      `Survey boundary: ${(geometrySummary(m.boundary).areaM2 / 10000).toFixed(3)} ha. Flight areas are defined separately.`,
      8
    );
  };
  const finish = () => {
    if (tocPages.length) {
      let toc = 0;
      const tocHeader = () => {
        pdf.setPage(tocPages[toc]);
        header();
        font(22, true);
        pdf.text("Inside this document", LEFT, 47);
        font(9, false, MUTED);
        pdf.text("Select a section to open its recorded page.", LEFT, 57);
        y = 68;
      };
      tocHeader();
      for (const entry of entries) {
        const wrappedLabel = lines(entry.label, 154, 9);
        const labelLines =
          wrappedLabel.length > 2
            ? [wrappedLabel[0], `${lines(wrappedLabel[1], 154 - pdf.getTextWidth("..."), 9)[0]}...`]
            : wrappedLabel;
        const height = labelLines.length * 4.5 + 3.5;
        if (y + height > BOTTOM) {
          pdf.addPage();
          tocPages.push(pdf.getNumberOfPages());
          toc++;
          tocHeader();
        }
        font(9);
        pdf.text(labelLines, LEFT, y);
        font(9, true, TEAL);
        pdf.text(String(entry.page), 194, y, { align: "right" });
        pdf.link(LEFT, y - 4, WIDTH, height, { pageNumber: entry.page, top: Math.max(0, entry.y - 8) });
        pdf.setDrawColor(220, 230, 235);
        pdf.line(LEFT, y + height - 4, 194, y + height - 4);
        y += height;
      }
      if (tocPages.length > 1) {
        pdf.setPage(tocPages[0]);
        font(8, false, MUTED);
        pdf.text(`Contents continue on page ${tocPages[1]}`, LEFT, 270);
        pdf.link(LEFT, 266, WIDTH, 7, { pageNumber: tocPages[1] });
      }
    }
    const count = pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      pdf.setPage(page);
      pdf.setDrawColor(...TEAL);
      pdf.setLineWidth(0.5);
      pdf.line(LEFT, 278, 194, 278);
      font(7, false, MUTED);
      pdf.text(`${reference} | ${status}`, LEFT, 284);
      pdf.text(`${page} / ${count}`, 194, 284, { align: "right" });
      font(6.5, false, MUTED);
      pdf.text(`Generated ${issuedAt || "date not recorded"} | MySafeOps`, LEFT, 290);
      if (tocPages.length && !tocPages.includes(page) && page !== coverPage) {
        font(7, true, TEAL);
        pdf.text("Contents", 194, 290, { align: "right" });
        pdf.link(174, 286, 20, 6, { pageNumber: tocPages[0] });
      }
    }
    return pdf;
  };
  header();
  return { pdf, section, facts, cover, contents, startBody, checklists, map, finish, entries };
}
