/**
 * Cloudflare R2 uploads via a small Worker (see cloudflare/workers/r2-upload).
 * Prefer Supabase session JWT when signed in; static upload token is legacy fallback (dev only).
 * Authenticated downloads: GET /object?key=… with Bearer JWT.
 * Short-lived HMAC URLs: signedUrl from upload response (GET /signed?…).
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

async function buildAuthHeaders() {
  const headers = {};
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data?.session?.access_token;
      if (jwt) {
        headers.Authorization = `Bearer ${jwt}`;
        return { headers, ok: true };
      }
    } catch {
      /* session optional */
    }
  }
  if (import.meta.env.PROD) {
    return { headers: {}, ok: false, error: "no_upload_auth" };
  }
  const token = getStorageUploadToken();
  if (token) {
    headers["X-Upload-Token"] = token;
    return { headers, ok: true };
  }
  return { headers: {}, ok: false, error: "no_upload_auth" };
}

/**
 * @param {File} file
 * @param {{ orgId: string, subPath?: string }} opts
 * @returns {Promise<{ key: string; size: number; publicUrl: string | null; signedUrl: string | null; signedExpiresAt: number | null }>}
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

  const auth = await buildAuthHeaders();
  if (!auth.ok) {
    throw new Error("Sign in to upload to cloud storage.");
  }

  const res = await fetch(`${base}/upload`, {
    method: "POST",
    headers: auth.headers,
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Cloud upload not authorised — sign in again, then retry.");
    }
    const msg = json?.error || json?.message || res.statusText || "Upload failed";
    throw new Error(msg);
  }

  const returnedKey = json.key || key;
  // Only build a "public CDN" URL when the base is a real public host — not the upload Worker itself.
  // Mis-setting VITE_R2_PUBLIC_BASE_URL to the Worker origin produces /{key} links that 405 and break <img>.
  const pub = getR2PublicBaseUrl();
  const apiBase = getStorageApiBase();
  const publicUrl = pub && pub !== apiBase ? `${pub}/${returnedKey}` : null;
  const signedUrl = typeof json.signedUrl === "string" ? json.signedUrl : null;
  const signedExpiresAt =
    typeof json.signedExpiresAt === "number" ? json.signedExpiresAt : null;

  return {
    key: returnedKey,
    size: json.size ?? file.size,
    publicUrl,
    signedUrl,
    signedExpiresAt,
  };
}

/**
 * Download an org object via the Worker (JWT + membership). Prefer this over bare public CDN for sensitive files.
 * @param {string} key
 * @returns {Promise<Blob>}
 */
export async function fetchR2ObjectBlob(key) {
  const base = getStorageApiBase();
  if (!base) throw new Error("Cloud storage is not configured.");
  const auth = await buildAuthHeaders();
  if (!auth.headers.Authorization) {
    throw new Error("Sign in to download from cloud storage.");
  }
  const res = await fetch(`${base}/object?key=${encodeURIComponent(key)}`, {
    method: "GET",
    headers: auth.headers,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || `Download failed (${res.status})`);
  }
  return res.blob();
}

/**
 * Prefer Worker signed URL when present and not expired; else public CDN; else null.
 * @param {{ signedUrl?: string | null, signedExpiresAt?: number | null, publicUrl?: string | null, key?: string }} meta
 */
/**
 * True when `url` is a real public object URL (not the upload Worker /{key} path).
 * Worker serves objects only via /signed and /object.
 */
export function isUsableR2PublicUrl(url) {
  const u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  const api = getStorageApiBase();
  if (api && u.startsWith(`${api}/`) && !u.includes("/signed?")) return false;
  return true;
}

export function pickR2ViewUrl(meta = {}) {
  const exp = Number(meta.signedExpiresAt);
  if (meta.signedUrl && Number.isFinite(exp) && exp * 1000 > Date.now() + 30_000) {
    return meta.signedUrl;
  }
  if (isUsableR2PublicUrl(meta.publicUrl)) return meta.publicUrl;
  return null;
}
