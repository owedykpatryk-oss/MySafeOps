import { readDocxBody } from "./documentZip.js";
const MAX_BYTES = 8 * 1024 * 1024,
  MAX_TEXT = 120000;
const bounded = (pages) => {
  if (pages.reduce((sum, p) => sum + p.text.length, 0) > MAX_TEXT)
    throw new Error("Document text exceeds 120,000 characters. Import a relevant extract.");
  return pages;
};
export function parseDocxPages(bytes) {
  const text = readDocxBody(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("Document entities are not supported.");
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("DOCX body is malformed.");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  return bounded([
    {
      page: 1,
      text: [...xml.getElementsByTagNameNS(ns, "p")]
        .map((p) => [...p.getElementsByTagNameNS(ns, "t")].map((t) => t.textContent).join(""))
        .join("\n"),
    },
  ]);
}
export async function readDocumentBytes(bytes, name) {
  if (bytes.byteLength > MAX_BYTES) throw new Error("Import a document up to 8 MB.");
  const ext = name.split(".").at(-1).toLowerCase();
  if (ext === "txt") return bounded([{ page: 1, text: new TextDecoder().decode(bytes) }]);
  if (ext === "docx") return parseDocxPages(bytes);
  if (ext !== "pdf") throw new Error("Choose a PDF, DOCX or TXT document.");
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 40) throw new Error("Import up to 40 pages. Select a relevant document extract.");
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push({ page: i, text: content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("") });
      bounded(pages);
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
export async function readSourceDocument(file) {
  if (!file || file.size > MAX_BYTES) throw new Error("Import a document up to 8 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const pages = await readDocumentBytes(bytes, file.name);
  return {
    name: file.name,
    hash,
    pages,
    locationUnit: /\.pdf$/i.test(file.name) ? "Page" : "Text block",
    hasText: pages.some((p) => p.text.trim()),
    expiresOn: "",
  };
}
