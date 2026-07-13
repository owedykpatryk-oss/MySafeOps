/**
 * Cloudflare R2 uploads via a small Worker (see cloudflare/workers/r2-upload).
 * Prefer Supabase session JWT when signed in; static upload token is legacy fallback.
 */

import { supabase } from "./supabase.js";

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

async function buildUploadHeaders() {
  const headers = {};
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data?.session?.access_token;
      if (jwt) {
        headers.Authorization = `Bearer ${jwt}`;
        return headers;
      }
    } catch {
      /* session optional */
    }
  }
  const token = getStorageUploadToken();
  if (token) headers["X-Upload-Token"] = token;
  return headers;
}

/**
 * @param {File} file
 * @param {{ orgId: string, subPath?: string }} opts
 * @returns {Promise<{ key: string; size: number; publicUrl: string | null }>}
 */
export async function uploadFileToR2Storage(file, { orgId, subPath = "documents" }) {
  const base = getStorageApiBase();
  if (!base) throw new Error("Cloud storage is not configured (set VITE_STORAGE_API_URL).");

  const maxBytes = 25 * 1024 * 1024;
  if (Number(file?.size) > maxBytes) {
    throw new Error("File exceeds 25 MB upload limit.");
  }

  const safeName = (file.name || "file").replace(/[^\w.-]+/g, "_").slice(0, 180);
  const key = `${subPath.replace(/^\/+|\/+$/g, "")}/org_${orgId}/${Date.now()}_${safeName}`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("key", key);

  const headers = await buildUploadHeaders();

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
