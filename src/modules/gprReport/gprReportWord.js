import { downloadBlob } from "../../utils/downloadBlob.js";
import { buildGprReportHtml } from "./gprReportPrintHtml.js";

const BLOCK_TAGS = new Set(["DIV", "P", "FIGURE", "FIGCAPTION", "TABLE", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "SECTION", "ARTICLE"]);

function readableText(element) {
  return String(element?.textContent || "").replace(/\s+/g, " ").trim();
}

function collectBlocks(element, blocks) {
  if (!element || element.nodeType !== 1) return;
  const tag = element.tagName;
  if (tag === "IMG") {
    const src = element.getAttribute("src") || "";
    if (src) blocks.push({ type: "image", src, alt: element.getAttribute("alt") || "" });
    return;
  }
  if (tag === "TABLE") {
    const rows = [...element.querySelectorAll("tr")].map((row) =>
      [...row.children].filter((cell) => cell.matches("th,td")).map(readableText)
    ).filter((row) => row.length);
    if (rows.length) blocks.push({ type: "table", rows });
    return;
  }
  if (/^H[1-4]$/.test(tag)) {
    const text = readableText(element);
    if (text) blocks.push({ type: "heading", level: Number(tag[1]), text });
    return;
  }
  if (tag === "P" || tag === "LI" || tag === "FIGCAPTION") {
    const text = readableText(element);
    if (text) blocks.push({ type: "paragraph", text: tag === "LI" ? `• ${text}` : text });
    return;
  }
  const children = [...element.children];
  if (!children.some((child) => BLOCK_TAGS.has(child.tagName) || child.tagName === "IMG")) {
    const text = readableText(element);
    if (text) blocks.push({ type: "paragraph", text });
    return;
  }
  children.forEach((child) => collectBlocks(child, blocks));
}

/** Extract the same report sections and figures used by the PDF preview. */
export function extractGprWordBlocks(html) {
  const page = new DOMParser().parseFromString(html, "text/html");
  const blocks = [];
  page.querySelectorAll(".gpr-section").forEach((section) => collectBlocks(section, blocks));
  const footer = page.querySelector(".gpr-footer-note");
  if (footer) collectBlocks(footer, blocks);
  return blocks;
}

function imageBytes(src) {
  const match = /^data:image\/(png|jpe?g|gif|bmp);base64,([\s\S]+)$/i.exec(src);
  if (!match) return null;
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return { bytes, type: match[1].toLowerCase().replace("jpeg", "jpg") };
}

function transcodeImage(src, revoke = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        resolve(imageBytes(canvas.toDataURL("image/png")));
      } catch {
        reject(new Error("A report image could not be converted for Word."));
      } finally {
        if (revoke) URL.revokeObjectURL(src);
      }
    };
    image.onerror = () => {
      if (revoke) URL.revokeObjectURL(src);
      reject(new Error("A report image could not be loaded for Word."));
    };
    image.src = src;
  });
}

function imageDimensions(bytes, type) {
  if (type === "png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "gif" && bytes.length >= 10) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (type === "jpg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
        return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
      }
      offset += 2 + length;
    }
  }
  return { width: 640, height: 420 };
}

