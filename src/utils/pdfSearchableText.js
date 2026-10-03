import { setPdfFont } from "./pdfUnicodeFont.js";

const MAX_SEARCHABLE_WORDS = 40_000;

/** Collect visible words and their screen coordinates from a captured HTML document. */
export function collectPdfSearchableWords(root, maxWords = MAX_SEARCHABLE_WORDS) {
  if (!root?.ownerDocument) return [];
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const nodeFilter = view?.NodeFilter;
  if (!view || !nodeFilter) return [];
  const rootRect = root.getBoundingClientRect();

  const walker = doc.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  const words = [];
  let node;
  while ((node = walker.nextNode()) && words.length < maxWords) {
    const text = node.nodeValue || "";
    const parent = node.parentElement;
    if (!text.trim() || !parent || parent.closest("script, style, noscript, [aria-hidden='true']")) continue;
    const style = view.getComputedStyle(parent);
    const fontSize = Number.parseFloat(style.fontSize);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0" || !Number.isFinite(fontSize)) {
      continue;
    }

    const pattern = /\S+/gu;
    let match;
    while ((match = pattern.exec(text)) && words.length < maxWords) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rects = [...range.getClientRects()];
      rects.forEach((rect) => {
        if (rect.width <= 0 || rect.height <= 0 || words.length >= maxWords) return;
        words.push({
          text: match[0],
          left: rect.left - rootRect.left,
          top: rect.top - rootRect.top,
          fontSize,
          bold: Number.parseInt(style.fontWeight, 10) >= 600 || style.fontWeight === "bold",
        });
      });
    }
  }
  range.detach?.();
  return words.sort((a, b) => a.top - b.top || a.left - b.left);
}

/** Add selectable/searchable text without changing the visible raster page. */
export function drawPdfSearchableText(pdf, words, options) {
  const {
    sourceStart = 0,
    sourceEnd = Number.POSITIVE_INFINITY,
    pixelsPerMm,
    marginXmm = 0,
    marginYmm = 0,
    topOffsetPx = 0,
    pageContentHeightPx = Number.POSITIVE_INFINITY,
    coordinateScale = 1,
  } = options || {};
  if (!Array.isArray(words) || !Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) return 0;

  let drawn = 0;
  let currentFont = "";
  let currentSize = 0;
  pdf.setTextColor(0, 0, 0);
  for (const word of words) {
    const left = Number(word.left) * coordinateScale;
    const top = Number(word.top) * coordinateScale;
    const fontSizePx = Number(word.fontSize) * coordinateScale;
    if (
      !word.text ||
      !Number.isFinite(left) ||
      !Number.isFinite(top) ||
      !Number.isFinite(fontSizePx) ||
      top < sourceStart ||
      top >= sourceEnd
    ) {
      continue;
    }
    const localTop = top - sourceStart + topOffsetPx;
    if (localTop < 0 || localTop + fontSizePx >= pageContentHeightPx) continue;
    const font = word.bold ? "bold" : "normal";
    const sizePt = Math.max(4, Math.min(36, (fontSizePx * 72) / (25.4 * pixelsPerMm)));
    if (font !== currentFont) {
      setPdfFont(pdf, font);
      currentFont = font;
    }
    if (Math.abs(sizePt - currentSize) > 0.1) {
      pdf.setFontSize(sizePt);
      currentSize = sizePt;
    }
    const x = marginXmm + left / pixelsPerMm;
    const y = marginYmm + (localTop + fontSizePx * 0.85) / pixelsPerMm;
    pdf.text(String(word.text), x, y, { renderingMode: "invisible" });
    drawn += 1;
  }
  return drawn;
}
