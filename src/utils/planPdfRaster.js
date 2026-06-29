import { dataUrlToArrayBuffer } from "./dataUrlBlob";

/**
 * Rasterize first page of a PDF data URL for plan markup (optional pdfjs-dist).
 * @returns {Promise<string|null>} PNG data URL or null if unavailable
 */
export async function rasterizePdfDataUrl(dataUrl, { maxWidth = 2400 } = {}) {
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return null;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url
      ).toString();
    }
    const buf = await dataUrlToArrayBuffer(dataUrl);
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, maxWidth / viewport.width);
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(scaled.width);
    canvas.height = Math.floor(scaled.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport: scaled }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