async function imageData(src) {
  const embedded = imageBytes(src);
  if (embedded) return embedded;
  if (/^data:image\//i.test(src)) return transcodeImage(src);
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not load a report image (${response.status}).`);
  const type = response.headers.get("content-type")?.split(";")[0]?.replace("image/jpeg", "image/jpg").replace("image/", "");
  const blob = await response.blob();
  if (!["png", "jpg", "gif", "bmp"].includes(type)) return transcodeImage(URL.createObjectURL(blob), true);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type };
}

function safeFileName(ref) {
  return String(ref || "gpr-report").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "gpr-report";
}

export async function buildGprReportWord(report, extras = {}) {
  const { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");
  const html = buildGprReportHtml(report, extras);
  const htmlPage = new DOMParser().parseFromString(html, "text/html");
  const blocks = extractGprWordBlocks(html);
  const includedSources = new Set(blocks.filter((block) => block.type === "image").map((block) => block.src));
  const extraPhotos = (Array.isArray(report.photos) ? report.photos : []).filter((photo) => photo?.dataUrl && !includedSources.has(photo.dataUrl));
  if (extraPhotos.length) {
    blocks.push({ type: "heading", level: 2, text: "Additional report photos" });
    extraPhotos.forEach((photo, index) => {
      blocks.push({ type: "image", src: photo.dataUrl, alt: photo.caption || photo.label || `Report photo ${index + 1}` });
      blocks.push({ type: "paragraph", text: photo.caption || photo.label || `Report photo ${index + 1}` });
    });
  }
  (Array.isArray(report.photos) ? report.photos : []).filter((photo) => photo?.dataUrl && includedSources.has(photo.dataUrl)).forEach((photo) => {
    const caption = photo.caption || photo.label;
    if (caption && !blocks.some((block) => block.type === "paragraph" && block.text.includes(caption))) {
      blocks.push({ type: "paragraph", text: caption });
    }
  });
  const cover = htmlPage.querySelector(".gpr-cover, .um-hero-cover");
  const organisation = cover?.querySelector(".gpr-cover-top")?.textContent?.trim() || "MySafeOps";
  const children = [
    new Paragraph({ text: organisation.replace(/\s+/g, " "), spacing: { after: 700 }, style: "Subtitle" }),
    new Paragraph({ text: "GROUND PENETRATING RADAR", spacing: { after: 180 }, style: "Subtitle" }),
    new Paragraph({ text: report.title || "Ground Penetrating Radar Report", style: "Title", spacing: { after: 280 } }),
    new Paragraph({ text: report.status === "final" ? "FINAL GPR REPORT" : "DRAFT GPR REPORT", spacing: { after: 500 }, style: "Subtitle" }),
  ];
  const metadata = [
    ["Report ref", report.ref], ["Revision", report.revision], ["Issue", report.issuePurpose],
    ["Status", report.status], ["Survey date", report.surveyDate], ["Surveyor", report.surveyor],
    ["Client", report.client], ["Project", report.projectName], ["Site", [report.siteAddress, report.postcode].filter(Boolean).join(", ")],
    ["Grid reference", report.gridRef], ["What3Words", report.what3words],
  ];
  metadata.filter(([, value]) => String(value || "").trim()).forEach(([label, value]) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true, color: "14345B" }), new TextRun(String(value))], spacing: { after: 80 } }));
  });
  const coverPhoto = cover?.querySelector('img[alt="Site photograph"]')?.getAttribute("src");
  if (coverPhoto) {
    const { bytes, type } = await imageData(coverPhoto);
    const size = imageDimensions(bytes, type);
    const scale = Math.min(1, 500 / Math.max(size.width, 1), 250 / Math.max(size.height, 1));
    children.push(new Paragraph({
      children: [new ImageRun({ data: bytes, type, transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) }, altText: { name: "Site photograph", title: "Site photograph", description: "Site photograph" } })],
      spacing: { before: 300, after: 300 },
    }));
  }
  let firstSection = true;

  for (const block of blocks) {
    if (block.type === "heading") {
      children.push(new Paragraph({ text: block.text, heading: block.level <= 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 260, after: 130 }, keepWithNext: true, pageBreakBefore: firstSection }));
      firstSection = false;
    } else if (block.type === "paragraph") {
      children.push(new Paragraph({ text: block.text, spacing: { after: 120 } }));
    } else if (block.type === "table") {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: block.rows.map((row, rowIndex) => new TableRow({
          tableHeader: rowIndex === 0,
          children: row.map((cell) => new TableCell({
            shading: rowIndex === 0 ? { fill: "EAF1F8" } : undefined,
            margins: { top: 90, bottom: 90, left: 110, right: 110 },
            children: [new Paragraph({ children: [new TextRun({ text: cell || " ", bold: rowIndex === 0, color: rowIndex === 0 ? "14345B" : "1F2937" })] })],
          })),
        })),
      }));
    } else if (block.type === "image") {
      const { bytes, type } = await imageData(block.src);
      const size = imageDimensions(bytes, type);
      const scale = Math.min(1, 520 / Math.max(size.width, 1), 680 / Math.max(size.height, 1));
      children.push(new Paragraph({
        children: [new ImageRun({ data: bytes, type, transformation: { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) }, altText: { name: block.alt || "Report image", title: block.alt || "Report image", description: block.alt || "Report image" } })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        keepWithNext: true,
      }));
    }
  }
  const document = new Document({
    styles: {
      default: { document: { run: { font: "Aptos", size: 21, color: "1F2937" }, paragraph: { spacing: { after: 120, line: 300 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { font: "Aptos Display", size: 42, bold: true, color: "14345B" } },
        { id: "Subtitle", name: "Subtitle", basedOn: "Normal", run: { font: "Aptos", size: 17, bold: true, color: "167D8D" } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", run: { font: "Aptos Display", size: 26, bold: true, color: "14345B" } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", run: { font: "Aptos Display", size: 22, bold: true, color: "167D8D" } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, right: 850, bottom: 900, left: 850 } } },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { top: { color: "D8E2EC", size: 4, style: BorderStyle.SINGLE } },
        children: [new TextRun({ text: `${report.ref || "GPR report"}  •  `, color: "64748B", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: "64748B", size: 16 })],
      })] }) },
      children,
    }],
  });
  return { blob: await Packer.toBlob(document), fileName: `${safeFileName(report.ref)}.docx`, imageCount: blocks.filter((block) => block.type === "image").length + (coverPhoto ? 1 : 0) };
}

export async function downloadGprReportWord(report, extras = {}) {
  const result = await buildGprReportWord(report, extras);
  if (!downloadBlob(result.blob, result.fileName)) throw new Error("Allow downloads for this site and try again.");
  return result;
}
