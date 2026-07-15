/**
 * Extract KML XML text from a KMZ (ZIP) ArrayBuffer using fflate.
 */

import { unzipSync, strFromU8 } from "fflate";

function isZipBuffer(u8) {
  return Boolean(u8 && u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b);
}

/**
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {{ kmlText: string, entryName: string } | null}
 */
export function extractKmlFromKmzBuffer(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!isZipBuffer(u8)) return null;

  let files;
  try {
    files = unzipSync(u8);
  } catch {
    return null;
  }

  const names = Object.keys(files || {}).filter((n) => !n.endsWith("/"));
  if (!names.length) return null;

  const preferred =
    names.find((n) => /(^|\/)doc\.kml$/i.test(n)) ||
    names.find((n) => /\.kml$/i.test(n));
  if (!preferred) return null;

  const data = files[preferred];
  if (!data?.length) return null;
  const kmlText = strFromU8(data).replace(/^\uFEFF/, "");
  if (!String(kmlText).includes("<kml") && !String(kmlText).includes("<KML")) return null;
  return { kmlText, entryName: preferred };
}

/**
 * Read a File as KML text — supports plain .kml or .kmz (ZIP).
 * Detects KMZ by ZIP magic bytes so mislabelled MIME / missing extension still works.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function readKmlTextFromFile(file) {
  if (!file) throw new Error("No file selected.");
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const looksKmzByName =
    name.endsWith(".kmz") ||
    type.includes("kmz") ||
    type === "application/vnd.google-earth.kmz" ||
    type === "application/zip";

  if (looksKmzByName || isZipBuffer(u8)) {
    const extracted = extractKmlFromKmzBuffer(u8);
    if (!extracted) {
      throw new Error(
        looksKmzByName || isZipBuffer(u8)
          ? "Could not read KML from KMZ — is it a valid Google Earth KMZ?"
          : "Could not read KML from this file."
      );
    }
    return extracted.kmlText;
  }

  // Plain KML (or mislabeled XML)
  return new TextDecoder("utf-8").decode(u8).replace(/^\uFEFF/, "");
}

export function isKmlOrKmzFileName(name) {
  const n = String(name || "").toLowerCase();
  return n.endsWith(".kml") || n.endsWith(".kmz");
}
