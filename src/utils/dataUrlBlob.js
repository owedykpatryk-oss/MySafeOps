/**
 * Decode data URLs without fetch() — avoids CSP connect-src blocks on data: URIs.
 */

/**
 * @param {string} dataUrl
 * @returns {{ mime: string, base64: string } | null}
 */
export function parseDataUrl(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;,]*)(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
  if (!m) return null;
  return { mime: m[1] || "application/octet-stream", base64: m[2] };
}

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("Invalid data URL");
  const binary = atob(parsed.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: parsed.mime });
}

/**
 * @param {string} dataUrl
 * @returns {ArrayBuffer}
 */
export function dataUrlToArrayBuffer(dataUrl) {
  return dataUrlToBlob(dataUrl).arrayBuffer();
}
