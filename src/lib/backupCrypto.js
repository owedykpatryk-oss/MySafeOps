/**
 * Client-side encryption for Supabase app_sync payloads (CE: backup not readable at rest in DB).
 * Key (DEK) stays in this browser — new device needs a local file export or re-upload from another device with the same profile.
 */

const DEK_STORAGE_KEY = "mysafeops_cloud_dek_v1";
const ENVELOPE_MARK = "_mysafeops_enc";

function bytesToB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importDek(raw) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** @returns {Promise<CryptoKey>} */
async function getOrCreateCloudBackupDek() {
  const existing = localStorage.getItem(DEK_STORAGE_KEY);
  if (existing) {
    return importDek(b64ToBytes(existing));
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(DEK_STORAGE_KEY, bytesToB64(raw));
  return importDek(raw);
}

export function isEncryptedCloudPayload(payload) {
  return Boolean(payload && typeof payload === "object" && payload[ENVELOPE_MARK]);
}

export function hasCloudBackupDek() {
  return Boolean(localStorage.getItem(DEK_STORAGE_KEY));
}

/** Wipe the local DEK (call on sign-out so XSS leftovers / shared devices cannot keep decrypting). */
export function clearCloudBackupDek() {
  try {
    localStorage.removeItem(DEK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {Record<string, unknown>} bundle
 * @returns {Promise<Record<string, unknown>>}
 */
export async function encryptBackupForCloud(bundle) {
  const key = await getOrCreateCloudBackupDek();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(bundle));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    [ENVELOPE_MARK]: {
      v: 1,
      alg: "AES-GCM",
      iv: bytesToB64(iv),
      ct: bytesToB64(new Uint8Array(ct)),
    },
  };
}

/**
 * @param {unknown} stored — plaintext bundle or encrypted envelope row
 * @returns {Promise<Record<string, unknown>>}
 */
export async function decryptCloudBackupPayload(stored) {
  if (!isEncryptedCloudPayload(stored)) {
    return /** @type {Record<string, unknown>} */ (stored);
  }
  const enc = stored[ENVELOPE_MARK];
  const dekRaw = localStorage.getItem(DEK_STORAGE_KEY);
  if (!dekRaw) {
    throw new Error(
      "This cloud backup is encrypted. Sign in on the device that created it, or restore from a downloaded JSON file."
    );
  }
  const key = await importDek(b64ToBytes(dekRaw));
  const iv = b64ToBytes(enc.iv);
  const ct = b64ToBytes(enc.ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}
