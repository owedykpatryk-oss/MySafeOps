/**
 * Cloudflare R2 uploads via a small Worker (see cloudflare/workers/r2-upload).
 * Secrets stay on the Worker; only URL + optional upload token are exposed to the client.
 */

export function isR2StorageConfigured() {
  return Boolean(String(import.meta.env.VITE_STORAGE_API_URL || "").trim());
}

export function getStorageApiBase() {
  return String(import.meta.env.VITE_STORAGE_API_URL || "").replace(/\/$/, "");
}

export function getR2PublicBaseUrl() {
  return String(import.meta.env.VITE_R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

export function getStorageUploadToken() {
  return String(import.meta.env.VITE_STORAGE_UPLOAD_TOKEN || "").trim();
}

/**
 * @param {File} file
 * @param {{ orgId: string, subPath?: string }} opts
 * @returns {Promise<{ key: string; size: number; publicUrl: string | null }>}
 */
export async function uploadFileToR2Storage(file, { orgId, subPath = "documents" }) {
  const base = getStorageApiBase();
  if (!base) throw new Error("Cloud storage is not configured (set VITE_STORAGE_API_URL).");

  const token = getStorageUploadToken();
  const safeName = (file.name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 180);
  const key = `${subPath.replace(/^\/+|\/+$/g, "")}/org_${orgId}/${Date.now()}_${safeName}`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("key", key);

  const headers = {};
  if (token) headers["X-Upload-Token"] = token;

  const res = await fetch(`${base}/upload`, {
    method: "POST",
    headers,
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || res.statusText || "Upload failed";
    throw new Error(msg);
  }

  const returnedKey = json.key || key;
  const pub = getR2PublicBaseUrl();
  const publicUrl = pub ? `${pub}/${returnedKey}` : null;

  return { key: returnedKey, size: json.size ?? file.size, publicUrl };
}
