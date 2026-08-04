import { getOrgSettings } from "./orgSettingsStorage.js";
import { sanitizePdfFileSegment } from "./pdfFileName.js";
import {
  PDF_PAGE,
  buildDocReference,
  drawPdfMetaStrip,
  drawPremiumPdfFooter,
  drawPremiumPdfHeader,
  drawWatermark,
  ensurePdfUnicodeFont,
  getPdfTheme,
  hexToRgb,
  setPdfFont,
} from "./pdfBranding.js";
import { todayLocalISO } from "./localDate.js";

const M = PDF_PAGE.MARGIN;
const W = PDF_PAGE.W;
const H = PDF_PAGE.H;
const CONTENT_W = W - M * 2;
const CONTENT_BOTTOM = H - PDF_PAGE.FOOTER_H - 5;

function safe(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function enGbDate(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function title(pdf, text, y, rgb, subtitle = "") {
  setPdfFont(pdf, "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  pdf.text(safe(text), M, y);
  pdf.setFillColor(...rgb);
  pdf.roundedRect(M, y + 3, 18, 1.4, 0.7, 0.7, "F");
  if (subtitle) {
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(pdf.splitTextToSize(safe(subtitle), CONTENT_W - 25).slice(0, 2), M + 23, y + 4);
  }
  return y + 12;
}

function metric(pdf, x, y, width, label, value, detail, rgb, tone = "default") {
  const fill = tone === "red" ? [254, 242, 242] : tone === "green" ? [236, 253, 245] : [248, 250, 252];
  const ink = tone === "red" ? [185, 28, 28] : tone === "green" ? [4, 120, 87] : rgb;
  pdf.setFillColor(...fill);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(x, y, width, 24, 2.5, 2.5, "FD");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...ink);
  pdf.text(safe(value, "0"), x + 4, y + 8);
  pdf.setFontSize(6.4);
  pdf.setTextColor(51, 65, 85);
  pdf.text(safe(label).toUpperCase().slice(0, 34), x + 4, y + 13.5);
  setPdfFont(pdf, "normal");
  pdf.setFontSize(5.8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(pdf.splitTextToSize(safe(detail, "Current reporting period"), width - 8).slice(0, 2), x + 4, y + 18);
}

function readinessDashboard(pdf, jobs, y) {
  const totals = { green: 0, amber: 0, red: 0 };
  (jobs || []).forEach((job) => {
    const tone = ["green", "red"].includes(job.tone) ? job.tone : "amber";
    totals[tone] += 1;
  });
  const total = Math.max(1, totals.green + totals.amber + totals.red);
  const cards = [
    { key: "green", label: "Ready to proceed", colour: [16, 185, 129], fill: [236, 253, 245] },
    { key: "amber", label: "Needs information", colour: [217, 145, 20], fill: [255, 251, 235] },
    { key: "red", label: "Blocked / urgent", colour: [220, 91, 83], fill: [254, 242, 242] },
  ];
  const gap = 4;
  const cardW = (CONTENT_W - gap * 2) / 3;
  cards.forEach((card, index) => {
    const x = M + index * (cardW + gap);
    pdf.setFillColor(...card.fill);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x, y, cardW, 18, 2.5, 2.5, "FD");
    pdf.setFillColor(...card.colour);
    pdf.circle(x + 7, y + 7, 2.2, "F");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...card.colour);
    pdf.text(String(totals[card.key]), x + 13, y + 8);
    setPdfFont(pdf, "normal");
    pdf.setFontSize(6.2);
    pdf.setTextColor(71, 85, 105);
    pdf.text(card.label.toUpperCase(), x + 7, y + 14);
  });
  y += 22;
  let barX = M;
  cards.forEach((card) => {
    const width = CONTENT_W * (totals[card.key] / total);
    if (width > 0) {
      pdf.setFillColor(...card.colour);
      pdf.rect(barX, y, width, 4, "F");
      barX += width;
    }
  });
  if (!(jobs || []).length) {
    pdf.setFillColor(226, 232, 240);
    pdf.rect(M, y, CONTENT_W, 4, "F");
  }
  return y + 9;
}

function programmeTimeline(pdf, jobs, y) {
  const allRows = (jobs || []).filter((job) => job.start).slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const rows = allRows.length <= 8 ? allRows : Array.from({ length: 8 }, (_, index) => allRows[Math.round((index * (allRows.length - 1)) / 7)]);
  if (!rows.length) return y;
  const dates = allRows.flatMap((job) => [new Date(`${String(job.start).slice(0, 10)}T12:00:00`), new Date(`${String(job.end || job.start).slice(0, 10)}T12:00:00`)]).filter((date) => !Number.isNaN(date.getTime()));
  if (!dates.length) return y;
  const minTime = Math.min(...dates.map((date) => date.getTime()));
  const maxTime = Math.max(...dates.map((date) => date.getTime()));
  const range = Math.max(86400000, maxTime - minTime);
  const labelW = 58;
  const chartX = M + labelW;
  const chartW = CONTENT_W - labelW;
  const rowH = 7;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(M, y, CONTENT_W, 13 + rows.length * rowH, 2.5, 2.5, "FD");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(5.8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(enGbDate(new Date(minTime).toISOString()), chartX, y + 6);
  pdf.text(enGbDate(new Date(maxTime).toISOString()), chartX + chartW, y + 6, { align: "right" });
  for (let column = 0; column <= 6; column += 1) {
    const x = chartX + (chartW * column) / 6;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(x, y + 9, x, y + 10 + rows.length * rowH);
  }
  rows.forEach((job, index) => {
    const rowY = y + 12 + index * rowH;
    const start = new Date(`${String(job.start).slice(0, 10)}T12:00:00`).getTime();
    const end = new Date(`${String(job.end || job.start).slice(0, 10)}T12:00:00`).getTime();
    const left = chartX + ((start - minTime) / range) * chartW;
    const width = Math.max(3, ((Math.max(start, end) - start) / range) * chartW);
    const colours = statusColours(job.tone || "amber");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.1);
    pdf.setTextColor(51, 65, 85);
    pdf.text(pdf.splitTextToSize(safe(job.name), labelW - 4).slice(0, 1), M + 2, rowY + 3.7);
    pdf.setFillColor(...colours.fill);
    pdf.roundedRect(chartX, rowY + 1, chartW, 4, 1, 1, "F");
    pdf.setFillColor(...colours.text);
    pdf.roundedRect(Math.max(chartX, Math.min(chartX + chartW - 3, left)), rowY + 1, Math.min(width, chartX + chartW - left), 4, 1, 1, "F");
  });
  return y + 17 + rows.length * rowH;
}

function statusColours(tone) {
  if (tone === "green") return { fill: [220, 252, 231], text: [6, 95, 70] };
  if (tone === "red") return { fill: [254, 226, 226], text: [153, 27, 27] };
  return { fill: [254, 243, 199], text: [146, 64, 14] };
}

function pageHeader(pdf, meta, continued = "") {
  let y = drawPremiumPdfHeader(pdf, {
    ...meta,
    subtitle: continued || meta.subtitle,
  });
  y = drawPdfMetaStrip(pdf, meta.org, {
    moduleLabel: meta.title,
    docRef: meta.docRef,
    recordNote: continued || "Private management report",
  }, meta.rgb, y);
  return y + 2;
}

function ensurePage(pdf, y, required, meta, continuation) {
  if (y + required <= CONTENT_BOTTOM) return y;
  pdf.addPage();
  return pageHeader(pdf, meta, continuation);
}

function jobTable(pdf, jobs, y, meta) {
  const cols = [64, 30, 34, 25, 23];
  const headings = ["Job", "Team", "Dates", "Status", "Ready"];
  const drawHeadings = (startY) => {
    pdf.setFillColor(...meta.rgb);
    pdf.roundedRect(M, startY, CONTENT_W, 8, 1.5, 1.5, "F");
    let headingX = M;
    headings.forEach((heading, index) => {
      setPdfFont(pdf, "bold");
      pdf.setFontSize(6.2);
      pdf.setTextColor(255, 255, 255);
      pdf.text(heading.toUpperCase(), headingX + 2, startY + 5.1);
      headingX += cols[index];
    });
    return startY + 9;
  };
  y = drawHeadings(y);
  let x = M;
  (jobs || []).forEach((job, index) => {
    if (y + 10 > CONTENT_BOTTOM) {
      pdf.addPage();
      y = pageHeader(pdf, meta, "90-day programme - continued");
      y = drawHeadings(y);
    }
    const rowH = 9;
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(M, y - 1, CONTENT_W, rowH, "F");
    }
    const tone = job.tone || "amber";
    const status = statusColours(tone);
    x = M;
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(pdf.splitTextToSize(safe(job.name), cols[0] - 4).slice(0, 1), x + 2, y + 3.5);
    setPdfFont(pdf, "normal");
    pdf.setFontSize(5.6);
    pdf.setTextColor(100, 116, 139);
    pdf.text(pdf.splitTextToSize(`${safe(job.client)} - ${safe(job.site)}`, cols[0] - 4).slice(0, 1), x + 2, y + 7.2);
    x += cols[0];
    pdf.setFontSize(6.2);
    pdf.setTextColor(51, 65, 85);
    pdf.text(pdf.splitTextToSize(safe(job.teamName, "Unassigned"), cols[1] - 4).slice(0, 2), x + 2, y + 3.5);
    x += cols[1];
    pdf.setFontSize(5.8);
    pdf.text(`${enGbDate(job.start)} -`, x + 2, y + 3.5);
    pdf.text(enGbDate(job.end), x + 2, y + 7.2);
    x += cols[2];
    pdf.setFillColor(...status.fill);
    pdf.roundedRect(x + 2, y + 1, cols[3] - 5, 5, 1.5, 1.5, "F");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(5.7);
    pdf.setTextColor(...status.text);
    pdf.text(safe(job.status).slice(0, 15), x + (cols[3] / 2), y + 4.4, { align: "center" });
    x += cols[3];
    pdf.setFontSize(7);
    pdf.setTextColor(...status.text);
    pdf.text(`${Number(job.readiness) || 0}%`, x + cols[4] - 3, y + 4.2, { align: "right" });
    y += rowH;
  });
  if (!jobs?.length) {
    setPdfFont(pdf, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text("No jobs are currently scheduled in this reporting window.", M + 3, y + 7);
    y += 13;
  }
  return y + 3;
}

function capacityTable(pdf, rows, months, y, meta) {
  const teamW = 70;
  const monthW = (CONTENT_W - teamW) / Math.max(months.length, 1);
  pdf.setFillColor(...meta.rgb);
  pdf.roundedRect(M, y, CONTENT_W, 8, 1.5, 1.5, "F");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(6.2);
  pdf.setTextColor(255, 255, 255);
  pdf.text("TEAM", M + 2, y + 5.1);
  months.forEach((month, index) => pdf.text(safe(month).toUpperCase(), M + teamW + index * monthW + monthW / 2, y + 5.1, { align: "center" }));
  y += 9;
  (rows || []).forEach((row, index) => {
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(M, y - 1, CONTENT_W, 12, "F");
    }
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(30, 41, 59);
    pdf.text(safe(row.teamName), M + 2, y + 4);
    setPdfFont(pdf, "normal");
    pdf.setFontSize(5.6);
    pdf.setTextColor(100, 116, 139);
    pdf.text(safe(row.region, "No region"), M + 2, y + 8);
    (row.values || []).forEach((value, valueIndex) => {
      const percentage = Number(value.percentage) || 0;
      const x = M + teamW + valueIndex * monthW;
      const colours = statusColours(percentage > 100 ? "red" : percentage < 60 ? "amber" : "green");
      pdf.setFillColor(...colours.fill);
      pdf.roundedRect(x + 3, y + 1, monthW - 6, 7, 1.5, 1.5, "F");
      setPdfFont(pdf, "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...colours.text);
      pdf.text(`${percentage}%`, x + monthW / 2, y + 5.6, { align: "center" });
      setPdfFont(pdf, "normal");
      pdf.setFontSize(5.2);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${Number(value.booked) || 0}/${Number(value.total) || 0} team-days`, x + monthW / 2, y + 10, { align: "center" });
    });
    y += 12;
  });
  return y + 4;
}

function actionTable(pdf, actions, y, meta) {
  const cols = [77, 35, 34, 42];
  const headings = ["Decision / action", "Owner", "Due", "Status"];
  const drawHeadings = (startY) => {
    pdf.setFillColor(...meta.rgb);
    pdf.roundedRect(M, startY, CONTENT_W, 8, 1.5, 1.5, "F");
    let headingX = M;
    headings.forEach((heading, index) => {
      setPdfFont(pdf, "bold");
      pdf.setFontSize(6.2);
      pdf.setTextColor(255, 255, 255);
      pdf.text(heading.toUpperCase(), headingX + 2, startY + 5.1);
      headingX += cols[index];
    });
    return startY + 9;
  };
  y = drawHeadings(y);
  let x = M;
  (actions || []).forEach((action, index) => {
    if (y + 13 > CONTENT_BOTTOM) {
      pdf.addPage();
      y = pageHeader(pdf, meta, "Management actions - continued");
      y = drawHeadings(y);
    }
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(M, y - 1, CONTENT_W, 12, "F");
    }
    x = M;
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6.4);
    pdf.setTextColor(30, 41, 59);
    pdf.text(pdf.splitTextToSize(safe(action.text), cols[0] - 4).slice(0, 2), x + 2, y + 3.5);
    x += cols[0];
    setPdfFont(pdf, "normal");
    pdf.setTextColor(71, 85, 105);
    pdf.text(pdf.splitTextToSize(safe(action.owner, "Unassigned"), cols[1] - 4).slice(0, 2), x + 2, y + 3.5);
    x += cols[1];
    pdf.text(enGbDate(action.due), x + 2, y + 3.5);
    x += cols[2];
    pdf.text(safe(action.status, "Open"), x + 2, y + 3.5);
    y += 12;
  });
  if (!actions?.length) {
    setPdfFont(pdf, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text("No management decisions or actions have been recorded.", M + 3, y + 7);
    y += 13;
  }
  return y + 3;
}

function managementNotes(pdf, text, y, meta) {
  let lines = pdf.splitTextToSize(safe(text, "No additional management notes recorded."), CONTENT_W - 12);
  while (lines.length) {
    const availableHeight = CONTENT_BOTTOM - y - 4;
    const maxLines = Math.max(1, Math.floor((availableHeight - 12) / 4));
    if (maxLines < 3) {
      pdf.addPage();
      y = pageHeader(pdf, meta, "Management notes - continued");
      y = title(pdf, "Management notes - continued", y, meta.rgb);
      continue;
    }
    const remainder = lines.length - maxLines;
    const takeCount = remainder > 0 && remainder < 6 ? Math.ceil(lines.length / 2) : maxLines;
    const pageLines = lines.slice(0, takeCount);
    lines = lines.slice(takeCount);
    const boxHeight = Math.max(35, pageLines.length * 4 + 12);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(M, y, CONTENT_W, boxHeight, 3, 3, "FD");
    setPdfFont(pdf, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    pdf.text(pageLines, M + 6, y + 8);
    y += boxHeight;
    if (lines.length) {
      pdf.addPage();
      y = pageHeader(pdf, meta, "Management notes - continued");
      y = title(pdf, "Management notes - continued", y, meta.rgb);
    }
  }
  return y;
}

async function loadJsPdf() {
  const module = await import("jspdf");
  return module.jsPDF;
}

export async function buildManagementBoardPackPdf(data, options = {}) {
  const jsPDF = await loadJsPdf();
  const org = options.org || getOrgSettings();
  const rgb = hexToRgb(org.primaryColor);
  const accentRgb = hexToRgb(org.accentColor);
  const theme = getPdfTheme(org);
  const docRef = buildDocReference(org, "Management Board Pack");
  const meta = {
    org,
    rgb,
    accentRgb,
    theme,
    docRef,
    title: "Management Board Pack",
    subtitle: `Private and confidential - ${safe(data.periodLabel, "Next 90 days")}`,
  };
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await ensurePdfUnicodeFont(pdf);

  pdf.setFillColor(10, 43, 37);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(...rgb);
  pdf.circle(188, 30, 48, "F");
  pdf.setFillColor(...accentRgb);
  pdf.circle(205, 285, 38, "F");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(110, 231, 183);
  pdf.text("PRIVATE MANAGEMENT WORKSPACE", M, 42);
  pdf.setFontSize(29);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Management", M, 61);
  pdf.text("Board Pack", M, 73);
  setPdfFont(pdf, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(190, 211, 204);
  pdf.text(pdf.splitTextToSize(`${safe(org.name, "My Organisation")} - operational programme, capacity and H&S readiness`, 125), M, 84);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(M, 114, 92, 36, 3, 3, "F");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...rgb);
  pdf.text("REPORTING PERIOD", M + 6, 123);
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(safe(data.periodLabel, "Next 90 days"), M + 6, 132);
  setPdfFont(pdf, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Generated ${new Date().toLocaleString("en-GB")}`, M + 6, 141);
  pdf.setFontSize(7.5);
  pdf.setTextColor(190, 211, 204);
  pdf.text("Prepared in MySafeOps", M, 268);
  setPdfFont(pdf, "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text(docRef, M, 276);
  pdf.text("PRIVATE & CONFIDENTIAL", W - M, 276, { align: "right" });

  pdf.addPage();
  let y = pageHeader(pdf, meta);
  y = title(pdf, "Executive summary", y, rgb, "A concise view of delivery, readiness and available capacity.");
  const metrics = data.metrics || {};
  const gap = 4;
  const metricW = (CONTENT_W - gap * 3) / 4;
  metric(pdf, M, y, metricW, "Upcoming jobs", metrics.scheduled, "Next 90 days", rgb);
  metric(pdf, M + (metricW + gap), y, metricW, "Needs attention", metrics.attention, "Readiness or delay", rgb, Number(metrics.attention) ? "red" : "green");
  metric(pdf, M + (metricW + gap) * 2, y, metricW, "Capacity", `${metrics.capacity || 0}%`, "Three-month average", rgb);
  metric(pdf, M + (metricW + gap) * 3, y, metricW, "Diary gaps", metrics.gaps, "Months below 60%", rgb);
  y += 34;
  y = title(pdf, "Management briefing", y, rgb);
  pdf.setFillColor(242, 249, 247);
  pdf.setDrawColor(203, 225, 218);
  const briefingLines = pdf.splitTextToSize(safe(data.briefing, "No urgent management briefing for this period."), CONTENT_W - 14);
  const briefH = Math.max(25, briefingLines.length * 4 + 14);
  pdf.roundedRect(M, y, CONTENT_W, briefH, 3, 3, "FD");
  pdf.setFillColor(...rgb);
  pdf.circle(M + 8, y + 9, 3.3, "F");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(255, 255, 255);
  pdf.text("!", M + 8, y + 10, { align: "center" });
  setPdfFont(pdf, "normal");
  pdf.setFontSize(8.2);
  pdf.setTextColor(30, 41, 59);
  pdf.text(briefingLines, M + 14, y + 8);
  y += briefH + 10;
  y = title(pdf, "Portfolio readiness", y, rgb, "Traffic-light view of work across the reporting window.");
  y = readinessDashboard(pdf, data.jobs || [], y);
  y = ensurePage(pdf, y + 2, 35, meta, "Executive summary - continued");
  const priorityJobs = data.attentionJobs || [];
  y = title(pdf, "Priority jobs", y, rgb, "Top priorities for immediate review. Full programme detail follows.");
  y = jobTable(pdf, priorityJobs.slice(0, 2), y, meta);
  if (priorityJobs.length > 2) {
    setPdfFont(pdf, "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${priorityJobs.length - 2} additional priority jobs are included in the programme pages.`, M + 2, y + 2);
  }

  pdf.addPage();
  y = pageHeader(pdf, meta, "90-day operational programme");
  y = title(pdf, "90-day programme", y, rgb, "Confirmed, provisional and pipeline work in chronological order.");
  y = programmeTimeline(pdf, data.jobs || [], y);
  y = ensurePage(pdf, y + 2, 35, meta, "90-day programme - continued");
  y = title(pdf, "Programme detail", y, rgb);
  y = jobTable(pdf, data.jobs || [], y, meta);

  pdf.addPage();
  y = pageHeader(pdf, meta, "Capacity and readiness");
  y = title(pdf, "Team capacity", y, rgb, "Booked team-days compared with available working days.");
  y = capacityTable(pdf, data.capacityRows || [], data.months || [], y, meta);
  y = ensurePage(pdf, y + 5, 65, meta, "Capacity and readiness - continued");
  y = title(pdf, "Readiness overview", y, rgb, "Jobs are ready only when dates, team, client and required H&S documents are confirmed.");
  y = jobTable(pdf, (data.jobs || []).slice().sort((a, b) => Number(a.readiness) - Number(b.readiness)).slice(0, 10), y, meta);

  pdf.addPage();
  y = pageHeader(pdf, meta, "Management meeting record");
  y = title(pdf, "Decisions and actions", y, rgb, safe(data.meeting?.title, "Management meeting action register"));
  y = actionTable(pdf, data.meeting?.actions || [], y, meta);
  y = ensurePage(pdf, y + 5, 55, meta, "Management notes - continued");
  y = title(pdf, "Management notes", y, rgb);
  managementNotes(pdf, data.meeting?.notes, y, meta);

  const pageCount = pdf.getNumberOfPages();
  for (let page = 2; page <= pageCount; page += 1) {
    pdf.setPage(page);
    drawPremiumPdfFooter(pdf, org, page, pageCount, theme, rgb, accentRgb);
  }
  drawWatermark(pdf, org);

  const fileName = `${sanitizePdfFileSegment(org.name, 24) || "MySafeOps"}-Management-Board-Pack-${todayLocalISO()}.pdf`;
  if (options.download !== false) pdf.save(fileName);
  return { pdf, fileName, pages: pageCount };
}
