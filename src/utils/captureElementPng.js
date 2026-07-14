/**
 * Capture a DOM element as PNG blob (html2canvas).
 * @param {HTMLElement} el
 * @param {{ scale?: number, backgroundColor?: string }} [opts]
 * @returns {Promise<Blob | null>}
 */
export async function captureElementPngBlob(el, opts = {}) {
  if (!el) return null;
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, {
    useCORS: true,
    allowTaint: false,
    scale: opts.scale ?? 2,
    logging: false,
    backgroundColor: opts.backgroundColor ?? "#f1f5f9",
  });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function downloadPngBlob(blob, filename) {
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
