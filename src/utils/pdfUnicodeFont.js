export const PDF_FONT_FAMILY = "NotoSans";

let fontReadyPromise = null;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load PDF font: ${url}`);
  return arrayBufferToBase64(await res.arrayBuffer());
}

/** Register Unicode font on a jsPDF instance (lazy-loads TTF once). */
export async function ensurePdfUnicodeFont(pdf) {
  if (!pdf) return PDF_FONT_FAMILY;
  const list = pdf.getFontList?.() || {};
  if (list[PDF_FONT_FAMILY]) return PDF_FONT_FAMILY;

  if (!fontReadyPromise) {
    fontReadyPromise = Promise.all([
      loadFontBase64(`${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`),
      loadFontBase64(`${import.meta.env.BASE_URL}fonts/NotoSans-Bold.ttf`),
    ]);
  }
  const [regular, bold] = await fontReadyPromise;
  pdf.addFileToVFS("NotoSans-Regular.ttf", regular);
  pdf.addFont("NotoSans-Regular.ttf", PDF_FONT_FAMILY, "normal");
  pdf.addFileToVFS("NotoSans-Bold.ttf", bold);
  pdf.addFont("NotoSans-Bold.ttf", PDF_FONT_FAMILY, "bold");
  return PDF_FONT_FAMILY;
}

export function setPdfFont(pdf, style = "normal") {
  pdf.setFont(PDF_FONT_FAMILY, style === "bold" ? "bold" : "normal");
}
